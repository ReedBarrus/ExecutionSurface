// tests/test_directional_flow_probe.js
//
// Tests for run_directional_flow_probe.js
//
// Covers:
//   A. Flow metric computation correctness
//   B. flow_mode classification logic
//   C. Per-cohort row required fields and values
//   D. Comparison row asymmetry detection
//   E. Probe summary / verdict logic
//   F. Read-side posture
//
// Run:
//   node tests/test_directional_flow_probe.js

import { readFile } from "node:fs/promises";

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, detail = "") {
    if (cond) { console.log(`  ✓ ${label}`); passed++; }
    else { const m = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`; console.error(m); failures.push(m); failed++; }
}
function section(name) { console.log(`\n── ${name} ──`); }

// ─── Inline mirrors ───────────────────────────────────────────────────────────
const OFC_STRONG_THRESHOLD = 0.15;
const OFC_WEAK_THRESHOLD   = 0.02;
const LAG1_AC_THRESHOLD    = 0.90;
const FLIP_RATE_ALT        = 0.45;
const FLIP_RATE_STABLE     = 0.05;

function meanArr(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }
function stdArr(a)  { const m = meanArr(a); return Math.sqrt(a.reduce((s, x) => s + (x-m)**2, 0) / (a.length||1)); }

function computeFlowMetricsTest(leftSeries, rightSeries) {
    const n = leftSeries.length;
    const diffs = leftSeries.map((l, i) => l - rightSeries[i]);
    const signedFlow  = meanArr(diffs);
    const oscStrength = stdArr(diffs);
    let flips = 0;
    for (let i = 1; i < n; i++) if (Math.sign(diffs[i]) !== Math.sign(diffs[i-1])) flips++;
    const flipRate = n > 1 ? flips / (n - 1) : 0;

    const diffMean = signedFlow;
    let lagCov = 0, varSum = 0;
    for (let i = 1; i < n; i++) {
        lagCov += (diffs[i] - diffMean) * (diffs[i-1] - diffMean);
        varSum += (diffs[i-1] - diffMean) ** 2;
    }
    const diffLag1AC = varSum > 0 ? lagCov / varSum : 0;

    const lMean = meanArr(leftSeries), rMean = meanArr(rightSeries);
    let ccNum = 0, ccDenL = 0, ccDenR = 0;
    for (let i = 0; i < n - 1; i++) {
        ccNum  += (leftSeries[i] - lMean) * (rightSeries[i+1] - rMean);
        ccDenL += (leftSeries[i] - lMean) ** 2;
        ccDenR += (rightSeries[i+1] - rMean) ** 2;
    }
    const phaseProxy = ccDenL > 0 && ccDenR > 0 ? ccNum / Math.sqrt(ccDenL * ccDenR) : 0;

    const dirConsistency = flipRate > FLIP_RATE_ALT ? "alternating"
        : flipRate < FLIP_RATE_STABLE ? "one_direction" : "mixed";

    return { signedFlow, oscStrength, flipRate, diffLag1AC, phaseProxy, dirConsistency };
}

function classifyFlowModeTest(oscStrength, diffLag1AC, flipRate) {
    if (oscStrength < OFC_WEAK_THRESHOLD) return "weak_or_inert";
    if (oscStrength > OFC_STRONG_THRESHOLD && Math.abs(diffLag1AC) > LAG1_AC_THRESHOLD) return "oscillatory_exchange";
    if (flipRate > FLIP_RATE_ALT && oscStrength > OFC_WEAK_THRESHOLD) return "oscillatory_exchange";
    return "one_way_drift";
}

// ════════════════════════════════════════════════════════════════════════════
// A. Flow metric computation correctness
// ════════════════════════════════════════════════════════════════════════════
section("A. Flow metric computations");

// Case 1: period-2 oscillation — like the splitting cohorts
// L alternates 0.87/0.58, R alternates 0.13/0.42
const oscLeft  = [0.87, 0.58, 0.87, 0.58, 0.87, 0.58, 0.87, 0.58];
const oscRight = [0.13, 0.42, 0.13, 0.42, 0.13, 0.42, 0.13, 0.42];
const osc = computeFlowMetricsTest(oscLeft, oscRight);

assert("A1: signed_flow positive when left > right on average",    osc.signedFlow > 0);
assert("A2: osc_strength high for oscillating case",               osc.oscStrength > 0.15);
assert("A3: flip_rate = 0 (same sign always, just different magnitude)", osc.flipRate === 0);
assert("A4: diffLag1AC ≈ -1.0 (period-2 oscillation in diff magnitudes)",
    Math.abs(osc.diffLag1AC + 1.0) < 0.01, `got ${osc.diffLag1AC.toFixed(4)}`);
assert("A5: phaseProxy > 0.9 (left[t] predicts right[t+1])",
    osc.phaseProxy > 0.9, `got ${osc.phaseProxy.toFixed(4)}`);
assert("A6: dirConsistency = one_direction (same sign throughout)", osc.dirConsistency === "one_direction");

// Case 2: strict sign-alternating (like f8_h32_h40)
const altLeft  = [0.22, 0.14, 0.22, 0.14, 0.22, 0.14, 0.22, 0.14];
const altRight = [0.08, 0.45, 0.08, 0.45, 0.08, 0.45, 0.08, 0.45];
const alt = computeFlowMetricsTest(altLeft, altRight);

assert("A7: alternating case: flip_rate = 1.0", Math.abs(alt.flipRate - 1.0) < 0.01);
assert("A8: alternating case: dirConsistency = alternating", alt.dirConsistency === "alternating");
assert("A9: alternating case: osc_strength > 0.15", alt.oscStrength > 0.15);
assert("A10: alternating case: diffLag1AC ≈ -1.0", Math.abs(alt.diffLag1AC + 1.0) < 0.05);

// Case 3: stable / inert (like f8_h32)
const stableLeft  = [0.204, 0.215, 0.204, 0.215, 0.204, 0.215, 0.204, 0.215];
const stableRight = [0.199, 0.188, 0.196, 0.194, 0.192, 0.197, 0.194, 0.191];
const stable = computeFlowMetricsTest(stableLeft, stableRight);

assert("A11: inert case: osc_strength < 0.02",  stable.oscStrength < 0.02);
assert("A12: inert case: signed_flow ≈ 0.01",   Math.abs(stable.signedFlow) < 0.03);

// Case 4: one-way drift with bimodal but stable (like f8_h24_h32)
const driftLeft  = [0.375, 0.429, 0.375, 0.429, 0.375, 0.429, 0.375, 0.429];
const driftRight = [0.068, 0.225, 0.068, 0.225, 0.068, 0.225, 0.068, 0.225];
const drift = computeFlowMetricsTest(driftLeft, driftRight);

assert("A13: one_way_drift case: signed_flow > 0",     drift.signedFlow > 0.1);
assert("A14: one_way_drift case: osc_strength < 0.15 but > 0.02",
    drift.oscStrength < 0.15 && drift.oscStrength > 0.02,
    `got ${drift.oscStrength.toFixed(4)}`);

// signed_flow = mean(L - R); test with known values
const knownLeft  = [0.3, 0.4, 0.5];
const knownRight = [0.1, 0.1, 0.1];
const known = computeFlowMetricsTest(knownLeft, knownRight);
assert("A15: signed_flow = mean([0.2, 0.3, 0.4]) = 0.3",
    Math.abs(known.signedFlow - 0.3) < 1e-9);

// std(diffs) = std([0.2, 0.3, 0.4])
const knownStd = Math.sqrt(((0.2-0.3)**2 + (0.3-0.3)**2 + (0.4-0.3)**2) / 3);
assert("A16: oscStrength = std(diffs)",
    Math.abs(known.oscStrength - knownStd) < 1e-9);

// ════════════════════════════════════════════════════════════════════════════
// B. flow_mode classification logic
// ════════════════════════════════════════════════════════════════════════════
section("B. flow_mode classification");

assert("B1: weak_or_inert when osc_str < 0.02",
    classifyFlowModeTest(0.01, -0.95, 0.0) === "weak_or_inert");
assert("B2: oscillatory_exchange: osc_str > 0.15 AND |lag1_ac| > 0.90",
    classifyFlowModeTest(0.30, -0.999, 0.0) === "oscillatory_exchange");
assert("B3: oscillatory_exchange: high flip_rate counts too",
    classifyFlowModeTest(0.22, -0.50, 1.0) === "oscillatory_exchange");
assert("B4: one_way_drift: osc_str > 0.02 but lag1_ac not strong enough",
    classifyFlowModeTest(0.05, -0.80, 0.0) === "one_way_drift");
assert("B5: one_way_drift: osc_str > 0.15 but lag1_ac too low",
    classifyFlowModeTest(0.20, -0.70, 0.0) === "one_way_drift");

// The four flow modes map to expected cases
assert("B6: f8_h16 → oscillatory_exchange  (osc=0.305, lag=-0.999, flip=0)",
    classifyFlowModeTest(0.305, -0.999, 0.0) === "oscillatory_exchange");
assert("B7: f8_h32_h40 → oscillatory_exchange (osc=0.226, lag=-0.999, flip=1)",
    classifyFlowModeTest(0.226, -0.999, 1.0) === "oscillatory_exchange");
assert("B8: f8_h32 → weak_or_inert (osc=0.008)",
    classifyFlowModeTest(0.008, -0.85, 0.0) === "weak_or_inert");
assert("B9: f8_h24_h32 → one_way_drift (osc=0.052, lag=-0.996, flip=0)",
    classifyFlowModeTest(0.052, -0.996, 0.0) === "one_way_drift");
assert("B10: near-boundary 15.5 → one_way_drift (osc=0.200, lag=-0.73)",
    classifyFlowModeTest(0.200, -0.73, 0.0) === "one_way_drift");

// ════════════════════════════════════════════════════════════════════════════
// C. Per-cohort row required fields and values
// ════════════════════════════════════════════════════════════════════════════
section("C. Per-cohort rows");

let report = null;
try {
    report = JSON.parse(await readFile(
        "./out_experiments/directional_flow_probe/directional_flow_report.json", "utf8"
    ));
} catch (_) {}

assert("C1: report exists",        report != null);
assert("C2: 6 cohort rows",        report?.per_cohort_rows?.length === 6,
    `got ${report?.per_cohort_rows?.length}`);

const requiredFields = [
    "cohort_label","category","target_edge_hz","scale_N","phase_ratio",
    "harmonic_is_on_band_edge","interaction_zone_active",
    "boundary_band_pair","signed_cross_boundary_flow","oscillatory_flow_strength",
    "flow_direction_consistency","diff_lag1_autocorr","boundary_phase_lag_proxy",
    "sign_flip_rate","flow_mode",
    "basin_count","splitting_observed","inter_window_variance",
    "interpretation","next_action",
];
assert("C3: all required fields on every row",
    (report?.per_cohort_rows ?? []).every(r => requiredFields.every(f => f in r)));

// Splitting cohorts: oscillatory_exchange
const splittingRows = report?.per_cohort_rows?.filter(r => r.splitting_observed) ?? [];
assert("C4: all splitting rows have flow_mode = oscillatory_exchange",
    splittingRows.every(r => r.flow_mode === "oscillatory_exchange"),
    splittingRows.filter(r => r.flow_mode !== "oscillatory_exchange").map(r => r.cohort_label).join(", "));

// Non-splitting rows: no oscillatory_exchange
const nonSplitRows = report?.per_cohort_rows?.filter(r => !r.splitting_observed) ?? [];
assert("C5: no non-splitting row has flow_mode = oscillatory_exchange",
    nonSplitRows.every(r => r.flow_mode !== "oscillatory_exchange"),
    nonSplitRows.filter(r => r.flow_mode === "oscillatory_exchange").map(r => r.cohort_label).join(", "));

// Inert edge: weak_or_inert
const inertRow = report?.per_cohort_rows?.find(r => r.category === "inert_edge");
assert("C6: inert edge has flow_mode = weak_or_inert",
    inertRow?.flow_mode === "weak_or_inert");
assert("C7: inert edge osc_strength < 0.02",
    (inertRow?.oscillatory_flow_strength ?? 1) < 0.02);

// Splitting rows have high osc_strength and lag1_ac near -1
const h16Row = report?.per_cohort_rows?.find(r => r.cohort_label === "f8_h16_amp0.50");
assert("C8: f8_h16 osc_strength > 0.15",
    (h16Row?.oscillatory_flow_strength ?? 0) > 0.15,
    `got ${h16Row?.oscillatory_flow_strength}`);
assert("C9: f8_h16 diff_lag1_autocorr < -0.90",
    (h16Row?.diff_lag1_autocorr ?? 0) < -0.90,
    `got ${h16Row?.diff_lag1_autocorr}`);
assert("C10: f8_h16 boundary_phase_lag_proxy > 0.90",
    (h16Row?.boundary_phase_lag_proxy ?? 0) > 0.90,
    `got ${h16Row?.boundary_phase_lag_proxy}`);

// boundary_band_pair present and non-null
assert("C11: boundary_band_pair has left_band_hz and right_band_hz",
    (report?.per_cohort_rows ?? []).every(r =>
        typeof r.boundary_band_pair?.left_band_hz === "string" &&
        typeof r.boundary_band_pair?.right_band_hz === "string"));

// Near-boundary controls: one_way_drift
const nearBound = report?.per_cohort_rows?.filter(r => r.category === "near_boundary_control") ?? [];
assert("C12: near-boundary controls have flow_mode = one_way_drift",
    nearBound.every(r => r.flow_mode === "one_way_drift"));
assert("C13: near-boundary controls have higher osc_strength than inert but lower than splitting",
    nearBound.every(r => r.oscillatory_flow_strength > 0.02 && r.oscillatory_flow_strength < h16Row?.oscillatory_flow_strength));

// ════════════════════════════════════════════════════════════════════════════
// D. Comparison rows
// ════════════════════════════════════════════════════════════════════════════
section("D. Comparison asymmetry");

const comps = report?.comparisons ?? [];
const oscVsDrift = comps.find(c => c.comparison_type === "oscillatory_vs_one_way_drift");
assert("D1: oscillatory_vs_one_way_drift comparison present", oscVsDrift != null);
assert("D2: flow_mode_a = oscillatory_exchange", oscVsDrift?.flow_mode_a === "oscillatory_exchange");
assert("D3: flow_mode_b = one_way_drift",        oscVsDrift?.flow_mode_b === "one_way_drift");
assert("D4: structural asymmetry detected",      oscVsDrift?.structural_asymmetry_detected === true);

const inertVsAct = comps.find(c => c.comparison_type === "inert_vs_activated_oscillatory");
assert("D5: inert_vs_activated comparison present",  inertVsAct != null);
assert("D6: inert doesn't split, activated splits",
    inertVsAct?.splitting_a === false && inertVsAct?.splitting_b === true);

const wrongVsRight = comps.find(c => c.comparison_type === "wrong_side_vs_right_side_flow");
assert("D7: wrong_side_vs_right_side_flow present",  wrongVsRight != null);
assert("D8: wrong side has one_way_drift",
    wrongVsRight?.flow_mode_a === "one_way_drift");
assert("D9: right side has oscillatory_exchange",
    wrongVsRight?.flow_mode_b === "oscillatory_exchange");

// ════════════════════════════════════════════════════════════════════════════
// E. Probe summary / verdict
// ════════════════════════════════════════════════════════════════════════════
section("E. Probe summary and verdict");

const probeSummary = report?.probe_summary;
assert("E1: probe_verdict = splitting_prefers_oscillatory_exchange",
    probeSummary?.probe_verdict === "splitting_prefers_oscillatory_exchange",
    `got ${probeSummary?.probe_verdict}`);
assert("E2: hypothesis_supported = true",  probeSummary?.hypothesis_supported === true);
assert("E3: flow_mode_prediction_accuracy = 1.0",
    probeSummary?.flow_mode_prediction_accuracy === 1.0,
    `got ${probeSummary?.flow_mode_prediction_accuracy}`);
assert("E4: splitting_flow_modes = [oscillatory_exchange]",
    JSON.stringify(probeSummary?.splitting_flow_modes) === `["oscillatory_exchange"]`);
assert("E5: non_splitting_flow_modes doesn't include oscillatory_exchange",
    !(probeSummary?.non_splitting_flow_modes ?? []).includes("oscillatory_exchange"));
assert("E6: oscillatory_always_splits = true",
    probeSummary?.oscillatory_always_splits === true);

// ════════════════════════════════════════════════════════════════════════════
// F. Read-side posture
// ════════════════════════════════════════════════════════════════════════════
section("F. Read-side posture");

assert("F1: not_canon = true",             report?.disclaimers?.not_canon === true);
assert("F2: probe_is_read_side_only=true", report?.disclaimers?.probe_is_read_side_only === true);
assert("F3: basin_op_not_modified=true",   report?.disclaimers?.basin_op_not_modified === true);
assert("F4: no_new_identity_channel=true", report?.disclaimers?.no_new_identity_channel === true);
assert("F5: flow_metrics_are_read_side_observations=true",
    report?.disclaimers?.flow_metrics_are_read_side_observations === true);

const rowStr = JSON.stringify(report?.per_cohort_rows ?? []);
assert("F6: no canon fields in rows",
    !rowStr.includes('"canonical"') && !rowStr.includes('"promoted"') && !rowStr.includes('"C1"'));

assert("F7: flow_thresholds documented in config",
    typeof report?.probe_config?.flow_thresholds === "object" &&
    report.probe_config.flow_thresholds.osc_strong === OFC_STRONG_THRESHOLD);

assert("F8: all rows have diff_lag1_autocorr",
    (report?.per_cohort_rows ?? []).every(r => typeof r.diff_lag1_autocorr === "number"));
assert("F9: all rows have boundary_phase_lag_proxy",
    (report?.per_cohort_rows ?? []).every(r => typeof r.boundary_phase_lag_proxy === "number"));
assert("F10: all rows have sign_flip_rate",
    (report?.per_cohort_rows ?? []).every(r => typeof r.sign_flip_rate === "number"));

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
