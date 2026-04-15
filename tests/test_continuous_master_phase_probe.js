// tests/test_continuous_master_phase_probe.js
//
// Tests for run_continuous_master_phase_probe.js
//
// Covers:
//   A. Read-side posture and no authority leakage
//   B. Deterministic logic on fixtures (segmentation, recurrence, ambiguity)
//   C. Lens metadata preservation
//   D. File lineage and ingest boundary
//   E. Output shape
//   F. Per-file structural results (when WAV files present)
//   G. Cross-file summary
//
// Run:
//   node tests/test_continuous_master_phase_probe.js

import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const REPORT    = path.join(REPO_ROOT, "out_experiments",
    "continuous_master_phase_probe", "continuous_master_phase_report.json");
const WAV_DIR   = path.join(REPO_ROOT, "test_signal", "daw_mic_input");

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, detail = "") {
    if (cond) { console.log(`  ✓ ${label}`); passed++; }
    else { const m = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`; console.error(m); failures.push(m); failed++; }
}
function section(name) { console.log(`\n── ${name} ──`); }

// Check WAV availability
let wavPresent = false;
try { await access(path.join(WAV_DIR, "master_01.wav")); wavPresent = true; } catch (_) {}

let report = null;
try { report = JSON.parse(await readFile(REPORT, "utf8")); } catch (_) {}

// ─── Inline algorithm mirrors ─────────────────────────────────────────────────

function l1(a, b) { return a.reduce((s, v, i) => s + Math.abs(v - (b[i] ?? 0)), 0); }
function normL1(v) { const s = v.reduce((a, x) => a + Math.abs(x), 0); return s === 0 ? v.map(() => 0) : v.map(x => x / s); }

function detectBoundariesTest(segProfiles, threshold = 0.08) {
    const scores = segProfiles.slice(1).map((p, i) => ({
        idx: i + 1, score: l1(p, segProfiles[i]),
    }));
    const peaks = scores.filter((b, i) => {
        if (b.score < threshold) return false;
        const prev = scores[i - 1]?.score ?? 0;
        const next = scores[i + 1]?.score ?? 0;
        return b.score >= prev && b.score >= next;
    });
    return { scores, peaks };
}

function assessAmbiguityTest(peaks, firstProf, lastProf, threshold = 0.08) {
    if (!peaks.length) return "no_strong_boundaries";
    if (peaks.length === 1) return "single_transition";
    if (peaks.length >= 2) {
        const dist = l1(firstProf, lastProf);
        return dist < threshold ? "two_boundaries_with_return" : "two_boundaries_no_clear_return";
    }
    return "unresolved";
}

// ════════════════════════════════════════════════════════════════════════════
// A. Read-side posture and authority checks
// ════════════════════════════════════════════════════════════════════════════
section("A. Read-side posture");

assert("A1: report exists", report != null,
    "run the probe first: node scripts/run_continuous_master_phase_probe.js");

const cp = report?.constitutional_posture ?? {};
assert("A2: runtime_below_canon = true",                  cp.runtime_below_canon === true);
assert("A3: candidate_boundaries_are_provisional = true", cp.candidate_boundaries_are_provisional === true);
assert("A4: no_truth_labels = true",                      cp.no_truth_labels === true);
assert("A5: no_runtime_authority = true",                 cp.no_runtime_authority === true);
assert("A6: no_workbench_effects = true",                 cp.no_workbench_effects === true);
assert("A7: no_canon_minting = true",                     cp.no_canon_minting === true);
assert("A8: no_prediction_claims = true",                 cp.no_prediction_claims === true);
assert("A9: findings_provisional = true",                 cp.findings_provisional === true);
assert("A10: not_promotion = true",                       cp.not_promotion === true);

// Check no semantic language leaks into stable fields
const reportStr = JSON.stringify(report?.per_file_results ?? []);
assert("A11: no 'canonical' in per_file_results",   !reportStr.includes('"canonical"'));
assert("A12: no 'promoted' in per_file_results",    !reportStr.includes('"promoted"'));
assert("A13: no 'truth_label' in per_file_results", !reportStr.includes('"truth_label"'));
assert("A14: no 'validated' in per_file_results",   !reportStr.includes('"validated"'));

// Cross-file summary posture
const cfs = report?.cross_file_summary ?? {};
assert("A15: cross_file_summary not_canon = true",      cfs.not_canon === true);
assert("A16: cross_file_summary not_prediction = true", cfs.not_prediction === true);
assert("A17: cross_file_summary not_promotion = true",  cfs.not_promotion === true);

// ════════════════════════════════════════════════════════════════════════════
// B. Deterministic logic on fixtures
// ════════════════════════════════════════════════════════════════════════════
section("B. Algorithm determinism on fixtures");

// Segmentation: L1 boundary detection
const regimeA = [0.556, 0.185, 0.131, 0.128]; // typical baseline band profile
const regimeB = [0.380, 0.255, 0.228, 0.137]; // typical perturbation band profile
const regimeC = [0.557, 0.183, 0.132, 0.128]; // typical return band profile

// Three-phase sequence
const seqProfiles = [
    regimeA, regimeA, regimeA,            // segs 0–2: regime A
    regimeB, regimeB, regimeB, regimeB,   // segs 3–6: regime B  (large jump at seg 3)
    regimeA, regimeA, regimeA,            // segs 7–9: regime C  (large jump at seg 7)
];
const { peaks: testPeaks } = detectBoundariesTest(seqProfiles, 0.08);
assert("B1: two peaks detected in A/B/A sequence",
    testPeaks.length === 2, `got ${testPeaks.length} peaks`);
assert("B2: first peak at seg index 3 (A→B transition)",
    testPeaks[0]?.idx === 3);
assert("B3: second peak at seg index 7 (B→A transition)",
    testPeaks[1]?.idx === 7);

// No peaks case
const flatProfiles = [[0.5, 0.2, 0.2, 0.1], [0.51, 0.19, 0.21, 0.1], [0.49, 0.21, 0.2, 0.1]];
const { peaks: flatPeaks } = detectBoundariesTest(flatProfiles, 0.08);
assert("B4: no peaks in flat sequence", flatPeaks.length === 0);

// Ambiguity classification
assert("B5: A/B/A sequence → two_boundaries_with_return",
    assessAmbiguityTest(testPeaks, regimeA, regimeC, 0.08) === "two_boundaries_with_return");
assert("B6: A/B sequence → single_transition",
    assessAmbiguityTest([{idx:1}], regimeA, regimeB, 0.08) === "single_transition");
assert("B7: no peaks → no_strong_boundaries",
    assessAmbiguityTest([], regimeA, regimeA, 0.08) === "no_strong_boundaries");

// A and C are similar (return-like); A and B are different
assert("B8: regime A and C are similar (L1 < 0.08)",
    l1(regimeA, regimeC) < 0.08, `L1=${l1(regimeA, regimeC).toFixed(4)}`);
assert("B9: regime A and B are different (L1 > 0.10)",
    l1(regimeA, regimeB) > 0.10, `L1=${l1(regimeA, regimeB).toFixed(4)}`);

// normL1
const raw = [10, 5, 5, 2];
const normed = normL1(raw);
assert("B10: normL1 sums to 1.0",
    Math.abs(normed.reduce((a, b) => a + b, 0) - 1.0) < 1e-9);
assert("B11: normL1 preserves relative ratios",
    Math.abs(normed[0] / normed[1] - 2.0) < 1e-9);

// ════════════════════════════════════════════════════════════════════════════
// C. Lens metadata preservation
// ════════════════════════════════════════════════════════════════════════════
section("C. Lens metadata");

const lensFields = ["target_Fs","window_N","hop_N","band_edges","seg_duration_sec",
    "boundary_threshold","return_threshold"];
assert("C1: probe_config.lens has all required fields",
    lensFields.every(f => f in (report?.probe_config?.lens ?? {})));

// Lens is fixed and identical across all processed files
const fileResults = report?.per_file_results?.filter(r => r.file_found) ?? [];
if (fileResults.length > 1) {
    const lens0 = fileResults[0].lens;
    assert("C2: lens is identical across all files",
        fileResults.every(r =>
            r.lens.effective_fs === lens0.effective_fs &&
            r.lens.window_N === lens0.window_N &&
            r.lens.hop_N === lens0.hop_N &&
            JSON.stringify(r.lens.band_edges) === JSON.stringify(lens0.band_edges)));
}

// Band edges from config
assert("C3: band_edges in probe_config.lens = [0,300,600,900,1200]",
    JSON.stringify(report?.probe_config?.lens?.band_edges) === "[0,300,600,900,1200]");

// Effective FS documented in each file result
assert("C4: effective_fs documented on each file result",
    fileResults.every(r => typeof r.lens?.effective_fs === "number"));

// Derived posture note present
assert("C5: derived_posture field present in lens",
    fileResults.every(r => typeof r.lens?.derived_posture === "string"));

// ════════════════════════════════════════════════════════════════════════════
// D. File lineage and ingest boundary
// ════════════════════════════════════════════════════════════════════════════
section("D. File lineage and ingest boundary");

assert("D1: 3 per_file_results",
    report?.per_file_results?.length === 3, `got ${report?.per_file_results?.length}`);

const lineageFields = ["filename","raw_filepath","source_id","stream_id","channel","modality","clock_policy_id"];
assert("D2: all lineage fields on found file results",
    fileResults.every(r => lineageFields.every(f => f in r && r[f] != null)));

// raw_filepath ends with filename
assert("D3: raw_filepath ends with filename",
    fileResults.every(r => r.raw_filepath?.endsWith(r.filename)));

// Master filenames exactly preserved
const masterNames = ["master_01.wav","master_02.wav","master_03.wav"];
assert("D4: filenames preserved exactly",
    (report?.per_file_results ?? []).map(r => r.filename).sort().join(",")
    === masterNames.sort().join(","));

// stream_id and source_id are file-specific (unique)
assert("D5: stream_ids are unique per file",
    new Set(fileResults.map(r => r.stream_id)).size === fileResults.length);
assert("D6: source_ids are unique per file",
    new Set(fileResults.map(r => r.source_id)).size === fileResults.length);

// Raw WAV metadata preserved
assert("D7: wav_meta present with expected fields",
    fileResults.every(r => r.wav_meta?.sample_rate === 48000 &&
        r.wav_meta?.bits_per_sample === 32));

// ════════════════════════════════════════════════════════════════════════════
// E. Output shape
// ════════════════════════════════════════════════════════════════════════════
section("E. Output shape");

const requiredFileFields = ["segments","boundary_scores","candidate_boundary_peaks",
    "candidate_phases","recurrence_matrix","return_pairs","ambiguity","interpretation"];
assert("E1: all required output fields on each found file result",
    fileResults.every(r => requiredFileFields.every(f => f in r)));

// Segments have required fields
assert("E2: segments have required fields",
    fileResults.every(r => (r.segments ?? []).every(s =>
        "seg_index" in s && "t_start_sec" in s && "t_end_sec" in s &&
        Array.isArray(s.mean_band_profile) && s.mean_band_profile.length === 4)));

// Candidate phases have required fields
assert("E3: candidate_phases have required fields",
    fileResults.every(r => (r.candidate_phases ?? []).every(p =>
        "phase_index" in p && "candidate_label" in p &&
        "t_start_sec" in p && "t_end_sec" in p &&
        Array.isArray(p.mean_band_profile))));

// Ambiguity has class and note
assert("E4: ambiguity has class and note",
    fileResults.every(r => typeof r.ambiguity?.class === "string" && typeof r.ambiguity?.note === "string"));

// Cross-file summary has required fields
const cfsFields = ["files_processed","files_with_two_boundaries","files_with_return_structure",
    "cross_file_boundary_agreement","resilience_class","cross_file_interpretation"];
assert("E5: cross_file_summary has required fields",
    cfsFields.every(f => f in cfs));

// ════════════════════════════════════════════════════════════════════════════
// F. Per-file structural results (when WAV present)
// ════════════════════════════════════════════════════════════════════════════
section("F. Per-file structural results");

if (wavPresent && fileResults.length === 3) {
    console.log(`\n  (WAV files present — running structural assertions)`);

    for (const r of fileResults) {
        // Each file should find exactly 2 boundary peaks
        assert(`F1 (${r.filename}): 2 candidate boundary peaks`,
            r.candidate_boundary_peaks?.length === 2,
            `got ${r.candidate_boundary_peaks?.length}`);

        // Boundary peaks should be at t≈32s and t≈64s (within 4s tolerance)
        const peakTs = r.candidate_boundary_peaks?.map(p => p.boundary_t_sec) ?? [];
        assert(`F2 (${r.filename}): first peak near t=32s`,
            Math.abs(peakTs[0] - 32) <= 4, `got ${peakTs[0]}`);
        assert(`F3 (${r.filename}): second peak near t=64s`,
            Math.abs(peakTs[1] - 64) <= 4, `got ${peakTs[1]}`);

        // 3 candidate phases
        assert(`F4 (${r.filename}): 3 candidate phases`,
            r.candidate_phases?.length === 3, `got ${r.candidate_phases?.length}`);

        // Ambiguity class = two_boundaries_with_return
        assert(`F5 (${r.filename}): ambiguity = two_boundaries_with_return`,
            r.ambiguity?.class === "two_boundaries_with_return",
            `got ${r.ambiguity?.class}`);

        // Candidate B has lower band-0 than A and C
        const phA = r.candidate_phases?.find(p => p.candidate_label === "candidate_A");
        const phB = r.candidate_phases?.find(p => p.candidate_label === "candidate_B");
        const phC = r.candidate_phases?.find(p => p.candidate_label === "candidate_C");
        assert(`F6 (${r.filename}): candidate_B band-0 < candidate_A band-0`,
            (phB?.mean_band_profile?.[0] ?? 1) < (phA?.mean_band_profile?.[0] ?? 0));
        assert(`F7 (${r.filename}): candidate_B band-0 < candidate_C band-0`,
            (phB?.mean_band_profile?.[0] ?? 1) < (phC?.mean_band_profile?.[0] ?? 0));

        // A and C are return-like (L1 < 0.08)
        if (phA && phC) {
            const dist = l1(phA.mean_band_profile, phC.mean_band_profile);
            assert(`F8 (${r.filename}): candidate_A and candidate_C are return-like (L1 < 0.08)`,
                dist < 0.08, `L1=${dist.toFixed(4)}`);
        }

        // Return pairs present (cross-phase)
        const crossPairs = r.return_pairs?.filter(p => p.phase_i !== p.phase_j) ?? [];
        assert(`F9 (${r.filename}): at least 5 cross-phase return pairs`,
            crossPairs.length >= 5, `got ${crossPairs.length}`);

        // Return pairs are between A and C (not involving B)
        assert(`F10 (${r.filename}): return pairs connect A↔C phases`,
            crossPairs.some(p =>
                (p.phase_i === "candidate_A" && p.phase_j === "candidate_C") ||
                (p.phase_i === "candidate_C" && p.phase_j === "candidate_A")));
    }
} else {
    console.log(`\n  (WAV files absent — skipping structural assertions)`);
    assert("F1 (posture): candidate_phases field present on file results",
        fileResults.every(r => "candidate_phases" in r));
    assert("F2 (posture): ambiguity field present on file results",
        fileResults.every(r => "ambiguity" in r));
}

// ════════════════════════════════════════════════════════════════════════════
// G. Cross-file summary
// ════════════════════════════════════════════════════════════════════════════
section("G. Cross-file summary");

if (wavPresent && fileResults.length === 3) {
    assert("G1: all 3 files have two boundaries",
        cfs.files_with_two_boundaries === 3, `got ${cfs.files_with_two_boundaries}`);
    assert("G2: all 3 files have return structure",
        cfs.files_with_return_structure === 3);
    assert("G3: cross-file boundary agreement = true",
        cfs.cross_file_boundary_agreement === true);
    assert("G4: resilience_class = consistent_return_structure_across_cohort",
        cfs.resilience_class === "consistent_return_structure_across_cohort",
        `got ${cfs.resilience_class}`);
    assert("G5: approximate_boundary_1_sec ≈ 32 (within 4s)",
        Math.abs((cfs.approximate_boundary_1_sec ?? 99) - 32) <= 4);
    assert("G6: approximate_boundary_2_sec ≈ 64 (within 4s)",
        Math.abs((cfs.approximate_boundary_2_sec ?? 99) - 64) <= 4);
} else {
    assert("G1 (posture): resilience_class field present", "resilience_class" in cfs);
    assert("G2 (posture): cross_file_boundary_agreement field present",
        "cross_file_boundary_agreement" in cfs);
}

assert("G7: files_processed = 3",
    cfs.files_processed === 3, `got ${cfs.files_processed}`);

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (wavPresent) {
    console.log(`  (WAV files present at ${WAV_DIR})`);
} else {
    console.log(`  (WAV files absent — some structural assertions skipped)`);
}
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
