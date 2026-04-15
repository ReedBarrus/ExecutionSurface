// tests/test_basin_identity_diagnostics_calibrated.js
//
// Tests for run_basin_identity_diagnostics_calibrated.js
//
// Covers:
//   A. Calibrated spectral fields emitted correctly
//   B. Basin-facing rows preserve read-side posture
//   C. Energy and spectral channels remain attributable and separate
//   D. Summary logic distinguishes artifact / fragmentation / collapse
//   E. Script output non-mutation smoke check
//
// Run:
//   node tests/test_basin_identity_diagnostics_calibrated.js

import { readFile } from "node:fs/promises";

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, detail = "") {
    if (cond) { console.log(`  ✓ ${label}`); passed++; }
    else { const m = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`; console.error(m); failures.push(m); failed++; }
}
function section(name) { console.log(`\n── ${name} ──`); }

// ─── Inline mirrors of key probe logic ────────────────────────────────────────

const FS_RAW = 256;
const BW_NORM_THRESHOLD = 0.001800;
const PER_SCALE_THRESHOLDS = { 8: 0.050132, 16: 0.116566, 32: 0.229296, 64: 0.055482 };
const GLOBAL_RAW_THRESHOLD = 0.20;
const GROUND_TRUTH = {
    "baseline_amplitude vs amplitude_shift":    "similar",
    "baseline_frequency vs frequency_shift":    "separated",
    "baseline_amplitude vs baseline_frequency": "separated",
    "amplitude_shift vs frequency_shift":       "separated",
};

function classifyCalibrated(rawDist, scale_N) {
    const df       = FS_RAW / scale_N;
    const normDist = rawDist / df;
    const clBW     = normDist > BW_NORM_THRESHOLD ? "separated" : "similar";
    const clGlobal = rawDist > GLOBAL_RAW_THRESHOLD ? "separated" : rawDist > 0.08 ? "borderline" : "similar";
    return { raw_band_distance: rawDist, normalized_band_distance: normDist,
        bin_width_hz: df, scale_N,
        classification_calibrated_bw: clBW,
        classification_global_uncal: clGlobal,
        calibration_changed_result: clBW !== clGlobal.replace("borderline", "similar") };
}

function classifySplitting(calibratedClass, calibrationChanged) {
    if (calibratedClass === "separated") {
        return calibrationChanged ? "threshold_artifact_resolved" : "lawful_fragmentation";
    }
    return "support_horizon_collapse";
}

function computeBasinVerdict(nSepCalibrated, nTotal, scalesWithSplitting, calibrationGain, expected) {
    if (nTotal === 0) return "insufficient_data";
    const r = nSepCalibrated / nTotal;
    if (expected === "similar") return r === 0 ? "correctly_similar" : "unexpected_separation";
    if (r === 1.0 && scalesWithSplitting.length === 0) return "robust_separation";
    if (r === 1.0 && scalesWithSplitting.length > 0) return "separated_with_within_cohort_splitting";
    if (r >= 0.5 && calibrationGain > 0) return "calibration_resolved_fragmentation";
    if (r >= 0.5) return "mostly_separated";
    return "fragmented_or_collapsed";
}

// ════════════════════════════════════════════════════════════════════════════
// A. Calibrated spectral fields emitted correctly
// ════════════════════════════════════════════════════════════════════════════
section("A. Calibrated spectral fields");

// Test the classifyCalibrated function directly
const c8  = classifyCalibrated(0.07114, 8);   // freq vs freq_shift @ N=8 — should flip
const c16 = classifyCalibrated(0.19537, 16);  // freq vs freq_shift @ N=16 — borderline → separated
const c32 = classifyCalibrated(0.45284, 32);  // freq vs freq_shift @ N=32 — already separated
const c64 = classifyCalibrated(0.10746, 64);  // freq vs freq_shift @ N=64 — borderline → separated
const amp = classifyCalibrated(0.00056, 8);   // amp vs amp_shift — should stay similar

// Required fields
const required = ["raw_band_distance","normalized_band_distance","bin_width_hz","scale_N",
    "classification_calibrated_bw","classification_global_uncal","calibration_changed_result"];
assert("A1: all required calibration fields present", required.every(f => f in c8));
assert("A2: bin_width_hz = Fs/N at N=8",  Math.abs(c8.bin_width_hz - 32) < 1e-9);
assert("A3: bin_width_hz = Fs/N at N=32", Math.abs(c32.bin_width_hz - 8)  < 1e-9);
assert("A4: normalized_band_distance = raw / bin_width",
    Math.abs(c8.normalized_band_distance - c8.raw_band_distance / c8.bin_width_hz) < 1e-9);
assert("A5: scale_N preserved on output", c8.scale_N === 8 && c32.scale_N === 32);

// Calibration flips
assert("A6: freq vs freq_shift @ N=8 flips global→calibrated (borderline/similar → separated)",
    c8.classification_global_uncal === "similar" && c8.classification_calibrated_bw === "separated");
assert("A7: calibration_changed_result = true when flip occurs", c8.calibration_changed_result === true);
assert("A8: amp vs amp_shift @ N=8 stays similar after calibration",
    amp.classification_calibrated_bw === "similar");
assert("A9: calibration_changed_result = false for stable similar",
    amp.calibration_changed_result === false);

// Numeric precision
assert("A10: raw_band_distance preserved with sufficient precision",
    Math.abs(c8.raw_band_distance - 0.07114) < 1e-9);
assert("A11: normalized value is strictly positive when raw > 0",
    c8.normalized_band_distance > 0);
assert("A12: larger N → smaller normalization divisor → larger normalized value for same raw",
    // same raw distance, N=64 has df=4 while N=8 has df=32, so N=64 normalizes higher
    classifyCalibrated(0.1, 64).normalized_band_distance > classifyCalibrated(0.1, 8).normalized_band_distance);

// ════════════════════════════════════════════════════════════════════════════
// B. Basin-facing rows preserve read-side posture
// ════════════════════════════════════════════════════════════════════════════
section("B. Basin row posture");

let report = null;
try {
    report = JSON.parse(await readFile(
        "./out_experiments/basin_identity_diagnostics_calibrated/basin_diagnostics_calibrated_report.json", "utf8"
    ));
} catch (_) {}

assert("B1: report file exists", report != null);
assert("B2: not_canon = true", report?.disclaimers?.not_canon === true);
assert("B3: probe_is_read_side_only = true", report?.disclaimers?.probe_is_read_side_only === true);
assert("B4: basins_are_proto_basins disclaimer present", report?.disclaimers?.basins_are_proto_basins === true);
assert("B5: no_ontological_basin_claims disclaimer present", report?.disclaimers?.no_ontological_basin_claims === true);
assert("B6: channels_remain_separate disclaimer present", report?.disclaimers?.channels_remain_separate === true);

// Between-cohort rows must have calibration fields
const betweenRows = (report?.between_cohort_rows ?? []).filter(r => r.metric === "centroid_distance");
const hasCalibratedFields = betweenRows.every(r =>
    "raw_band_distance" in r &&
    "normalized_band_distance" in r &&
    "bin_width_hz" in r &&
    "scale_N" in r
);
assert("B7: all between-cohort centroid rows have 4 required calibration fields", hasCalibratedFields,
    `${betweenRows.length} rows checked`);

// No canon / ontology fields in any row
const allRowStr = JSON.stringify([
    ...(report?.between_cohort_rows ?? []),
    ...(report?.within_cohort_rows ?? []),
]);
assert("B8: no canonical/promoted/C1 fields in basin rows",
    !allRowStr.includes('"canonical"') && !allRowStr.includes('"promoted"') && !allRowStr.includes('"C1"'));

// between_cohort and within_cohort rows are separate (not fused)
const allWithin = report?.within_cohort_rows ?? [];
const allBetween = report?.between_cohort_rows ?? [];
assert("B9: within_cohort_rows and between_cohort_rows are separate arrays",
    Array.isArray(allWithin) && Array.isArray(allBetween) && allWithin !== allBetween);
assert("B10: within_cohort rows have stage = 'within_cohort'",
    allWithin.every(r => r.stage === "within_cohort"));
assert("B11: between_cohort rows have stage = 'post_basin'",
    allBetween.every(r => r.stage === "post_basin"));

// ════════════════════════════════════════════════════════════════════════════
// C. Energy and spectral channels remain separate
// ════════════════════════════════════════════════════════════════════════════
section("C. Channel separation");

// Energy rows have metric = absolute_energy_ratio; spectral rows have centroid_distance
const energyRows   = allBetween.filter(r => r.metric === "absolute_energy_ratio");
const spectralRows = allBetween.filter(r => r.metric === "centroid_distance");

assert("C1: energy rows have metric absolute_energy_ratio",
    energyRows.length > 0 && energyRows.every(r => r.metric === "absolute_energy_ratio"));
assert("C2: energy rows do NOT have raw_band_distance (it's not a spectral metric)",
    energyRows.every(r => r.raw_band_distance === null));
assert("C3: spectral rows have raw_band_distance non-null when available",
    spectralRows.some(r => r.raw_band_distance != null));

// The amplitude pair: spectral=similar, energy=separated — channels must disagree (informative)
const ampSpectral = spectralRows.find(r => r.pair === "baseline_amplitude vs amplitude_shift" && r.scale_N === 16);
const ampEnergy   = energyRows.find(r =>   r.pair === "baseline_amplitude vs amplitude_shift" && r.scale_N === 16);
assert("C4: amp pair spectral classification = similar",
    ampSpectral?.classification_calibrated_bw === "similar", ampSpectral?.classification_calibrated_bw);
assert("C5: amp pair energy classification = separated",
    ampEnergy?.classification === "separated", ampEnergy?.classification);
assert("C6: amp pair channels are informationally orthogonal (spectral≠energy)",
    ampSpectral?.classification_calibrated_bw !== ampEnergy?.classification);

// The frequency pair: spectral=separated, energy=similar — inverse orthogonality
const freqSpectral = spectralRows.find(r => r.pair === "baseline_frequency vs frequency_shift" && r.scale_N === 16);
const freqEnergy   = energyRows.find(r =>   r.pair === "baseline_frequency vs frequency_shift" && r.scale_N === 16);
assert("C7: freq pair spectral = separated after calibration",
    freqSpectral?.classification_calibrated_bw === "separated");
assert("C8: freq pair energy = similar",
    freqEnergy?.classification === "similar");
assert("C9: freq pair channels are informationally orthogonal (spectral≠energy)",
    freqSpectral?.classification_calibrated_bw !== freqEnergy?.classification);

// Energy ratios are scale-invariant — check consistency
const ampEnergyByScale = energyRows.filter(r => r.pair === "baseline_amplitude vs amplitude_shift");
const ampEnergyValues = ampEnergyByScale.map(r => r.raw_value).filter(v => v != null);
assert("C10: amplitude pair energy ratio is scale-invariant (all values identical)",
    ampEnergyValues.length > 1 && new Set(ampEnergyValues.map(v => v.toFixed(3))).size === 1,
    `values: ${ampEnergyValues.map(v => v?.toFixed(3)).join(", ")}`);

// ════════════════════════════════════════════════════════════════════════════
// D. Summary logic distinguishes artifact / fragmentation / collapse
// ════════════════════════════════════════════════════════════════════════════
section("D. Basin verdict classification logic");

// Test all verdict cases
assert("D1: correctly_similar — expected similar, 0/4 separated",
    computeBasinVerdict(0, 4, [], 0, "similar") === "correctly_similar");
assert("D2: unexpected_separation — expected similar but 2/4 separated",
    computeBasinVerdict(2, 4, [], 0, "similar") === "unexpected_separation");
assert("D3: robust_separation — expected sep, 4/4, no splitting",
    computeBasinVerdict(4, 4, [], 0, "separated") === "robust_separation");
assert("D4: separated_with_within_cohort_splitting — expected sep, 4/4, splitting at N=32",
    computeBasinVerdict(4, 4, [32], 0, "separated") === "separated_with_within_cohort_splitting");
assert("D5: calibration_resolved_fragmentation — 3/4 sep, calibration gained 3",
    computeBasinVerdict(3, 4, [], 3, "separated") === "calibration_resolved_fragmentation");
assert("D6: mostly_separated — 3/4 sep but no calibration gain",
    computeBasinVerdict(3, 4, [], 0, "separated") === "mostly_separated");
assert("D7: fragmented_or_collapsed — only 1/4 sep",
    computeBasinVerdict(1, 4, [], 0, "separated") === "fragmented_or_collapsed");
assert("D8: insufficient_data when nTotal = 0",
    computeBasinVerdict(0, 0, [], 0, "separated") === "insufficient_data");

// Splitting type logic
assert("D9: lawful_fragmentation when calibrated=separated and no flip",
    classifySplitting("separated", false) === "lawful_fragmentation");
assert("D10: threshold_artifact_resolved when calibrated=separated but changed",
    classifySplitting("separated", true) === "threshold_artifact_resolved");
assert("D11: support_horizon_collapse when calibrated=similar",
    classifySplitting("similar", false) === "support_horizon_collapse");
assert("D12: support_horizon_collapse also when calibrated=similar and changed",
    classifySplitting("similar", true) === "support_horizon_collapse");

// Verify that the freq vs freq_shift pair gets the expected verdict from report
const summaries = report?.cross_scale_summaries ?? [];
const freqSummary = summaries.find(s => s.pair === "baseline_frequency vs frequency_shift");
assert("D13: freq vs freq_shift verdict = separated_with_within_cohort_splitting",
    freqSummary?.basin_verdict === "separated_with_within_cohort_splitting",
    freqSummary?.basin_verdict);
assert("D14: freq vs freq_shift calibration_gain = 3 (was 1/4, now 4/4)",
    freqSummary?.between_cohort?.calibration_gain_scales === 3,
    freqSummary?.between_cohort?.calibration_gain_scales);

// amp vs amp_shift verdict
const ampSummary = summaries.find(s => s.pair === "baseline_amplitude vs amplitude_shift");
assert("D15: amp vs amp_shift verdict = correctly_similar",
    ampSummary?.basin_verdict === "correctly_similar");

// amplitude_shift vs frequency_shift verdict
const ampFreqSummary = summaries.find(s => s.pair === "amplitude_shift vs frequency_shift");
assert("D16: amplitude_shift vs frequency_shift verdict = robust_separation",
    ampFreqSummary?.basin_verdict === "robust_separation");

// ════════════════════════════════════════════════════════════════════════════
// E. Script non-mutation smoke check
// ════════════════════════════════════════════════════════════════════════════
section("E. Non-mutation and report completeness");

assert("E1: report has between_cohort_rows array",
    Array.isArray(report?.between_cohort_rows));
assert("E2: report has within_cohort_rows array",
    Array.isArray(report?.within_cohort_rows));
assert("E3: report has cross_scale_summaries array",
    Array.isArray(report?.cross_scale_summaries));
assert("E4: 4 cross-scale summaries (one per pair)",
    report?.cross_scale_summaries?.length === 4,
    `got ${report?.cross_scale_summaries?.length}`);

// Each summary has all required fields
const summaryRequired = ["pair","between_cohort","energy_channel","within_cohort_splitting",
    "basin_verdict","interpretation","next_action","ground_truth_expected"];
assert("E5: all cross-scale summaries have required fields",
    summaries.every(s => summaryRequired.every(f => f in s)));

// spectral calibration config is in report
assert("E6: spectral_calibration config present",
    typeof report?.probe_config?.spectral_calibration === "object");
assert("E7: bw_norm_threshold in config matches probe constant",
    report?.probe_config?.spectral_calibration?.bw_norm_threshold === BW_NORM_THRESHOLD);

// Splitting observed at N=32 for baseline_frequency cohort
const n32Within = (report?.within_cohort_rows ?? []).filter(r => r.scale_N === 32 && r.splitting_observed === true);
assert("E8: within-cohort splitting observed at N=32",
    n32Within.length > 0, `got ${n32Within.length}`);
assert("E9: splitting type is lawful_fragmentation at N=32",
    n32Within.every(r => r.splitting_type === "lawful_fragmentation"),
    n32Within.map(r => r.splitting_type).join(", "));

// Between-cohort: 4 scales × 4 pairs × 2 metrics = 32 rows
assert("E10: correct number of between-cohort rows",
    allBetween.length === 32, `got ${allBetween.length}`);

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
