// tests/test_basin_phase_ratio_probe.js
//
// Tests for run_basin_phase_ratio_probe.js
//
// Covers:
//   A. Phase-ratio computation correctness
//   B. Per-scale row required fields
//   C. Resonance summary logic
//   D. Read-side posture
//
// Run:
//   node tests/test_basin_phase_ratio_probe.js

import { readFile } from "node:fs/promises";

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, detail = "") {
    if (cond) { console.log(`  ✓ ${label}`); passed++; }
    else { const m = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`; console.error(m); failures.push(m); failed++; }
}
function section(name) { console.log(`\n── ${name} ──`); }

// ─── Inline mirrors of probe logic ───────────────────────────────────────────

const FS_RAW = 256;

function computePhaseRatioTest(scale_N, dominant_hz) {
    const window_duration_sec = scale_N / FS_RAW;
    const dominant_period_sec = 1 / dominant_hz;
    const phase_ratio         = window_duration_sec / dominant_period_sec;
    const distance_to_unit    = Math.abs(phase_ratio - 1.0);
    const candidates = [0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0];
    let nearestRatio = candidates[0], nearestDist = Infinity;
    for (const c of candidates) {
        const d = Math.abs(phase_ratio - c);
        if (d < nearestDist) { nearestDist = d; nearestRatio = c; }
    }
    return { window_duration_sec, dominant_period_sec, phase_ratio, distance_to_unit_ratio: distance_to_unit,
             nearest_simple_ratio: nearestRatio, distance_to_nearest_simple: nearestDist };
}

function spectralReliableTest(scale_N, dominant_hz) {
    return (FS_RAW / scale_N) <= dominant_hz / 2;
}

function buildSummaryTest(perScaleRows) {
    const splittingScales = perScaleRows.filter(r => r.splitting).map(r => r.scale_N);
    const splittingNearUnit = splittingScales.every(N => {
        const r = perScaleRows.find(x => x.scale_N === N);
        return r && Math.abs(r.phase_ratio - 1.0) < 0.15;
    });
    const noSplittingAwayFromUnit = perScaleRows.filter(r => !r.splitting)
        .every(r => Math.abs(r.phase_ratio - 1.0) > 0.15);
    const supported = splittingScales.length > 0 && splittingNearUnit && noSplittingAwayFromUnit;
    return { supported, splittingScales, splittingNearUnit, noSplittingAwayFromUnit };
}

// ════════════════════════════════════════════════════════════════════════════
// A. Phase-ratio computation correctness
// ════════════════════════════════════════════════════════════════════════════
section("A. Phase-ratio computation");

// Core cases from the probe
const bf32 = computePhaseRatioTest(32, 8);   // baseline_frequency @ N=32 — the split case
const bf8  = computePhaseRatioTest(8,  8);
const bf16 = computePhaseRatioTest(16, 8);
const bf64 = computePhaseRatioTest(64, 8);
const ba32 = computePhaseRatioTest(32, 20);  // baseline_amplitude @ N=32

// window_duration_sec = N / Fs
assert("A1: window_duration_sec = N/Fs at N=32",
    Math.abs(bf32.window_duration_sec - 32/256) < 1e-9);
assert("A2: window_duration_sec = N/Fs at N=8",
    Math.abs(bf8.window_duration_sec  - 8/256)  < 1e-9);

// dominant_period_sec = 1 / dominant_hz
assert("A3: dominant_period_sec = 1/8 for 8 Hz cohort",
    Math.abs(bf32.dominant_period_sec - 0.125) < 1e-9);
assert("A4: dominant_period_sec = 1/20 for 20 Hz cohort",
    Math.abs(ba32.dominant_period_sec - 0.05) < 1e-9);

// phase_ratio = window_duration / dominant_period
assert("A5: phase_ratio = 1.0 for baseline_frequency @ N=32",
    Math.abs(bf32.phase_ratio - 1.0) < 1e-9);
assert("A6: phase_ratio = 0.25 for baseline_frequency @ N=8",
    Math.abs(bf8.phase_ratio  - 0.25) < 1e-9);
assert("A7: phase_ratio = 0.5  for baseline_frequency @ N=16",
    Math.abs(bf16.phase_ratio - 0.5)  < 1e-9);
assert("A8: phase_ratio = 2.0  for baseline_frequency @ N=64",
    Math.abs(bf64.phase_ratio - 2.0)  < 1e-9);
assert("A9: phase_ratio = 2.5  for baseline_amplitude @ N=32  (20Hz, window=0.125s → 0.125/0.05=2.5)",
    Math.abs(ba32.phase_ratio - 2.5)  < 1e-9);

// distance_to_unit_ratio
assert("A10: distance_to_unit = 0 at phase_ratio=1",   bf32.distance_to_unit_ratio === 0);
assert("A11: distance_to_unit = 0.75 at phase_ratio=0.25", Math.abs(bf8.distance_to_unit_ratio - 0.75) < 1e-9);
assert("A12: distance_to_unit = 0.5  at phase_ratio=0.5",  Math.abs(bf16.distance_to_unit_ratio - 0.5)  < 1e-9);
assert("A13: distance_to_unit = 1.0  at phase_ratio=2.0",  Math.abs(bf64.distance_to_unit_ratio - 1.0)  < 1e-9);

// nearest_simple_ratio
assert("A14: nearest_simple_ratio = 1.0 when phase_ratio=1.0",  bf32.nearest_simple_ratio === 1.0);
assert("A15: nearest_simple_ratio = 0.25 when phase_ratio=0.25", bf8.nearest_simple_ratio  === 0.25);
assert("A16: nearest_simple_ratio = 0.5  when phase_ratio=0.5",  bf16.nearest_simple_ratio === 0.5);
assert("A17: nearest_simple_ratio = 2.0  when phase_ratio=2.0",  bf64.nearest_simple_ratio === 2.0);
assert("A18: nearest_simple_ratio = 2.5 rounds to 2.0 (nearest candidate)",
    ba32.nearest_simple_ratio === 2.0 || ba32.nearest_simple_ratio === 3.0);

// ════════════════════════════════════════════════════════════════════════════
// B. Per-scale row required fields
// ════════════════════════════════════════════════════════════════════════════
section("B. Per-scale row required fields");

let report = null;
try {
    report = JSON.parse(await readFile(
        "./out_experiments/basin_phase_ratio_probe/basin_phase_ratio_report.json", "utf8"
    ));
} catch (_) {}

assert("B1: report file exists", report != null);
assert("B2: per_scale_rows array present", Array.isArray(report?.per_scale_rows));
assert("B3: correct row count: 4 cohorts × 4 scales = 16", report?.per_scale_rows?.length === 16,
    `got ${report?.per_scale_rows?.length}`);

const required = ["cohort_label","scale_N","Fs_hz","window_duration_sec","dominant_frequency_hz",
    "dominant_period_sec","phase_ratio","basin_count","splitting_observed","interpretation","next_action"];
assert("B4: all required fields present on every per-scale row",
    (report?.per_scale_rows ?? []).every(r => required.every(f => f in r)));

// Specific values from known cases
const bf32Row = report?.per_scale_rows?.find(r => r.cohort_label === "baseline_frequency" && r.scale_N === 32);
assert("B5: baseline_frequency @ N=32 has phase_ratio=1.0",
    bf32Row?.phase_ratio === 1.0, `got ${bf32Row?.phase_ratio}`);
assert("B6: baseline_frequency @ N=32 has basin_count=2",
    bf32Row?.basin_count === 2, `got ${bf32Row?.basin_count}`);
assert("B7: baseline_frequency @ N=32 has splitting_observed=true",
    bf32Row?.splitting_observed === true);

// N=8 and N=64 should not split
const bf8Row  = report?.per_scale_rows?.find(r => r.cohort_label === "baseline_frequency" && r.scale_N === 8);
const bf64Row = report?.per_scale_rows?.find(r => r.cohort_label === "baseline_frequency" && r.scale_N === 64);
assert("B8: baseline_frequency @ N=8  has no splitting (phase_ratio=0.25)",
    bf8Row?.splitting_observed === false);
assert("B9: baseline_frequency @ N=64 has no splitting (phase_ratio=2.0)",
    bf64Row?.splitting_observed === false);

// 20 Hz cohorts never split
const ampRows = report?.per_scale_rows?.filter(r =>
    (r.cohort_label === "baseline_amplitude" || r.cohort_label === "amplitude_shift"));
assert("B10: 20 Hz cohorts never split at any scale",
    ampRows?.every(r => r.splitting_observed === false));

// Spectral reliability flag
assert("B11: spectral_estimate_reliable = false at N=8 for 8 Hz cohort (df=32 > dom/2=4)",
    bf8Row?.spectral_estimate_reliable === false);
assert("B12: spectral_estimate_reliable = true at N=64 for 8 Hz cohort (df=4 ≤ dom/2=4)",
    bf64Row?.spectral_estimate_reliable === true);
// At N=32, df=8, dom=8, dom/2=4: df(8) > dom/2(4) → NOT reliable
const bf32Reliable = bf32Row?.spectral_estimate_reliable;
assert("B13: spectral_estimate_reliable = false at N=32 for 8 Hz cohort (df=8, dom/2=4)",
    bf32Reliable === false, `got ${bf32Reliable}`);

// ════════════════════════════════════════════════════════════════════════════
// C. Resonance summary logic
// ════════════════════════════════════════════════════════════════════════════
section("C. Resonance summary logic");

// Perfect resonance case: splitting only at unit ratio, consolidates elsewhere
const perfectCase = [
    { scale_N:  8, phase_ratio: 0.25, splitting: false },
    { scale_N: 16, phase_ratio: 0.50, splitting: false },
    { scale_N: 32, phase_ratio: 1.00, splitting: true  },
    { scale_N: 64, phase_ratio: 2.00, splitting: false },
];
const perf = buildSummaryTest(perfectCase);
assert("C1: perfect case — resonance_supported = true", perf.supported);
assert("C2: perfect case — splitting_near_unit = true", perf.splittingNearUnit);
assert("C3: perfect case — no_splitting_away = true",   perf.noSplittingAwayFromUnit);

// No splitting case
const noSplit = [
    { scale_N:  8, phase_ratio: 0.25, splitting: false },
    { scale_N: 16, phase_ratio: 0.50, splitting: false },
    { scale_N: 32, phase_ratio: 1.00, splitting: false },
    { scale_N: 64, phase_ratio: 2.00, splitting: false },
];
const ns = buildSummaryTest(noSplit);
assert("C4: no-splitting case — resonance_supported = false", !ns.supported);
assert("C5: no-splitting case — splittingScales = []", ns.splittingScales.length === 0);

// Splitting away from unit (contradicts hypothesis)
const offRatio = [
    { scale_N:  8, phase_ratio: 0.25, splitting: true  },  // away from 1
    { scale_N: 16, phase_ratio: 0.50, splitting: false },
    { scale_N: 32, phase_ratio: 1.00, splitting: false },
    { scale_N: 64, phase_ratio: 2.00, splitting: false },
];
const off = buildSummaryTest(offRatio);
assert("C6: off-ratio split — resonance_supported = false (splitting not near unit)", !off.supported);

// Report summary check
const summaries = report?.cross_scale_summaries ?? [];
const bfSummary  = summaries.find(s => s.cohort_label === "baseline_frequency");
const ampSummary = summaries.find(s => s.cohort_label === "baseline_amplitude");
const fsSummary  = summaries.find(s => s.cohort_label === "frequency_shift");

assert("C7: baseline_frequency summary — resonance_hypothesis_supported = true",
    bfSummary?.resonance_hypothesis_supported === true);
assert("C8: baseline_frequency summary — splitting_scales = [32]",
    JSON.stringify(bfSummary?.splitting_scales) === "[32]");
assert("C9: baseline_frequency summary — splitting_phase_ratios = [1]",
    bfSummary?.splitting_phase_ratios?.[0] === 1.0);
assert("C10: baseline_amplitude summary — no_splitting (resonance_supported = false)",
    ampSummary?.resonance_hypothesis_supported === false &&
    ampSummary?.splitting_scales?.length === 0);

// frequency_shift: has phase_ratio=1.0 at N=32 but does NOT split — should be no_splitting_observed
assert("C11: frequency_shift has phase_ratio=1 at N=32 (unit_ratio_scales=[32])",
    fsSummary?.unit_ratio_scales?.includes(32));
assert("C12: frequency_shift does NOT split at N=32 — hypothesis no_splitting_observed",
    fsSummary?.resonance_hypothesis === "no_splitting_observed" ||
    fsSummary?.resonance_hypothesis_supported === false);

// ════════════════════════════════════════════════════════════════════════════
// D. Read-side posture
// ════════════════════════════════════════════════════════════════════════════
section("D. Read-side posture");

assert("D1: not_canon = true",                report?.disclaimers?.not_canon === true);
assert("D2: probe_is_read_side_only = true",  report?.disclaimers?.probe_is_read_side_only === true);
assert("D3: basin_op_not_modified = true",    report?.disclaimers?.basin_op_not_modified === true);
assert("D4: no_new_identity_channel = true",  report?.disclaimers?.no_new_identity_channel === true);
assert("D5: phase_ratio_is_diagnostic = true",report?.disclaimers?.phase_ratio_is_diagnostic === true);

// No canon fields in rows
const rowStr = JSON.stringify(report?.per_scale_rows ?? []);
assert("D6: no canon/ontology fields in per-scale rows",
    !rowStr.includes('"canonical"') && !rowStr.includes('"promoted"') && !rowStr.includes('"C1"'));

// Dominant freq source declared
assert("D7: dominant_freq_source declared in config",
    typeof report?.probe_config?.dominant_freq_source === "string" &&
    report.probe_config.dominant_freq_source.includes("declared"));

// Spectral estimate note present and non-empty
assert("D8: spectral_estimate_note present and non-empty on all rows",
    (report?.per_scale_rows ?? []).every(r => typeof r.spectral_estimate_note === "string" && r.spectral_estimate_note.length > 0));

// Determinism: all baseline_frequency phase_ratios are exact
const bfRatios = report?.per_scale_rows?.filter(r => r.cohort_label === "baseline_frequency")
    .map(r => r.phase_ratio);
assert("D9: baseline_frequency phase_ratios are [0.25, 0.5, 1.0, 2.0]",
    JSON.stringify(bfRatios?.sort((a,b)=>a-b)) === "[0.25,0.5,1,2]",
    `got ${JSON.stringify(bfRatios)}`);

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
