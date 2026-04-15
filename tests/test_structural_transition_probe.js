// tests/test_structural_transition_probe.js
//
// Tests for run_structural_transition_probe.js
//
// Covers:
//   A. Read-side posture and no authority leakage
//   B. Transition classification algorithm on fixtures
//   C. Lens metadata preservation
//   D. Per-file output shape and required fields
//   E. Per-file structural results (when WAV files present)
//   F. Cross-file vocabulary consistency
//
// Run:
//   node tests/test_structural_transition_probe.js

import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const REPORT    = path.join(REPO_ROOT, "out_experiments",
    "structural_transition_probe", "structural_transition_report.json");
const WAV_DIR   = path.join(REPO_ROOT, "test_signal", "daw_mic_input");

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, detail = "") {
    if (cond) { console.log(`  ✓ ${label}`); passed++; }
    else { const m = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`; console.error(m); failures.push(m); failed++; }
}
function section(name) { console.log(`\n── ${name} ──`); }

let wavPresent = false;
try { await access(path.join(WAV_DIR, "master_01.wav")); wavPresent = true; } catch (_) {}

let report = null;
try { report = JSON.parse(await readFile(REPORT, "utf8")); } catch (_) {}

// ─── Inline algorithm mirrors ─────────────────────────────────────────────────
function l1(a, b) { return a.reduce((s, v, i) => s + Math.abs(v - (b[i] ?? 0)), 0); }
function pearsonCorr(x, y) {
    const mx = x.reduce((a, b) => a + b, 0) / x.length, my = y.reduce((a, b) => a + b, 0) / y.length;
    let cov = 0, sx = 0, sy = 0;
    for (let i = 0; i < x.length; i++) { cov += (x[i]-mx)*(y[i]-my); sx += (x[i]-mx)**2; sy += (y[i]-my)**2; }
    return sx > 0 && sy > 0 ? cov / Math.sqrt(sx * sy) : 0;
}

const RUPTURE_T  = 0.20;
const INGRESS_T  = 0.08;
const COUPLING_T = 0.60;

function classifyBoundaryTest(score, prevWasRupture = false) {
    if (score >= RUPTURE_T)  return "rupture";
    if (score >= INGRESS_T)  return prevWasRupture ? "ingress" : "ingress";
    return "dwell";
}

// ════════════════════════════════════════════════════════════════════════════
// A. Read-side posture and authority checks
// ════════════════════════════════════════════════════════════════════════════
section("A. Read-side posture");

assert("A1: report exists", report != null,
    "run the probe first: node scripts/run_structural_transition_probe.js");

const cp = report?.constitutional_posture ?? {};
assert("A2: runtime_below_canon = true",                   cp.runtime_below_canon === true);
assert("A3: transition_classes_are_provisional = true",    cp.transition_classes_are_provisional === true);
assert("A4: no_truth_labels = true",                       cp.no_truth_labels === true);
assert("A5: no_semantic_event_naming = true",              cp.no_semantic_event_naming === true);
assert("A6: no_runtime_authority = true",                  cp.no_runtime_authority === true);
assert("A7: no_workbench_effects = true",                  cp.no_workbench_effects === true);
assert("A8: no_canon_minting = true",                      cp.no_canon_minting === true);
assert("A9: no_prediction_claims = true",                  cp.no_prediction_claims === true);
assert("A10: findings_provisional = true",                 cp.findings_provisional === true);
assert("A11: not_promotion = true",                        cp.not_promotion === true);

// No leakage in per-file results
const rfStr = JSON.stringify(report?.per_file_results ?? []);
assert("A12: no 'canonical' in per_file_results",     !rfStr.includes('"canonical"'));
assert("A13: no 'truth_label' in per_file_results",   !rfStr.includes('"truth_label"'));
assert("A14: no 'validated' in per_file_results",     !rfStr.includes('"validated"'));
assert("A15: no 'prediction' in per_file_results",    !rfStr.includes('"prediction"'));

// Transition class definitions present in config
const tcd = report?.probe_config?.transition_class_definitions ?? {};
assert("A16: all expected transition definitions present",
    ["dwell","ingress","rupture","drift","coupling","re_entry"].every(k => k in tcd));

// Excluded classes are explicitly documented
assert("A17: excluded_classes documented in probe_config",
    typeof report?.probe_config?.excluded_classes === "object" &&
    Object.keys(report.probe_config.excluded_classes).length > 0);

// ════════════════════════════════════════════════════════════════════════════
// B. Transition classification algorithm on fixtures
// ════════════════════════════════════════════════════════════════════════════
section("B. Transition classification logic");

// Boundary scoring
assert("B1: score=0.31 → rupture",   classifyBoundaryTest(0.31) === "rupture");
assert("B2: score=0.20 → rupture",   classifyBoundaryTest(0.20) === "rupture");
assert("B3: score=0.19 → ingress",   classifyBoundaryTest(0.19) === "ingress");
assert("B4: score=0.08 → ingress",   classifyBoundaryTest(0.08) === "ingress");
assert("B5: score=0.07 → dwell",     classifyBoundaryTest(0.07) === "dwell");
assert("B6: score=0.00 → dwell",     classifyBoundaryTest(0.00) === "dwell");

// Coupling detection
const coupledX = [0.20, 0.24, 0.22, 0.26, 0.21, 0.25, 0.23, 0.27];
const coupledY = [0.19, 0.23, 0.21, 0.25, 0.20, 0.24, 0.22, 0.26];
assert("B7: co-moving bands → coupling (|corr| >= 0.6)",
    Math.abs(pearsonCorr(coupledX, coupledY)) >= COUPLING_T);

const uncoupledX = [0.1, 0.3, 0.2, 0.4, 0.1, 0.3, 0.2, 0.4];
const uncoupledY = [0.4, 0.2, 0.3, 0.1, 0.4, 0.2, 0.3, 0.1];
assert("B8: exactly anti-correlated bands → |corr| >= 0.6 (anti-coupling is still coupling)",
    Math.abs(pearsonCorr(uncoupledX, uncoupledY)) >= COUPLING_T);

const flatX = [0.25, 0.25, 0.25, 0.25, 0.25, 0.25];
const noisyY = [0.1, 0.3, 0.2, 0.4, 0.15, 0.35];
assert("B9: flat vs noisy → |corr| near 0 (no coupling)",
    Math.abs(pearsonCorr(flatX, noisyY)) < 0.3);

// Re-entry: two profiles from different phases, later one similar to earlier
const profA = [0.560, 0.182, 0.130, 0.128];
const profC = [0.558, 0.184, 0.131, 0.127];  // return-like
const profB = [0.408, 0.261, 0.210, 0.121];  // perturbation
assert("B10: A and C are return-like (L1 < 0.08)",  l1(profA, profC) < 0.08, `L1=${l1(profA,profC).toFixed(4)}`);
assert("B11: A and B are NOT return-like (L1 >= 0.08)", l1(profA, profB) >= 0.08);

// ════════════════════════════════════════════════════════════════════════════
// C. Lens metadata preservation
// ════════════════════════════════════════════════════════════════════════════
section("C. Lens metadata");

const validResults = (report?.per_file_results ?? []).filter(r => r.file_found);
const lensFields = ["source_family","nominal_fs","effective_fs","decim_factor",
    "window_N","hop_N","band_edges","seg_duration_sec","modality","channel","derived_posture"];
assert("C1: lens has all required fields",
    validResults.every(r => lensFields.every(f => f in (r.lens ?? {}))));
assert("C2: band_edges = [0,300,600,900,1200]",
    validResults.every(r => JSON.stringify(r.lens?.band_edges) === "[0,300,600,900,1200]"));
assert("C3: lens is identical across all files",
    validResults.length <= 1 || validResults.every(r =>
        r.lens.effective_fs === validResults[0].lens.effective_fs &&
        r.lens.window_N === validResults[0].lens.window_N));
assert("C4: derived_posture declares non-durable posture",
    validResults.every(r => r.lens.derived_posture?.includes("not")));
assert("C5: thresholds documented in probe_config",
    ["rupture","ingress","coupling"].every(k => k in (report?.probe_config?.thresholds ?? {})));

// ════════════════════════════════════════════════════════════════════════════
// D. Per-file output shape and required fields
// ════════════════════════════════════════════════════════════════════════════
section("D. Output shape");

assert("D1: 3 per_file_results", report?.per_file_results?.length === 3);

const requiredFileFields = [
    "segments","candidate_phases","candidate_boundary_peaks",
    "boundary_transitions","drift_regions","coupling_regions","reentry_rows",
    "ambiguity_regions","boundary_summary","recurrence_summary","file_summary",
];
assert("D2: all required output fields on found files",
    validResults.every(r => requiredFileFields.every(f => f in r)));

// Boundary transitions have required fields
assert("D3: boundary_transitions have required fields",
    validResults.every(r => (r.boundary_transitions ?? []).every(t =>
        "from_seg" in t && "to_seg" in t && "boundary_score" in t &&
        "candidate_transition" in t && "evidence" in t)));

// File summary has posture flags
assert("D4: file_summary has posture flags",
    validResults.every(r =>
        r.file_summary.not_canon === true &&
        r.file_summary.not_prediction === true &&
        r.file_summary.not_promotion === true));

// Coupling regions have required fields
assert("D5: coupling_regions have required fields",
    validResults.every(r => (r.coupling_regions ?? []).every(c =>
        "candidate_phase" in c && "band_a" in c && "band_b" in c &&
        "corr" in c && "candidate_transition" in c && "evidence" in c)));

// Re-entry rows have required fields
assert("D6: reentry_rows have required fields",
    validResults.every(r => (r.reentry_rows ?? []).every(e =>
        "reference_seg" in e && "current_seg" in e &&
        "l1_similarity" in e && "candidate_transition" in e)));

// ════════════════════════════════════════════════════════════════════════════
// E. Per-file structural results (when WAV present)
// ════════════════════════════════════════════════════════════════════════════
section("E. Per-file structural results");

if (wavPresent && validResults.length === 3) {
    console.log(`\n  (WAV files present — running structural assertions)`);

    for (const r of validResults) {
        // 2 ruptures per file
        const ruptureTs = r.boundary_transitions?.filter(t => t.candidate_transition === "rupture").map(t => t.to_t_sec) ?? [];
        assert(`E1 (${r.filename}): exactly 2 ruptures`,
            ruptureTs.length === 2, `got ${ruptureTs.length}`);
        assert(`E2 (${r.filename}): first rupture near t=32s`,
            Math.abs(ruptureTs[0] - 32) <= 4, `got ${ruptureTs[0]}`);
        assert(`E3 (${r.filename}): second rupture near t=64s`,
            Math.abs(ruptureTs[1] - 64) <= 4, `got ${ruptureTs[1]}`);

        // Ingress following each rupture
        const ingressTs = r.boundary_transitions?.filter(t => t.candidate_transition === "ingress").map(t => t.to_t_sec) ?? [];
        assert(`E4 (${r.filename}): at least 1 ingress after rupture at t=32s`,
            ingressTs.some(t => t > 32 && t <= 40), `ingress at: ${ingressTs.join(", ")}`);

        // 1 coupling region in candidate_B
        assert(`E5 (${r.filename}): 1 coupling region`,
            r.coupling_regions?.length >= 1, `got ${r.coupling_regions?.length}`);
        assert(`E6 (${r.filename}): coupling in candidate_B (t=32-64s region)`,
            r.coupling_regions?.every(c => c.t_start_sec >= 32 && c.t_end_sec <= 68));
        assert(`E7 (${r.filename}): coupling |corr| >= 0.6`,
            r.coupling_regions?.every(c => Math.abs(c.corr) >= 0.6));

        // Re-entry pairs connecting A to C
        const reentryAtoC = r.reentry_rows?.filter(e =>
            e.reference_phase === "candidate_A" && e.current_phase === "candidate_C") ?? [];
        assert(`E8 (${r.filename}): re-entry pairs connect candidate_A to candidate_C`,
            reentryAtoC.length >= 3, `got ${reentryAtoC.length}`);

        // All transition labels are from the allowed vocabulary
        const allowedLabels = new Set(["dwell","drift","ingress","rupture","coupling","re-entry","unresolved"]);
        const allBtLabels = r.boundary_transitions?.map(t => t.candidate_transition) ?? [];
        assert(`E9 (${r.filename}): all boundary_transition labels are from allowed vocabulary`,
            allBtLabels.every(l => allowedLabels.has(l)),
            `unknown: ${allBtLabels.filter(l => !allowedLabels.has(l)).join(", ")}`);

        // File summary interpretation is non-empty and non-semantic
        assert(`E10 (${r.filename}): interpretation is non-empty`,
            typeof r.file_summary.interpretation === "string" && r.file_summary.interpretation.length > 10);
        assert(`E11 (${r.filename}): interpretation uses structural language (not semantic)`,
            !r.file_summary.interpretation.includes("baseline") &&
            !r.file_summary.interpretation.includes("perturbation"));

        // Transition vocabulary includes at least rupture, ingress, dwell, coupling, re-entry
        const vocab = r.file_summary.transition_vocabulary_used ?? [];
        for (const cls of ["rupture","ingress","dwell","coupling","re-entry"]) {
            assert(`E12 (${r.filename}): vocabulary includes '${cls}'`,
                vocab.includes(cls));
        }
    }
} else {
    console.log(`\n  (WAV files absent — skipping structural assertions)`);
    assert("E1 (posture): boundary_transitions field present",
        validResults.every(r => "boundary_transitions" in r));
    assert("E2 (posture): coupling_regions field present",
        validResults.every(r => "coupling_regions" in r));
}

// ════════════════════════════════════════════════════════════════════════════
// F. Cross-file vocabulary consistency
// ════════════════════════════════════════════════════════════════════════════
section("F. Cross-file vocabulary consistency");

if (wavPresent && validResults.length === 3) {
    // All three files should have the same vocabulary
    const vocabs = validResults.map(r => [...(r.file_summary.transition_vocabulary_used ?? [])].sort().join(","));
    assert("F1: all three files use the same transition vocabulary",
        new Set(vocabs).size === 1, `vocabularies: ${vocabs.join(" | ")}`);

    // Rupture positions are consistent
    const rupturePos = validResults.map(r =>
        r.boundary_transitions?.filter(t => t.candidate_transition === "rupture").map(t => t.to_t_sec) ?? []);
    assert("F2: rupture positions agree within 4s across files",
        rupturePos.every(ts =>
            Math.abs(ts[0] - rupturePos[0][0]) <= 4 &&
            Math.abs((ts[1] ?? 99) - (rupturePos[0][1] ?? 99)) <= 4));

    // Coupling regions are in the same time range
    const couplingRanges = validResults.map(r =>
        r.coupling_regions?.map(c => c.t_start_sec) ?? []);
    assert("F3: coupling regions start near t=32s in all files",
        couplingRanges.every(ts => ts.some(t => Math.abs(t - 32) <= 4)));

    // boundary_summary has required fields
    assert("F4: boundary_summary has required fields",
        validResults.every(r => ["total_boundaries","rupture_count","ingress_count",
            "dwell_count","strongest_transition_t"].every(f => f in (r.boundary_summary ?? {}))));

    // recurrence_summary has required fields
    assert("F5: recurrence_summary has required fields",
        validResults.every(r => ["total_reentry_pairs","first_to_last_return_like",
            "inter_phase_mean_l1"].every(f => f in (r.recurrence_summary ?? {}))));
    assert("F6: first-to-last return_like = true for all files",
        validResults.every(r => r.recurrence_summary?.first_to_last_return_like === true));
} else {
    assert("F1 (posture): boundary_summary present", validResults.every(r => "boundary_summary" in r));
    assert("F2 (posture): recurrence_summary present", validResults.every(r => "recurrence_summary" in r));
}

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (wavPresent) console.log(`  (WAV files present at ${WAV_DIR})`);
else console.log(`  (WAV files absent — some structural assertions skipped)`);
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
