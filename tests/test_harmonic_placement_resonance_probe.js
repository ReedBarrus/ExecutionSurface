// tests/test_harmonic_placement_resonance_probe.js
//
// Tests for run_harmonic_placement_resonance_probe.js
//
// Covers:
//   A. Phase-ratio and window-duration computation
//   B. Band-boundary (bin-edge) classification
//   C. Per-scale row required fields
//   D. Cross-cohort comparison asymmetry detection
//   E. Summary logic and resonance classification
//   F. Read-side posture
//
// Run:
//   node tests/test_harmonic_placement_resonance_probe.js

import { readFile } from "node:fs/promises";

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, detail = "") {
    if (cond) { console.log(`  ✓ ${label}`); passed++; }
    else { const m = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`; console.error(m); failures.push(m); failed++; }
}
function section(name) { console.log(`\n── ${name} ──`); }

// ─── Inline mirrors ───────────────────────────────────────────────────────────
const FS_RAW         = 256;
const DOMINANT_HZ    = 8;
const DOMINANT_PERIOD = 1 / DOMINANT_HZ;
const BAND_EDGES     = [0, 16, 32, 48, 64, 80, 96, 112, 128];

function computePhaseRatio(scale_N) {
    return (scale_N / FS_RAW) / DOMINANT_PERIOD;
}

function isBandBoundaryHarmonicTest(hz) {
    return BAND_EDGES.includes(hz);
}

function buildSummaryTest(perScaleRows) {
    const splits = perScaleRows.filter(r => r.split).map(r => r.scale_N);
    const nearUnit = splits.every(N => {
        const r = perScaleRows.find(x => x.scale_N === N);
        return r && Math.abs(r.phase_ratio - 1.0) < 0.15;
    });
    const noSplitAwayFromUnit = perScaleRows.filter(r => !r.split)
        .every(r => Math.abs(r.phase_ratio - 1.0) > 0.15);
    const supported = splits.length > 0 && nearUnit && noSplitAwayFromUnit;
    return { splits, nearUnit, noSplitAwayFromUnit, supported };
}

// ════════════════════════════════════════════════════════════════════════════
// A. Phase-ratio and window-duration computation
// ════════════════════════════════════════════════════════════════════════════
section("A. Phase-ratio and window-duration computation");

assert("A1: window_duration = 32/256 = 0.125s", Math.abs(32/FS_RAW - 0.125) < 1e-9);
assert("A2: dominant_period = 1/8 = 0.125s",    Math.abs(DOMINANT_PERIOD - 0.125) < 1e-9);
assert("A3: phase_ratio = 1.0 at N=32",   Math.abs(computePhaseRatio(32) - 1.0) < 1e-9);
assert("A4: phase_ratio = 0.25 at N=8",   Math.abs(computePhaseRatio(8)  - 0.25) < 1e-9);
assert("A5: phase_ratio = 0.5  at N=16",  Math.abs(computePhaseRatio(16) - 0.5)  < 1e-9);
assert("A6: phase_ratio = 2.0  at N=64",  Math.abs(computePhaseRatio(64) - 2.0)  < 1e-9);

assert("A7: harmonic_spacing = 16_hz - 8_hz = 8",  16 - 8  === 8);
assert("A8: harmonic_spacing = 24_hz - 8_hz = 16", 24 - 8  === 16);
assert("A9: harmonic_spacing = 32_hz - 8_hz = 24", 32 - 8  === 24);
assert("A10: harmonic_ratio = 16/8 = 2",  16 / 8  === 2);
assert("A11: harmonic_ratio = 24/8 = 3",  24 / 8  === 3);
assert("A12: harmonic_ratio = 32/8 = 4",  32 / 8  === 4);

// ════════════════════════════════════════════════════════════════════════════
// B. Band-boundary classification
// ════════════════════════════════════════════════════════════════════════════
section("B. Band-boundary (bin-edge) classification");

// BAND_EDGES = [0, 16, 32, 48, 64, 80, 96, 112, 128]
assert("B1: 16 Hz IS a band boundary (in BAND_EDGES)",     isBandBoundaryHarmonicTest(16) === true);
assert("B2: 32 Hz IS a band boundary",                     isBandBoundaryHarmonicTest(32) === true);
assert("B3: 24 Hz is NOT a band boundary (inside [16,32])",isBandBoundaryHarmonicTest(24) === false);
assert("B4: 8  Hz is NOT a band boundary",                 isBandBoundaryHarmonicTest(8)  === false);
assert("B5: 0  Hz IS a band boundary (DC edge)",           isBandBoundaryHarmonicTest(0)  === true);
assert("B6: 48 Hz IS a band boundary",                     isBandBoundaryHarmonicTest(48) === true);
assert("B7: 40 Hz is NOT a band boundary",                 isBandBoundaryHarmonicTest(40) === false);

// The key structural distinction:
// 16 Hz is at band boundary [0,16]↔[16,32] — energy oscillates with phase
// 24 Hz is inside band [16,32] — energy stays stable
assert("B8: 16 Hz and 24 Hz differ in band-boundary status",
    isBandBoundaryHarmonicTest(16) !== isBandBoundaryHarmonicTest(24));

// Note: bin-divisibility (hz mod df == 0) differs from band-boundary
// At N=32, df=8: 24 mod 8 == 0 (bin-divisible) but 24 is NOT a band boundary
assert("B9: 24 Hz is bin-divisible at N=32 (24 mod 8 = 0) but NOT band-boundary",
    (24 % (FS_RAW / 32)) === 0 && !isBandBoundaryHarmonicTest(24));

// ════════════════════════════════════════════════════════════════════════════
// C. Per-scale row required fields and values
// ════════════════════════════════════════════════════════════════════════════
section("C. Per-scale row required fields");

let report = null;
try {
    report = JSON.parse(await readFile(
        "./out_experiments/harmonic_placement_resonance_probe/harmonic_placement_report.json", "utf8"
    ));
} catch (_) {}

assert("C1: report file exists", report != null);
assert("C2: per_scale_rows present", Array.isArray(report?.per_scale_rows));
assert("C3: 7 cohorts × 4 scales = 28 rows",
    report?.per_scale_rows?.length === 28, `got ${report?.per_scale_rows?.length}`);

const requiredFields = ["cohort_label","dominant_frequency_hz","harmonic_components","harmonic_amplitudes",
    "harmonic_hz","harmonic_amp","harmonic_ratio","harmonic_spacing_hz",
    "scale_N","Fs_hz","window_duration_sec","dominant_period_sec","phase_ratio",
    "basin_count","splitting_observed","harmonic_is_bin_edge","bin_edge_note",
    "inter_window_variance","interpretation","next_action"];
assert("C4: all required fields present on every row",
    (report?.per_scale_rows ?? []).every(r => requiredFields.every(f => f in r)));

// Key values
const h16_50_n32 = report?.per_scale_rows?.find(r => r.cohort_label === "f8_h16_amp0.50" && r.scale_N === 32);
const h24_50_n32 = report?.per_scale_rows?.find(r => r.cohort_label === "f8_h24_amp0.50" && r.scale_N === 32);
const h16_25_n32 = report?.per_scale_rows?.find(r => r.cohort_label === "f8_h16_amp0.25" && r.scale_N === 32);
const h16_75_n32 = report?.per_scale_rows?.find(r => r.cohort_label === "f8_h16_amp0.75" && r.scale_N === 32);

assert("C5: f8_h16_amp0.50 @ N=32: phase_ratio=1.0",
    h16_50_n32?.phase_ratio === 1.0, `got ${h16_50_n32?.phase_ratio}`);
assert("C6: f8_h16_amp0.50 @ N=32: splits (basin_count=2)",
    h16_50_n32?.basin_count === 2 && h16_50_n32?.splitting_observed === true);
assert("C7: f8_h16_amp0.50 @ N=32: harmonic_is_bin_edge = true",
    h16_50_n32?.harmonic_is_bin_edge === true);
assert("C8: f8_h24_amp0.50 @ N=32: harmonic_is_bin_edge = false (24 Hz mid-band)",
    h24_50_n32?.harmonic_is_bin_edge === false);
assert("C9: f8_h24_amp0.50 @ N=32: does NOT split",
    h24_50_n32?.splitting_observed === false);
assert("C10: f8_h16_amp0.25 @ N=32: does NOT split (harmonic too weak)",
    h16_25_n32?.splitting_observed === false);
assert("C11: f8_h16_amp0.75 @ N=32: does NOT split (harmonic too strong — plateau)",
    h16_75_n32?.splitting_observed === false);

// Inter-window variance is much higher for band-boundary harmonics
assert("C12: f8_h16_amp0.50 has much higher iwv than f8_h24_amp0.50 at N=32",
    (h16_50_n32?.inter_window_variance ?? 0) > 50 * (h24_50_n32?.inter_window_variance ?? 1),
    `h16: ${h16_50_n32?.inter_window_variance?.toFixed(4)}, h24: ${h24_50_n32?.inter_window_variance?.toFixed(4)}`);

// raw_band_distance present when splitting, null when not
assert("C13: raw_band_distance non-null when splitting",
    h16_50_n32?.raw_band_distance != null);
assert("C14: raw_band_distance null when not splitting",
    h24_50_n32?.raw_band_distance === null);
assert("C15: normalized_band_distance = raw / bin_width when splitting",
    h16_50_n32?.normalized_band_distance != null &&
    Math.abs(h16_50_n32.normalized_band_distance - h16_50_n32.raw_band_distance / (FS_RAW / 32)) < 0.001);

// Splitting at N=16 for f8_h16_amp0.75
const h16_75_n16 = report?.per_scale_rows?.find(r => r.cohort_label === "f8_h16_amp0.75" && r.scale_N === 16);
assert("C16: f8_h16_amp0.75 splits at N=16 (stronger harmonic lowers resonant scale)",
    h16_75_n16?.splitting_observed === true, `got splitting=${h16_75_n16?.splitting_observed}`);

// f8_h32 splits at N=8
const h32_n8 = report?.per_scale_rows?.find(r => r.cohort_label === "f8_h32_amp0.50" && r.scale_N === 8);
assert("C17: f8_h32_amp0.50 splits at N=8 (32 Hz is band boundary, phase_ratio=0.25)",
    h32_n8?.splitting_observed === true);

// ════════════════════════════════════════════════════════════════════════════
// D. Cross-cohort comparison asymmetry detection
// ════════════════════════════════════════════════════════════════════════════
section("D. Cross-cohort comparison asymmetry");

const comparisons = report?.cross_cohort_comparisons ?? [];

// Key comparison: same amplitude, different placement → asymmetry
const placementComp = comparisons.find(c => c.cohort_a === "f8_h16_amp0.50" && c.cohort_b === "f8_h24_amp0.50");
assert("D1: f8_h16_amp0.50 vs f8_h24_amp0.50 comparison present",
    placementComp != null);
assert("D2: placement comparison detects structural asymmetry",
    placementComp?.structural_asymmetry_detected === true);
assert("D3: placement comparison: a splits, b does not",
    placementComp?.splitting_a === true && placementComp?.splitting_b === false);
assert("D4: placement comparison has bin_edge_a=true, bin_edge_b=false",
    placementComp?.bin_edge_a === true && placementComp?.bin_edge_b === false);

// Amplitude comparison: 0.25 vs 0.50
const amp1Comp = comparisons.find(c =>
    c.cohort_a === "f8_h16_amp0.25" && c.cohort_b === "f8_h16_amp0.50");
assert("D5: amplitude comparison 0.25 vs 0.50 present", amp1Comp != null);
assert("D6: amplitude comparison shows asymmetry (0.25 no-split, 0.50 split)",
    amp1Comp?.structural_asymmetry_detected === true &&
    amp1Comp?.splitting_a === false && amp1Comp?.splitting_b === true);

// Amplitude comparison: 0.50 vs 0.75 — both use same bin-edge but different outcome
const amp2Comp = comparisons.find(c =>
    c.cohort_a === "f8_h16_amp0.50" && c.cohort_b === "f8_h16_amp0.75");
assert("D7: amplitude comparison 0.50 vs 0.75 present", amp2Comp != null);
assert("D8: amplitude 0.50 vs 0.75 shows asymmetry (0.50 splits, 0.75 does not)",
    amp2Comp?.structural_asymmetry_detected === true &&
    amp2Comp?.splitting_a === true && amp2Comp?.splitting_b === false);

// Harmonic presence vs absence
const presenceComp = comparisons.find(c =>
    c.cohort_a === "f8_h16_amp0.50" && c.cohort_b === "f8_only");
assert("D9: harmonic presence comparison present", presenceComp != null);
assert("D10: harmonic absence means no split (second harmonic is necessary)",
    presenceComp?.splitting_a === true && presenceComp?.splitting_b === false);

// ════════════════════════════════════════════════════════════════════════════
// E. Summary logic
// ════════════════════════════════════════════════════════════════════════════
section("E. Cross-scale summary and resonance logic");

const summaries = report?.cross_scale_summaries ?? [];

// f8_h16_amp0.50: resonance_supported = true (splits only at N=32, phase_ratio=1)
const h16_50_sum = summaries.find(s => s.cohort_label === "f8_h16_amp0.50");
assert("E1: f8_h16_amp0.50 resonance_supported = true",
    h16_50_sum?.resonance_supported === true);
assert("E2: f8_h16_amp0.50 splitting_scales = [32]",
    JSON.stringify(h16_50_sum?.splitting_scales) === "[32]");

// f8_h24_amp0.50: no splitting
const h24_50_sum = summaries.find(s => s.cohort_label === "f8_h24_amp0.50");
assert("E3: f8_h24_amp0.50 resonance_supported = false (no splitting)",
    h24_50_sum?.resonance_supported === false);
assert("E4: f8_h24_amp0.50 splitting_scales is empty",
    h24_50_sum?.splitting_scales?.length === 0);

// Test the inline summary logic
const perfectResonance = [
    { scale_N:  8, phase_ratio: 0.25, split: false },
    { scale_N: 16, phase_ratio: 0.50, split: false },
    { scale_N: 32, phase_ratio: 1.00, split: true  },
    { scale_N: 64, phase_ratio: 2.00, split: false },
];
assert("E5: perfect resonance case supported", buildSummaryTest(perfectResonance).supported);

const noSplit = perfectResonance.map(r => ({ ...r, split: false }));
assert("E6: no-split case not supported", !buildSummaryTest(noSplit).supported);

const offRatio = [
    { scale_N: 8, phase_ratio: 0.25, split: true  },  // away from unit
    ...perfectResonance.slice(1),
];
assert("E7: off-ratio split not supported", !buildSummaryTest(offRatio).supported);

// f8_h16_amp0.75 summary — splits at N=16, not N=32
const h16_75_sum = summaries.find(s => s.cohort_label === "f8_h16_amp0.75");
assert("E8: f8_h16_amp0.75 splitting_scales = [16]",
    JSON.stringify(h16_75_sum?.splitting_scales) === "[16]",
    `got ${JSON.stringify(h16_75_sum?.splitting_scales)}`);

// ════════════════════════════════════════════════════════════════════════════
// F. Read-side posture
// ════════════════════════════════════════════════════════════════════════════
section("F. Read-side posture");

assert("F1: not_canon = true",                      report?.disclaimers?.not_canon === true);
assert("F2: probe_is_read_side_only = true",         report?.disclaimers?.probe_is_read_side_only === true);
assert("F3: basin_op_not_modified = true",           report?.disclaimers?.basin_op_not_modified === true);
assert("F4: no_new_identity_channel = true",         report?.disclaimers?.no_new_identity_channel === true);
assert("F5: no_phase_channel_added = true",          report?.disclaimers?.no_phase_channel_added === true);
assert("F6: harmonic_placement_is_diagnostic = true",report?.disclaimers?.harmonic_placement_is_diagnostic === true);

// No canon fields in rows
const rowStr = JSON.stringify([...(report?.per_scale_rows ?? []), ...(report?.cross_scale_summaries ?? [])]);
assert("F7: no canon/ontology fields in probe rows",
    !rowStr.includes('"canonical"') && !rowStr.includes('"promoted"') && !rowStr.includes('"C1"'));

// Band-boundary definition present in config
assert("F8: band-boundary definition in config",
    typeof report?.probe_config?.bin_edge_definition === "string" &&
    report.probe_config.bin_edge_definition.length > 0);

// All 7 cohorts × 4 scales × required fields present
assert("F9: all 28 per-scale rows have non-null phase_ratio",
    (report?.per_scale_rows ?? []).every(r => typeof r.phase_ratio === "number" && r.phase_ratio > 0));
assert("F10: all 28 rows have non-null inter_window_variance",
    (report?.per_scale_rows ?? []).every(r => typeof r.inter_window_variance === "number"));

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
