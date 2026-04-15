// tests/test_active_interaction_zone_probe.js
//
// Tests for run_active_interaction_zone_probe.js
//
// Covers:
//   A. Adjacent-band energy metric computations
//   B. interaction_zone_active classification
//   C. Per-cohort row required fields
//   D. Comparison rows and asymmetry detection
//   E. Probe summary / verdict logic
//   F. Read-side posture
//
// Run:
//   node tests/test_active_interaction_zone_probe.js

import { readFile } from "node:fs/promises";

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, detail = "") {
    if (cond) { console.log(`  ✓ ${label}`); passed++; }
    else { const m = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`; console.error(m); failures.push(m); failed++; }
}
function section(name) { console.log(`\n── ${name} ──`); }

// ─── Inline mirrors ───────────────────────────────────────────────────────────
const BAND_EDGES = [0, 16, 32, 48, 64, 80, 96, 112, 128];
const ACTIVE_REDIST_THRESHOLD = 0.10;
const ACTIVE_ENERGY_THRESHOLD = 0.05;

function computeInteractionZoneTest(leftVals, rightVals) {
    const mean = arr => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
    const variance = arr => { const m = mean(arr); return arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length || 1); };
    const lMean = mean(leftVals), rMean = mean(rightVals);
    const balance = (lMean + rMean) > 0 ? 2 * Math.min(lMean, rMean) / (lMean + rMean) : 0;
    const diffs   = leftVals.map((l, i) => l - (rightVals[i] ?? 0));
    const crossRedist = Math.sqrt(variance(diffs));
    const interactionActive =
        crossRedist > ACTIVE_REDIST_THRESHOLD &&
        lMean > ACTIVE_ENERGY_THRESHOLD &&
        rMean > ACTIVE_ENERGY_THRESHOLD;
    return { lMean, rMean, balance, crossRedist, interactionActive };
}

function buildProbeSummaryTest(rows) {
    const correctPredictions = rows.filter(r => r.interaction_zone_active === r.split).length;
    const accuracy = correctPredictions / rows.length;
    const activeEdgeSplits = rows.filter(r => r.category === "active_edge" && r.split).length;
    const inertEdgeSplits  = rows.filter(r => r.category === "inert_edge"  && r.split).length;
    const supported = activeEdgeSplits > 0 && inertEdgeSplits === 0 && accuracy >= 0.85;
    return { accuracy, supported };
}

// ════════════════════════════════════════════════════════════════════════════
// A. Adjacent-band energy metric computations
// ════════════════════════════════════════════════════════════════════════════
section("A. Adjacent-band energy metrics");

// Active case: significant oscillation between left and right bands
// Values alternate 0.80/0.55 and 0.20/0.45 — cross_redist will be ~0.175, well above threshold
const activeLeft  = [0.80, 0.55, 0.80, 0.55, 0.80, 0.55, 0.80, 0.55];
const activeRight = [0.20, 0.45, 0.20, 0.45, 0.20, 0.45, 0.20, 0.45];
const active = computeInteractionZoneTest(activeLeft, activeRight);

assert("A1: active case: lMean ≈ 0.675", Math.abs(active.lMean - 0.675) < 0.01);
assert("A2: active case: rMean ≈ 0.325", Math.abs(active.rMean - 0.325) < 0.01);
assert("A3: active case: balance = 2*min/sum",
    Math.abs(active.balance - 2 * 0.325 / 1.0) < 0.01);
assert("A4: active case: crossRedist is high (oscillating)",
    active.crossRedist > 0.1, `got ${active.crossRedist.toFixed(4)}`);
assert("A5: active case: interactionActive = true", active.interactionActive);

// Inert case: near-equal but stable (no oscillation)
const inertLeft  = [0.21, 0.21, 0.21, 0.21, 0.21, 0.21, 0.21, 0.21];
const inertRight = [0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19];
const inert = computeInteractionZoneTest(inertLeft, inertRight);

assert("A6: inert case: balance near 1.0 (equal split)", inert.balance > 0.9);
assert("A7: inert case: crossRedist ≈ 0 (no oscillation)",
    inert.crossRedist < 0.01, `got ${inert.crossRedist.toFixed(6)}`);
assert("A8: inert case: interactionActive = false", !inert.interactionActive);

// Energy threshold: if one band is essentially empty, zone is inactive
const emptyRight = [0.7, 0.7, 0.7, 0.7].map(v => v);
const zeroRight  = [0.01, 0.01, 0.01, 0.01];
const emptyCase = computeInteractionZoneTest(emptyRight, zeroRight);
assert("A9: empty right band → interactionActive = false",
    !emptyCase.interactionActive, `cross_redist=${emptyCase.crossRedist.toFixed(4)}`);

// balance is 0 when all energy is on one side
const allLeft = [1.0, 1.0, 1.0], zeroRightArr = [0.0, 0.0, 0.0];
const allLeftCase = computeInteractionZoneTest(allLeft, zeroRightArr);
assert("A10: balance=0 when all energy on one side", allLeftCase.balance === 0);

// balance is 1.0 when perfectly equal
const equal = computeInteractionZoneTest([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]);
assert("A11: balance=1.0 when perfectly equal", Math.abs(equal.balance - 1.0) < 1e-9);

// ════════════════════════════════════════════════════════════════════════════
// B. interaction_zone_active classification
// ════════════════════════════════════════════════════════════════════════════
section("B. interaction_zone_active classification");

// The FULL condition: on-edge AND high redistribution AND both bands populated
// Test the three conditions independently
const highRedistBothActive  = computeInteractionZoneTest([0.80,0.55,0.80,0.55],[0.20,0.45,0.20,0.45]);
const lowRedistBothActive   = computeInteractionZoneTest([0.5,0.5,0.5,0.5],[0.5,0.5,0.5,0.5]);
const highRedistOneEmpty    = computeInteractionZoneTest([0.9,0.9,0.9],[0.02,0.02,0.02]);

assert("B1: high redist + both active → interactionActive = true",
    highRedistBothActive.interactionActive);
assert("B2: low redist + both active → interactionActive = false (no oscillation)",
    !lowRedistBothActive.interactionActive);
assert("B3: high redist + one empty → interactionActive = false (threshold not met)",
    !highRedistOneEmpty.interactionActive);

// The FULL condition adds edge coincidence requirement (from the probe runner)
// We test this via the report
let report = null;
try {
    report = JSON.parse(await readFile(
        "./out_experiments/active_interaction_zone_probe/active_interaction_zone_report.json", "utf8"
    ));
} catch (_) {}

// Near-boundary controls: high redistribution but NOT on edge → zone NOT active in final classification
const nearBoundaryRow15 = report?.per_cohort_rows?.find(r => r.cohort_label === "f8_h15.5_amp0.50");
const nearBoundaryRow16p5 = report?.per_cohort_rows?.find(r => r.cohort_label === "f8_h16.5_amp0.50");
assert("B4: near-boundary 15.5 Hz: NOT on edge → interaction_zone_active = false",
    nearBoundaryRow15?.interaction_zone_active === false,
    `got ${nearBoundaryRow15?.interaction_zone_active}`);
assert("B5: near-boundary 16.5 Hz: NOT on edge → interaction_zone_active = false",
    nearBoundaryRow16p5?.interaction_zone_active === false);

// But they DO have high cross_boundary_redistribution_index (near-boundary stress is real)
assert("B6: near-boundary 15.5 Hz has real redistribution (> 0.15)",
    (nearBoundaryRow15?.cross_boundary_redistribution_index ?? 0) > 0.15,
    `got ${nearBoundaryRow15?.cross_boundary_redistribution_index}`);

// ════════════════════════════════════════════════════════════════════════════
// C. Per-cohort row required fields
// ════════════════════════════════════════════════════════════════════════════
section("C. Per-cohort row required fields");

assert("C1: report exists", report != null);
assert("C2: 7 cohort rows", report?.per_cohort_rows?.length === 7,
    `got ${report?.per_cohort_rows?.length}`);

const requiredFields = [
    "cohort_label","category","fundamental_hz","harmonic_hz","harmonic_amp",
    "target_edge_hz","nearest_band_edge_hz","harmonic_is_on_band_edge","phase_ratio",
    "left_band_hz","right_band_hz",
    "left_band_energy_mean","right_band_energy_mean",
    "left_band_energy_variance","right_band_energy_variance",
    "cross_boundary_energy_balance","cross_boundary_redistribution_index",
    "interaction_zone_active","basin_count","splitting_observed",
    "inter_window_variance","band_transition_rate","dominant_band_stability",
    "interpretation","next_action",
];
assert("C3: all required fields on every row",
    (report?.per_cohort_rows ?? []).every(r => requiredFields.every(f => f in r)));

// Active-edge rows split, inert-edge rows don't
const activeRows = report?.per_cohort_rows?.filter(r => r.category === "active_edge") ?? [];
const inertRows  = report?.per_cohort_rows?.filter(r => r.category === "inert_edge") ?? [];
assert("C4: all active_edge rows split",
    activeRows.every(r => r.splitting_observed === true), `failing: ${activeRows.filter(r=>!r.splitting_observed).map(r=>r.cohort_label)}`);
assert("C5: no inert_edge rows split",
    inertRows.every(r => r.splitting_observed === false));
assert("C6: mid-band control does not split",
    report?.per_cohort_rows?.find(r => r.category === "mid_band_control")?.splitting_observed === false);
assert("C7: near-boundary controls do not split",
    (report?.per_cohort_rows ?? []).filter(r => r.category === "near_boundary_control")
        .every(r => r.splitting_observed === false));

// interaction_zone_active matches splitting for all cohorts
assert("C8: interaction_zone_active perfectly predicts splitting_observed",
    (report?.per_cohort_rows ?? []).every(r => r.interaction_zone_active === r.splitting_observed));

// cross_boundary_redistribution_index much higher for active cases
const h16Row  = report?.per_cohort_rows?.find(r => r.cohort_label === "f8_h16_amp0.50");
const h32Row  = report?.per_cohort_rows?.find(r => r.cohort_label === "f8_h32_amp0.50");
assert("C9: active edge cross_redist > 10× inert edge cross_redist",
    (h16Row?.cross_boundary_redistribution_index ?? 0) > 10 * (h32Row?.cross_boundary_redistribution_index ?? 1),
    `h16=${h16Row?.cross_boundary_redistribution_index?.toFixed(4)}, h32=${h32Row?.cross_boundary_redistribution_index?.toFixed(4)}`);

// Activated 32Hz edge row
const h32h40Row = report?.per_cohort_rows?.find(r => r.cohort_label === "f8_h32_h40_amp0.50");
assert("C10: f8_h32_h40 splits (32Hz edge activated by 40Hz)",
    h32h40Row?.splitting_observed === true);
assert("C11: f8_h32_h40 has interaction_zone_active = true",
    h32h40Row?.interaction_zone_active === true);
assert("C12: f8_h32_h40 cross_redist > f8_h32 cross_redist (activation increases redistribution)",
    (h32h40Row?.cross_boundary_redistribution_index ?? 0) > (h32Row?.cross_boundary_redistribution_index ?? 0));

// Partial activation (wrong side)
const h24h32Row = report?.per_cohort_rows?.find(r => r.cohort_label === "f8_h24_h32_amp0.50");
assert("C13: f8_h24_h32 does NOT split (wrong side active)",
    h24h32Row?.splitting_observed === false);
assert("C14: f8_h24_h32 interaction_zone_active = false (receiving band inert)",
    h24h32Row?.interaction_zone_active === false);

// ════════════════════════════════════════════════════════════════════════════
// D. Comparison rows and asymmetry detection
// ════════════════════════════════════════════════════════════════════════════
section("D. Comparison rows");

const comparisons = report?.comparisons ?? [];

const avI = comparisons.find(c => c.comparison_type === "active_edge_vs_inert_edge");
assert("D1: active_edge_vs_inert_edge comparison present", avI != null);
assert("D2: structural asymmetry detected", avI?.structural_asymmetry_detected === true);
assert("D3: active edge splits, inert does not",
    avI?.splitting_a === true && avI?.splitting_b === false);
assert("D4: interaction zones differ: active has zone, inert does not",
    avI?.interaction_zone_active_a === true && avI?.interaction_zone_active_b === false);

const inertVsActivated = comparisons.find(c => c.comparison_type === "inert_edge_vs_activated_edge");
assert("D5: inert_edge_vs_activated_edge comparison present", inertVsActivated != null);
assert("D6: same edge (32 Hz), activation changes splitting",
    inertVsActivated?.edge_a === 32 && inertVsActivated?.edge_b === 32);
assert("D7: activation changes splitting outcome",
    inertVsActivated?.splitting_a === false && inertVsActivated?.splitting_b === true);

const wrongVsRight = comparisons.find(c => c.comparison_type === "wrong_side_active_vs_right_side_active");
assert("D8: wrong_side_active_vs_right_side_active present", wrongVsRight != null);
assert("D9: structural asymmetry: wrong side doesn't split, right side does",
    wrongVsRight?.structural_asymmetry_detected === true);

// ════════════════════════════════════════════════════════════════════════════
// E. Probe summary / verdict logic
// ════════════════════════════════════════════════════════════════════════════
section("E. Probe summary and verdict");

const probeSummary = report?.probe_summary;
assert("E1: probe_verdict = edge_plus_active_interaction_required",
    probeSummary?.probe_verdict === "edge_plus_active_interaction_required",
    `got ${probeSummary?.probe_verdict}`);
assert("E2: hypothesis_supported = true",
    probeSummary?.hypothesis_supported === true);
assert("E3: interaction_zone_prediction_accuracy = 1.0",
    probeSummary?.interaction_zone_prediction_accuracy === 1.0,
    `got ${probeSummary?.interaction_zone_prediction_accuracy}`);
assert("E4: active_edges_that_split includes 16 and 32",
    (probeSummary?.active_edges_that_split ?? []).includes(16) &&
    (probeSummary?.active_edges_that_split ?? []).includes(32));
assert("E5: inert_edges_that_split is empty",
    (probeSummary?.inert_edges_that_split ?? []).length === 0);

// Test inline summary logic
const perfectCohorts = [
    { category: "active_edge", interaction_zone_active: true,  split: true  },
    { category: "active_edge", interaction_zone_active: true,  split: true  },
    { category: "inert_edge",  interaction_zone_active: false, split: false },
    { category: "inert_edge",  interaction_zone_active: false, split: false },
    { category: "mid_band_control", interaction_zone_active: false, split: false },
];
const perfSummary = buildProbeSummaryTest(perfectCohorts);
assert("E6: perfect cohorts → supported=true, accuracy=1.0",
    perfSummary.supported && perfSummary.accuracy === 1.0);

const failCohorts = [
    { category: "inert_edge",  interaction_zone_active: false, split: true  },  // inert edge splits!
    { category: "active_edge", interaction_zone_active: true,  split: true  },
];
const failSummary = buildProbeSummaryTest(failCohorts);
assert("E7: inert edge splitting → hypothesis not supported",
    !failSummary.supported);

// ════════════════════════════════════════════════════════════════════════════
// F. Read-side posture
// ════════════════════════════════════════════════════════════════════════════
section("F. Read-side posture");

assert("F1: not_canon = true",             report?.disclaimers?.not_canon === true);
assert("F2: probe_is_read_side_only=true", report?.disclaimers?.probe_is_read_side_only === true);
assert("F3: basin_op_not_modified=true",   report?.disclaimers?.basin_op_not_modified === true);
assert("F4: band_edges_not_changed=true",  report?.disclaimers?.band_edges_not_changed === true);
assert("F5: no_new_identity_channel=true", report?.disclaimers?.no_new_identity_channel === true);

const rowStr = JSON.stringify(report?.per_cohort_rows ?? []);
assert("F6: no canon/ontology fields in rows",
    !rowStr.includes('"canonical"') && !rowStr.includes('"promoted"') && !rowStr.includes('"C1"'));

assert("F7: active_zone_thresholds documented in config",
    typeof report?.probe_config?.active_zone_thresholds === "object" &&
    report.probe_config.active_zone_thresholds.cross_redist_min === 0.10);

assert("F8: all rows have cross_boundary_redistribution_index",
    (report?.per_cohort_rows ?? []).every(r => typeof r.cross_boundary_redistribution_index === "number"));
assert("F9: all rows have cross_boundary_energy_balance",
    (report?.per_cohort_rows ?? []).every(r => typeof r.cross_boundary_energy_balance === "number"));

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
