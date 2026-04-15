// tests/test_passive_multiscale_evaluation.js
//
// Tests for run_passive_multiscale_evaluation.js
//
// Covers:
//   A. Read-side posture and no authority leakage
//   B. Scale parameter fixtures and algorithm correctness
//   C. Lens metadata
//   D. Output shape — per-scale comparison rows
//   E. Replay comparison across scales (when WAV present)
//   F. Continuous-master comparison surface (when WAV present)
//   G. Distortion-audit rows
//
// Run:
//   node tests/test_passive_multiscale_evaluation.js

import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const REPORT    = path.join(REPO_ROOT, "out_experiments",
    "passive_multiscale_evaluation", "passive_multiscale_report.json");
const WAV_DIR_PRIOR = path.join(REPO_ROOT, "test_signal", "daw_mic_input");
const WAV_DIR_SINE  = path.join(REPO_ROOT, "test_signal", "daw_mic_sine_400hz");

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, detail = "") {
    if (cond) { console.log(`  ✓ ${label}`); passed++; }
    else { const m = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`; console.error(m); failures.push(m); failed++; }
}
function section(name) { console.log(`\n── ${name} ──`); }

let priorPresent = false, sinePresent = false;
try { await access(path.join(WAV_DIR_PRIOR, "baseline_01.wav")); priorPresent = true; } catch (_) {}
try { await access(path.join(WAV_DIR_SINE,  "baseline_01.wav")); sinePresent  = true; } catch (_) {}
const wavPresent = priorPresent && sinePresent;

let report = null;
try { report = JSON.parse(await readFile(REPORT, "utf8")); } catch (_) {}

// ─── Inline helpers ───────────────────────────────────────────────────────────
function normL1(v) { const s = v.reduce((a, x) => a + Math.abs(x), 0); return s === 0 ? v.map(() => 0) : v.map(x => x / s); }
function l1(a, b) { return a.reduce((s, v, i) => s + Math.abs(v - (b[i] ?? 0)), 0); }
function meanArr(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }
function stdArr(a) { const m = meanArr(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length||1)); }

// ════════════════════════════════════════════════════════════════════════════
// A. Read-side posture
// ════════════════════════════════════════════════════════════════════════════
section("A. Read-side posture");

assert("A1: report exists", report != null,
    "run: node scripts/run_passive_multiscale_evaluation.js");
const cp = report?.constitutional_posture ?? {};
assert("A2: runtime_below_canon = true",                   cp.runtime_below_canon === true);
assert("A3: transform_not_upgraded_by_this_script = true", cp.transform_not_upgraded_by_this_script === true);
assert("A4: evaluation_read_side_only = true",             cp.evaluation_read_side_only === true);
assert("A5: passive_declared_lenses_only = true",          cp.passive_declared_lenses_only === true);
assert("A6: no_adaptive_scale_selection = true",           cp.no_adaptive_scale_selection === true);
assert("A7: no_probing_logic = true",                      cp.no_probing_logic === true);
assert("A8: spectral_channel_frozen = true",               cp.spectral_channel_frozen === true);
assert("A9: no_channel_fusion = true",                     cp.no_channel_fusion === true);
assert("A10: no_runtime_authority = true",                 cp.no_runtime_authority === true);
assert("A11: findings_provisional = true",                 cp.findings_provisional === true);

const rStr = JSON.stringify(report ?? {});
assert("A12: no 'canonical' in report",    !rStr.includes('"canonical"'));
assert("A13: no 'truth_label' in report",  !rStr.includes('"truth_label"'));
assert("A14: no 'prediction' in report",   !rStr.includes('"prediction"'));

// key_evaluation_finding
const kef = report?.key_evaluation_finding ?? {};
assert("A15: medium_lens_remains_preferred = true", kef.medium_lens_remains_preferred === true);
assert("A16: no_adaptive_scale_selection in posture", cp.no_adaptive_scale_selection === true);

// ════════════════════════════════════════════════════════════════════════════
// B. Scale parameter fixtures and algorithm
// ════════════════════════════════════════════════════════════════════════════
section("B. Scale parameters and algorithm fixtures");

// Declared scale parameters
const scales = report?.probe_config?.scales ?? [];
assert("B1: 3 scales declared", scales.length === 3);
const scaleNames = scales.map(s => s.name);
assert("B2: scale names are short, medium, long",
    scaleNames.includes("short") && scaleNames.includes("medium") && scaleNames.includes("long"));

const shortS  = scales.find(s => s.name === "short") ?? {};
const medS    = scales.find(s => s.name === "medium") ?? {};
const longS   = scales.find(s => s.name === "long")  ?? {};
assert("B3: short N=64",   shortS.N === 64);
assert("B4: medium N=256", medS.N === 256, `got ${medS.N}`);
assert("B5: long N=1024",  longS.N === 1024);
assert("B6: all hops = N/2 (50% overlap)",
    shortS.hop === 32 && medS.hop === 128 && longS.hop === 512);

// Window durations at TARGET_FS=2400Hz
const TARGET_FS = 2400;
assert("B7: short window_duration ≈ 26.7ms",
    Math.abs(shortS.window_duration_sec - 64/TARGET_FS) < 0.001);
assert("B8: medium window_duration ≈ 106.7ms",
    Math.abs(medS.window_duration_sec - 256/TARGET_FS) < 0.001);
assert("B9: long window_duration ≈ 426.7ms",
    Math.abs(longS.window_duration_sec - 1024/TARGET_FS) < 0.001);

// Bin widths
assert("B10: short bin_width_hz = 37.5Hz (2400/64)",
    Math.abs((shortS.bin_width_hz ?? 0) - TARGET_FS/64) < 0.1);
assert("B11: medium bin_width_hz = 9.375Hz (2400/256)",
    Math.abs((medS.bin_width_hz ?? 0) - TARGET_FS/256) < 0.01);
assert("B12: long bin_width_hz = 2.344Hz (2400/1024)",
    Math.abs((longS.bin_width_hz ?? 0) - TARGET_FS/1024) < 0.01);

// Transform fixed
assert("B13: probe_config transform mentions FFT/Hann",
    report?.probe_config?.transform?.includes("FFT/Hann") === true);

// Scale-range check: long/short = 16× span
assert("B14: scale range is 16× (1024/64=16)",
    longS.N / shortS.N === 16);

// normL1 fixture
const raw = [10, 5, 3, 2];
const normed = normL1(raw);
assert("B15: normL1 sums to 1", Math.abs(normed.reduce((a,b)=>a+b,0)-1) < 1e-12);

// IWV increases at shorter scale (noisier per-window estimates)
// Test with synthetic: random noise profiles should have higher IWV at smaller N
// (indirect: just verify the structural claim holds in the data)
// This is verified in section E.

// ════════════════════════════════════════════════════════════════════════════
// C. Lens metadata
// ════════════════════════════════════════════════════════════════════════════
section("C. Lens metadata");

assert("C1: probe_config has band_edges", Array.isArray(report?.probe_config?.band_edges));
assert("C2: band_edges = [0,300,600,900,1200]",
    JSON.stringify(report?.probe_config?.band_edges) === "[0,300,600,900,1200]");

// Each replay comparison row has lens metadata
const allReplayRows = report?.per_cohort_results?.flatMap(c => c.replay_comparisons ?? []) ?? [];
const lensFields = ["scale_name","lens"];
assert("C3: all replay comparison rows have scale_name and lens",
    allReplayRows.every(r => lensFields.every(f => f in r)));
assert("C4: lens has window_N, hop_N, band_edges, transform",
    allReplayRows.every(r =>
        ["window_N","hop_N","band_edges","transform"].every(f => f in (r.lens ?? {}))));
assert("C5: derived_posture declared in lens",
    allReplayRows.every(r => typeof r.lens?.derived_posture === "string" && r.lens.derived_posture.includes("not")));

// Scale-specific lens fields
for (const r of allReplayRows) {
    const s = scales.find(s => s.name === r.scale_name);
    if (s) {
        assert(`C6: window_N matches scale for ${r.scale_name}`,
            r.lens?.window_N === s.N);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// D. Output shape
// ════════════════════════════════════════════════════════════════════════════
section("D. Output shape");

assert("D1: 2 cohort results", report?.per_cohort_results?.length === 2);
const cohortResults = report?.per_cohort_results ?? [];

assert("D2: each cohort has 3 replay_comparisons (one per scale)",
    cohortResults.every(c => (c.replay_comparisons ?? []).length === 3));
assert("D3: each cohort has cross_scale_summary",
    cohortResults.every(c => "cross_scale_summary" in c));
assert("D4: each cohort has distortion_audit",
    cohortResults.every(c => "distortion_audit" in c));

// Replay comparison required fields
const rcFields = ["scale_name","bVsP","bVsR","return_closer","perturbation_class","baseline","perturbation","return"];
assert("D5: replay comparison rows have required fields",
    allReplayRows.every(r => rcFields.every(f => f in r)));

// Cross-scale summary required fields
const csFields = ["bVsP_by_scale","bVsR_by_scale","return_closer_all_scales",
    "support_class_by_scale","support_class_consistent","best_sep_scale","spurious_ruptures_by_scale",
    "temporal_smearing_observed","interpretation"];
assert("D6: cross_scale_summary has required fields",
    cohortResults.every(c => csFields.every(f => f in (c.cross_scale_summary ?? {}))));

// ════════════════════════════════════════════════════════════════════════════
// E. Replay comparison across scales (when WAV present)
// ════════════════════════════════════════════════════════════════════════════
section("E. Replay comparison across scales");

if (wavPresent) {
    console.log(`\n  (WAV files present — running structural assertions)`);

    for (const c of cohortResults) {
        const rc     = c.replay_comparisons ?? [];
        const shortR = rc.find(r => r.scale_name === "short");
        const medR   = rc.find(r => r.scale_name === "medium");
        const longR  = rc.find(r => r.scale_name === "long");

        // Return convergence preserved at ALL scales
        assert(`E1 (${c.cohort_family}): return_closer = true at all 3 scales`,
            rc.every(r => r.return_closer === true));

        // Support class consistent across scales
        assert(`E2 (${c.cohort_family}): support_class_consistent = true`,
            c.cross_scale_summary?.support_class_consistent === true);

        // Short lens has higher IWV than medium
        const shortIWV = shortR?.baseline?.mean_iwv ?? 0;
        const medIWV   = medR?.baseline?.mean_iwv   ?? 1;
        assert(`E3 (${c.cohort_family}): short lens IWV > medium IWV (noisier at N=64)`,
            shortIWV > medIWV, `short=${shortIWV.toFixed(4)} med=${medIWV.toFixed(4)}`);

        // Long lens IWV < medium IWV (smoother)
        const longIWV = longR?.baseline?.mean_iwv ?? 1;
        assert(`E4 (${c.cohort_family}): long lens IWV < medium IWV (smoother at N=1024)`,
            longIWV < medIWV, `long=${longIWV.toFixed(4)} med=${medIWV.toFixed(4)}`);

        // Phase separability: short <= medium <= long (monotone with scale)
        const shortSep = shortR?.bVsP ?? 0;
        const medSep   = medR?.bVsP   ?? 0;
        const longSep  = longR?.bVsP  ?? 0;
        assert(`E5 (${c.cohort_family}): separability non-decreasing with scale (short <= medium <= long)`,
            shortSep <= medSep + 0.005 && medSep <= longSep + 0.005,
            `short=${shortSep.toFixed(4)} med=${medSep.toFixed(4)} long=${longSep.toFixed(4)}`);

        // Phase separation exists at all scales (no scale loses the distinction)
        assert(`E6 (${c.cohort_family}): bVsP > bVsR at all scales (perturbation distinct from baseline)`,
            rc.every(r => (r.bVsP ?? 0) > (r.bVsR ?? 1)));

        // bVsP_by_scale and bVsR_by_scale present
        assert(`E7 (${c.cohort_family}): cross_scale bVsP_by_scale has short, medium, long`,
            ["short","medium","long"].every(k => k in (c.cross_scale_summary?.bVsP_by_scale ?? {})));
    }

    // Sine cohort: concentration_high preserved at all scales
    const sineC = cohortResults.find(c => c.cohort_family.includes("sine"));
    assert("E8 (sine): concentration_high preserved at all 3 scales",
        (sineC?.replay_comparisons ?? []).every(r => r.perturbation_class === "concentration_high"));

    // Prior cohort: redistribution_broad preserved at all scales
    const priorC = cohortResults.find(c => c.cohort_family === "daw_mic_input");
    assert("E9 (prior): redistribution_broad preserved at all 3 scales",
        (priorC?.replay_comparisons ?? []).every(r => r.perturbation_class === "redistribution_broad"));
} else {
    console.log(`\n  (WAV files absent — skipping structural assertions)`);
    assert("E1 (posture): bVsP present on all replay rows",
        allReplayRows.every(r => typeof r.bVsP === "number"));
}

// ════════════════════════════════════════════════════════════════════════════
// F. Continuous-master comparison surface (when WAV present)
// ════════════════════════════════════════════════════════════════════════════
section("F. Continuous-master comparison");

if (wavPresent) {
    for (const c of cohortResults) {
        const mc = c.master_comparisons ?? {};
        // Each scale has 3 master results
        for (const scaleName of ["short","medium","long"]) {
            const rows = mc[scaleName] ?? [];
            assert(`F1 (${c.cohort_family}/${scaleName}): 3 master results`,
                rows.filter(r=>!r.error).length >= 3, `got ${rows.length}`);

            // All ruptures detected at expected t (within 2 seg durations)
            for (const mr of rows.filter(r=>!r.error)) {
                assert(`F2 (${c.cohort_family}/${scaleName}/${mr.filename}): strongest boundary L1 > 0.20`,
                    (mr.strongest?.score ?? 0) >= 0.20,
                    `L1=${mr.strongest?.score}`);
            }
        }

        // Long lens temporal smearing ONLY fires for the sine family
        // (broadband smearing is at ingress-class level, not rupture-class at t=44s equivalent)
        if (c.cohort_family.includes("sine")) {
            const sineSmearing = (c.master_comparisons?.long ?? []).some(r => r.temporal_smearing_risk?.length > 0);
            assert(`F3 (sine): temporal smearing observed at long lens`,
                sineSmearing, "expected smearing at N=1024 for sine_400hz family");
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════
// G. Distortion-audit rows
// ════════════════════════════════════════════════════════════════════════════
section("G. Distortion-audit rows");

const auditFields = ["audit_id","layer_name","intended_role","must_preserve","must_not_decide",
    "observed_flattening","evidence_of_distortion","distortion_class","lens_conditions",
    "preserved_distinctions","collapsed_distinctions","severity","recommended_action",
    "downstream_impact","scale_recommendation"];
assert("G1: all required audit fields present",
    cohortResults.every(c => auditFields.every(f => f in (c.distortion_audit ?? {}))));

// severity and recommended_action are objects with short, medium, long subfields
assert("G2: severity has short, medium, long subfields",
    cohortResults.every(c => ["short","medium","long"].every(k => k in (c.distortion_audit?.severity ?? {}))));
assert("G3: recommended_action has short, medium, long subfields",
    cohortResults.every(c => ["short","medium","long"].every(k => k in (c.distortion_audit?.recommended_action ?? {}))));

// severity can be "low", "moderate", "high", "critical", or "none ..." (e.g. "none — reference baseline")
const validSeverities = new Set(["low","moderate","high","critical","none"]);
function isValidSeverity(v) { return validSeverities.has(v) || (typeof v === "string" && v.startsWith("none")); }
const validActions    = new Set(["keep_as_is","clarify_language_only","add_unresolved_posture",
    "add_read_side_probe","refine_summary_surface","refine_operator_contract","defer_pending_more_evidence"]);
assert("G4: severity values are valid",
    cohortResults.every(c => Object.values(c.distortion_audit?.severity ?? {}).every(v => isValidSeverity(v))));
assert("G5: recommended_action values are valid",
    cohortResults.every(c => Object.values(c.distortion_audit?.recommended_action ?? {}).every(v => validActions.has(v))));

// Medium lens = keep_as_is
assert("G6: medium lens recommended_action = keep_as_is for all cohorts",
    cohortResults.every(c => c.distortion_audit?.recommended_action?.medium === "keep_as_is"));

// Short lens is moderate severity (IWV noise)
assert("G7: short lens severity = moderate for all cohorts",
    cohortResults.every(c => c.distortion_audit?.severity?.short === "moderate"),
    `severities: ${cohortResults.map(c=>c.distortion_audit?.severity?.short).join(",")}`);

// Lens conditions has all 3 scales
assert("G8: lens_conditions has short, medium, long entries",
    cohortResults.every(c => ["short","medium","long"].every(k => k in (c.distortion_audit?.lens_conditions ?? {}))));

// No prohibited language in audit
const auditStr = JSON.stringify(cohortResults.map(c => c.distortion_audit) ?? []);
assert("G9: no 'canonical' in distortion audits",    !auditStr.includes('"canonical"'));
assert("G10: no 'truth_label' in distortion audits", !auditStr.includes('"truth_label"'));
assert("G11: no 'validated' in distortion audits",   !auditStr.includes('"validated"'));

// scale_recommendation is present and non-empty
assert("G12: scale_recommendation present and non-empty",
    cohortResults.every(c => typeof c.distortion_audit?.scale_recommendation === "string" &&
        c.distortion_audit.scale_recommendation.length > 20));

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (wavPresent) console.log("  (Both WAV cohorts present — full structural assertions run)");
else console.log("  (WAV files absent — structural assertions skipped)");
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
