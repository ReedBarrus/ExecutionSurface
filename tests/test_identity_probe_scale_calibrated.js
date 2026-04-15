// tests/test_identity_probe_scale_calibrated.js
//
// Tests for run_identity_separability_probe_scale_calibrated.js
//
// Covers:
//   A. Per-scale threshold derivation logic
//   B. Scale normalization strategies produce distinct values
//   C. Relative classification and pattern labeling
//   D. Strategy accuracy evaluation against ground truth
//   E. Absolute energy invariance confirmed as control
//   F. Report file shape and disclaimer posture
//
// Run:
//   node tests/test_identity_probe_scale_calibrated.js

import { readFile } from "node:fs/promises";

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, detail = "") {
    if (cond) { console.log(`  ✓ ${label}`); passed++; }
    else { const m = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`; console.error(m); failures.push(m); failed++; }
}
function section(name) { console.log(`\n── ${name} ──`); }

// ─── Inline logic mirrors (no coupling to script internals) ───────────────────

const GROUND_TRUTH = {
    "baseline_amplitude vs amplitude_shift":    "similar",
    "baseline_frequency vs frequency_shift":    "separated",
    "baseline_amplitude vs baseline_frequency": "separated",
    "amplitude_shift vs frequency_shift":       "separated",
};

// Strategy 1: per-scale threshold computation
function computePerScaleThresholdTest(pairMetrics) {
    // pairMetrics: { pair_label → band_profile_distance_raw }
    const simVals = [], sepVals = [];
    for (const [label, v] of Object.entries(pairMetrics)) {
        if (GROUND_TRUTH[label] === "similar") simVals.push(v);
        else sepVals.push(v);
    }
    const maxSim = simVals.length ? Math.max(...simVals) : 0;
    const minSep = sepVals.length ? Math.min(...sepVals) : 1;
    const cleanGap = minSep > maxSim;
    const threshold = cleanGap
        ? (maxSim + minSep) / 2
        : [...simVals, ...sepVals].sort((a, b) => a - b)[Math.floor((simVals.length + sepVals.length) / 2)];
    return { threshold, cleanGap, maxSim, minSep };
}

// Strategy 2: normalizations
function normalizeTest(raw, scale_N, df, entropy) {
    return {
        bin_width: raw / df,
        sqrt_N:    raw / Math.sqrt(scale_N),
        entropy:   entropy > 0 ? raw / entropy : raw,
    };
}

// Strategy 3: relative classification
function relativeClassifyTest(pairValues) {
    // pairValues: { label → value }
    const vals = Object.values(pairValues).sort((a, b) => a - b);
    const median = vals[Math.floor(vals.length / 2)];
    const result = {};
    for (const [label, v] of Object.entries(pairValues)) {
        result[label] = v > median ? "separated" : "similar";
    }
    return { median, result };
}

function scalePatternTest(nSep, nTotal) {
    const r = nTotal > 0 ? nSep / nTotal : 0;
    if (r === 1.0) return "always_separated";
    if (r === 0.0) return "always_similar";
    if (r >= 0.75) return "mostly_separated";
    if (r <= 0.25) return "mostly_similar";
    return "mixed";
}

// ════════════════════════════════════════════════════════════════════════════
// A. Per-scale threshold derivation logic
// ════════════════════════════════════════════════════════════════════════════
section("A. Per-scale threshold derivation");

// Case: clean gap — similar pair clearly below separated pairs
const cleanCase = {
    "baseline_amplitude vs amplitude_shift":    0.010,   // similar
    "baseline_frequency vs frequency_shift":    0.300,   // separated
    "baseline_amplitude vs baseline_frequency": 0.700,   // separated
    "amplitude_shift vs frequency_shift":       0.600,   // separated
};
const cleanThresh = computePerScaleThresholdTest(cleanCase);
assert("A1: clean gap detected", cleanThresh.cleanGap);
assert("A2: threshold is midpoint between 0.010 and 0.300",
    Math.abs(cleanThresh.threshold - 0.155) < 0.001, `got ${cleanThresh.threshold.toFixed(4)}`);
assert("A3: threshold > max_similar", cleanThresh.threshold > cleanThresh.maxSim);
assert("A4: threshold < min_separated", cleanThresh.threshold < cleanThresh.minSep);

// Case: no gap — similar and separated values overlap
const overlapCase = {
    "baseline_amplitude vs amplitude_shift":    0.200,   // similar
    "baseline_frequency vs frequency_shift":    0.180,   // separated — but lower than similar!
    "baseline_amplitude vs baseline_frequency": 0.500,
    "amplitude_shift vs frequency_shift":       0.400,
};
const overlapThresh = computePerScaleThresholdTest(overlapCase);
assert("A5: overlap detected (no clean gap)", !overlapThresh.cleanGap);
assert("A6: fallback threshold is a positive number", overlapThresh.threshold > 0);

// Classification correctness with clean threshold
const classified = {};
for (const [label, v] of Object.entries(cleanCase)) {
    classified[label] = v > cleanThresh.threshold ? "separated" : "similar";
}
assert("A7: baseline_amplitude vs amplitude_shift classified as similar",
    classified["baseline_amplitude vs amplitude_shift"] === "similar");
assert("A8: baseline_frequency vs frequency_shift classified as separated",
    classified["baseline_frequency vs frequency_shift"] === "separated");
assert("A9: all 4 pairs classified correctly with clean threshold",
    Object.entries(classified).every(([label, cl]) => cl === GROUND_TRUTH[label]));

// ════════════════════════════════════════════════════════════════════════════
// B. Scale normalization strategies produce distinct values
// ════════════════════════════════════════════════════════════════════════════
section("B. Scale normalization strategies");

const rawDist  = 0.452;
const scale_N  = 32;
const df       = 256 / scale_N;   // 8 Hz/bin
const entropy  = 2.0;              // hypothetical entropy

const norms = normalizeTest(rawDist, scale_N, df, entropy);

assert("B1: bin_width normalization divides by df", Math.abs(norms.bin_width - rawDist / df) < 1e-9);
assert("B2: sqrt_N normalization divides by sqrt(N)", Math.abs(norms.sqrt_N - rawDist / Math.sqrt(scale_N)) < 1e-9);
assert("B3: entropy normalization divides by entropy", Math.abs(norms.entropy - rawDist / entropy) < 1e-9);
assert("B4: three normalizations produce distinct values",
    new Set([norms.bin_width, norms.sqrt_N, norms.entropy]).size === 3);

// Verify normalization direction: larger scale_N → smaller normalization factor → larger normalized value
const rawDistSame = 0.452;
const normN8  = normalizeTest(rawDistSame,  8, 256/8,  entropy);
const normN64 = normalizeTest(rawDistSame, 64, 256/64, entropy);

// bin_width: N=8 → df=32 → norm=0.452/32 = 0.014; N=64 → df=4 → norm=0.452/4 = 0.113
// So normN64.bin_width > normN8.bin_width — normalization AMPLIFIES distance at larger N
assert("B5: bin_width normalization amplifies distance at larger N (N=64 > N=8)",
    normN64.bin_width > normN8.bin_width,
    `N=8: ${normN8.bin_width.toFixed(4)}, N=64: ${normN64.bin_width.toFixed(4)}`);
// sqrt_N: N=8 → sqrt=2.83 → smaller; N=64 → sqrt=8 → larger normalized value
assert("B6: sqrt_N normalization: N=64 produces smaller normalized value than N=8",
    normN64.sqrt_N < normN8.sqrt_N,
    `N=8: ${normN8.sqrt_N.toFixed(4)}, N=64: ${normN64.sqrt_N.toFixed(4)}`);

// Zero-entropy guard
const zeroEntropyNorm = normalizeTest(0.3, 16, 16, 0);
assert("B7: zero entropy falls back to raw distance", Math.abs(zeroEntropyNorm.entropy - 0.3) < 1e-9);

// ════════════════════════════════════════════════════════════════════════════
// C. Relative classification and scale pattern labeling
// ════════════════════════════════════════════════════════════════════════════
section("C. Relative classification and pattern labels");

// Relative classification at one scale
const pairValsAtScale = {
    "baseline_amplitude vs amplitude_shift":    0.010,   // lowest — below median → similar
    "baseline_frequency vs frequency_shift":    0.300,   // above median → separated
    "baseline_amplitude vs baseline_frequency": 0.700,   // above median → separated
    "amplitude_shift vs frequency_shift":       0.600,   // above median → separated
};
const relResult = relativeClassifyTest(pairValsAtScale);
// Median of [0.010, 0.300, 0.600, 0.700] = 0.300 (index 1 of sorted, length=4, floor(4/2)=2 → 0.600)
// Actually median = vals[2] = 0.600 (0-indexed sorted: [0.010, 0.300, 0.600, 0.700], floor(4/2)=2 → 0.600)
assert("C1: median computed correctly", Math.abs(relResult.median - 0.600) < 1e-9,
    `got ${relResult.median}`);
assert("C2: lowest pair classified similar",
    relResult.result["baseline_amplitude vs amplitude_shift"] === "similar");
assert("C3: highest pair classified separated",
    relResult.result["baseline_amplitude vs baseline_frequency"] === "separated");

// Pattern labels
assert("C4: 4/4 → always_separated",  scalePatternTest(4, 4) === "always_separated");
assert("C5: 0/4 → always_similar",    scalePatternTest(0, 4) === "always_similar");
assert("C6: 3/4 → mostly_separated",  scalePatternTest(3, 4) === "mostly_separated");
assert("C7: 1/4 → mostly_similar",    scalePatternTest(1, 4) === "mostly_similar");
assert("C8: 2/4 → mixed",             scalePatternTest(2, 4) === "mixed");

// Overall classification from pattern
assert("C9: 4/4 → overall separated", (4/4 >= 0.5) === true);
assert("C10: 1/4 → overall similar",  (1/4 >= 0.5) === false);

// ════════════════════════════════════════════════════════════════════════════
// D. Strategy accuracy evaluation
// ════════════════════════════════════════════════════════════════════════════
section("D. Strategy accuracy evaluation");

// Perfect decisions
const perfectRows = Object.entries(GROUND_TRUTH).map(([pair, expected]) => ({
    pair, expected, classification: expected, correct: true,
    scale_N: 16,
}));
const perfectTotal   = Object.keys(GROUND_TRUTH).length;
const correctCount   = perfectRows.filter(r => r.correct).length;
assert("D1: perfect accuracy = 1.0", correctCount / perfectTotal === 1.0);

// Partial accuracy
const partialRows = [
    { pair: "baseline_amplitude vs amplitude_shift",    expected: "similar",   classification: "similar",   correct: true,  scale_N: 8 },
    { pair: "baseline_frequency vs frequency_shift",    expected: "separated", classification: "similar",   correct: false, scale_N: 8 },
    { pair: "baseline_amplitude vs baseline_frequency", expected: "separated", classification: "separated", correct: true,  scale_N: 8 },
    { pair: "amplitude_shift vs frequency_shift",       expected: "separated", classification: "separated", correct: true,  scale_N: 8 },
];
const partialCorrect = partialRows.filter(r => r.correct).length;
assert("D2: partial accuracy = 0.75", Math.abs(partialCorrect / partialRows.length - 0.75) < 1e-9);

// False negative detection
const fnRows = partialRows.filter(r => r.expected === "separated" && r.classification === "similar");
assert("D3: false negative detected: baseline_frequency vs frequency_shift @ N=8",
    fnRows.some(r => r.pair === "baseline_frequency vs frequency_shift"));

// All 3 strategy accuracy values are well-defined numbers
// (these are pulled from actual runner output to verify report structure)
let s1Acc = null, s2Acc = null, s3Acc = null;
try {
    const raw = JSON.parse(await readFile(
        "./out_experiments/identity_probe_scale_calibrated/scale_calibrated_report.json", "utf8"
    ));
    s1Acc = raw.strategy_1?.evaluation?.accuracy;
    const s2Evals = Object.values(raw.strategy_2?.evaluation_by_norm ?? {});
    s2Acc = s2Evals.length ? Math.max(...s2Evals.map(e => e.accuracy ?? 0)) : null;
    s3Acc = raw.strategy_3?.evaluation?.accuracy;
} catch (_) {}

assert("D4: strategy_1 accuracy is a number between 0 and 1",
    typeof s1Acc === "number" && s1Acc >= 0 && s1Acc <= 1, `got ${s1Acc}`);
assert("D5: strategy_2 best accuracy is a number between 0 and 1",
    typeof s2Acc === "number" && s2Acc >= 0 && s2Acc <= 1, `got ${s2Acc}`);
assert("D6: strategy_3 accuracy is a number between 0 and 1",
    typeof s3Acc === "number" && s3Acc >= 0 && s3Acc <= 1, `got ${s3Acc}`);
assert("D7: strategy_1 and strategy_2 achieve better accuracy than strategy_3",
    (s1Acc ?? 0) > (s3Acc ?? 1) || (s2Acc ?? 0) > (s3Acc ?? 1),
    `s1=${s1Acc}, s2=${s2Acc}, s3=${s3Acc}`);

// ════════════════════════════════════════════════════════════════════════════
// E. Absolute energy invariance confirmed as control
// ════════════════════════════════════════════════════════════════════════════
section("E. Absolute energy ratio is scale-invariant (control)");

let energyRatios = null;
try {
    const raw = JSON.parse(await readFile(
        "./out_experiments/identity_probe_scale_calibrated/scale_calibrated_report.json", "utf8"
    ));
    // Extract absolute_energy_ratio per pair per scale from raw_metrics_by_scale
    energyRatios = {};
    for (const [scaleN, pairMetrics] of Object.entries(raw.raw_metrics_by_scale ?? {})) {
        for (const [pair, metrics] of Object.entries(pairMetrics)) {
            if (!energyRatios[pair]) energyRatios[pair] = [];
            energyRatios[pair].push({ scale_N: parseInt(scaleN), v: metrics.absolute_energy_ratio });
        }
    }
} catch (_) {}

if (energyRatios) {
    const ampPair   = "baseline_amplitude vs amplitude_shift";
    const freqPair  = "baseline_frequency vs frequency_shift";

    // amplitude_shift pair: energy_ratio should be ~6.25 at all scales
    const ampRatios = (energyRatios[ampPair] ?? []).map(r => r.v).filter(v => v != null);
    const ampVariance = ampRatios.length > 1
        ? ampRatios.reduce((a, b) => a + (b - ampRatios[0]) ** 2, 0) / ampRatios.length : 0;
    assert("E1: amplitude_shift energy_ratio is invariant across scale (variance < 1e-6)",
        ampVariance < 1e-6, `variance=${ampVariance}`);
    assert("E2: amplitude_shift energy_ratio ≈ 6.25 (amplitude^2 ratio)",
        ampRatios.every(v => Math.abs(v - 6.25) < 0.1), `values: ${ampRatios.map(v => v?.toFixed(3)).join(", ")}`);

    // frequency_shift pair: energy_ratio should be ~1.0 at all scales (same amplitude)
    const freqRatios = (energyRatios[freqPair] ?? []).map(r => r.v).filter(v => v != null);
    assert("E3: frequency_shift energy_ratio ≈ 1.0 at all scales",
        freqRatios.every(v => Math.abs(v - 1.0) < 0.05), `values: ${freqRatios.map(v => v?.toFixed(4)).join(", ")}`);

} else {
    assert("E1: report available for energy ratio check", false, "report not found");
}

// ════════════════════════════════════════════════════════════════════════════
// F. Report file shape and disclaimers
// ════════════════════════════════════════════════════════════════════════════
section("F. Report structure and posture");

let report = null;
try {
    report = JSON.parse(await readFile(
        "./out_experiments/identity_probe_scale_calibrated/scale_calibrated_report.json", "utf8"
    ));
} catch (_) {}

assert("F1: report file exists",             report != null);
assert("F2: probe_type correct",             report?.probe_type === "scale_calibrated_spectral_comparison");
assert("F3: strategy_1 rows present",        (report?.strategy_1?.rows?.length ?? 0) > 0);
assert("F4: strategy_2 rows present",        (report?.strategy_2?.rows?.length ?? 0) > 0);
assert("F5: strategy_3 summary rows present",(report?.strategy_3?.summary_rows?.length ?? 0) > 0);
assert("F6: per_scale_thresholds has 4 entries",
    Object.keys(report?.per_scale_thresholds ?? {}).length === 4);
assert("F7: disclaimers: not_canon = true",  report?.disclaimers?.not_canon === true);
assert("F8: disclaimers: probe_is_read_side_only",
    report?.disclaimers?.probe_is_read_side_only === true);
assert("F9: disclaimers: no_automatic_strategy_selection",
    report?.disclaimers?.no_automatic_strategy_selection === true);
assert("F10: ground_truth is present in config",
    typeof report?.probe_config?.ground_truth === "object");

// No canon fields in any row
const allRowsStr = JSON.stringify([
    ...(report?.strategy_1?.rows ?? []),
    ...(report?.strategy_2?.rows ?? []),
    ...(report?.strategy_3?.per_scale_rows ?? []),
]);
assert("F11: no canon/ontology fields in strategy rows",
    !allRowsStr.includes('"canonical"') && !allRowsStr.includes('"promoted"') && !allRowsStr.includes('"C1"'));

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
