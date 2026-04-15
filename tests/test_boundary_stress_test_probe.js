// tests/test_boundary_stress_test_probe.js
//
// Tests for run_boundary_stress_test_probe.js
//
// Covers:
//   A. Boundary stress metric computations
//   B. Per-frequency row required fields
//   C. Sweep summary logic
//   D. Read-side posture
//
// Run:
//   node tests/test_boundary_stress_test_probe.js

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

function nearestBandEdge(hz) {
    let best = BAND_EDGES[0], bestDist = Infinity;
    for (const e of BAND_EDGES) { const d = Math.abs(hz - e); if (d < bestDist) { bestDist = d; best = e; } }
    return best;
}
function distanceToBandEdge(hz) { return parseFloat(Math.abs(hz - nearestBandEdge(hz)).toFixed(6)); }
function isOnBandEdge(hz)        { return distanceToBandEdge(hz) < 0.001; }

function buildSweepSummaryTest(rows) {
    const splits   = rows.filter(r => r.split);
    const allHz    = rows.map(r => r.hz);
    const maxIwvR  = rows.reduce((a, b) => b.iwv > a.iwv ? b : a);
    const shape    = splits.length === 0 ? "no_splitting"
                   : splits.length === 1 ? "sharp_spike"
                   : splits.length <= 3  ? "narrow_peak"
                   : "broad_zone";
    // Symmetry at the edge: compare ±step
    const edgeHz  = splits[0]?.hz;
    let symmetric = null;
    if (edgeHz != null) {
        const step = rows[1]?.hz - rows[0]?.hz;
        const below = rows.find(r => Math.abs(r.hz - (edgeHz - step)) < step * 0.1);
        const above = rows.find(r => Math.abs(r.hz - (edgeHz + step)) < step * 0.1);
        if (below && above) symmetric = Math.abs(below.iwv - above.iwv) < 0.01;
    }
    return { splits: splits.map(r => r.hz), shape, maxIwvHz: maxIwvR.hz, symmetric };
}

// ════════════════════════════════════════════════════════════════════════════
// A. Boundary stress metric computations
// ════════════════════════════════════════════════════════════════════════════
section("A. Boundary stress metrics");

// nearest_band_edge_hz
assert("A1: nearest edge of 16.0 Hz is 16",   nearestBandEdge(16.0) === 16);
assert("A2: nearest edge of 15.5 Hz is 16",   nearestBandEdge(15.5) === 16);
assert("A3: nearest edge of 12.0 Hz is 16",   nearestBandEdge(12.0) === 16);
assert("A4: nearest edge of 8.0  Hz is 0",    nearestBandEdge(8.0)  === 0);  // 0 is closer than 16
assert("A5: nearest edge of 24.0 Hz is 16 or 32",
    nearestBandEdge(24.0) === 16 || nearestBandEdge(24.0) === 32);  // equidistant
assert("A6: nearest edge of 30.0 Hz is 32",   nearestBandEdge(30.0) === 32);
assert("A7: nearest edge of 33.0 Hz is 32",   nearestBandEdge(33.0) === 32);

// distance_to_band_edge_hz
assert("A8:  dist(16.0)  = 0.0",   distanceToBandEdge(16.0) === 0.0);
assert("A9:  dist(15.5)  = 0.5",   Math.abs(distanceToBandEdge(15.5) - 0.5) < 1e-6);
assert("A10: dist(14.0)  = 2.0",   Math.abs(distanceToBandEdge(14.0) - 2.0) < 1e-6);
assert("A11: dist(32.0)  = 0.0",   distanceToBandEdge(32.0) === 0.0);
assert("A12: dist(31.5)  = 0.5",   Math.abs(distanceToBandEdge(31.5) - 0.5) < 1e-6);
assert("A13: dist(20.5)  = 4.5",   Math.abs(distanceToBandEdge(20.5) - 4.5) < 1e-6);

// harmonic_is_on_band_edge
assert("A14: 16.0 Hz is on band edge",   isOnBandEdge(16.0));
assert("A15: 32.0 Hz is on band edge",   isOnBandEdge(32.0));
assert("A16: 15.5 Hz is NOT on band edge", !isOnBandEdge(15.5));
assert("A17: 16.5 Hz is NOT on band edge", !isOnBandEdge(16.5));
assert("A18: 24.0 Hz is NOT on band edge", !isOnBandEdge(24.0));

// ════════════════════════════════════════════════════════════════════════════
// B. Per-frequency row required fields
// ════════════════════════════════════════════════════════════════════════════
section("B. Per-frequency row fields");

let report = null;
try {
    report = JSON.parse(await readFile(
        "./out_experiments/boundary_stress_test_probe/boundary_stress_test_report.json", "utf8"
    ));
} catch (_) {}

assert("B1: report file exists", report != null);
assert("B2: per_frequency_rows present", Array.isArray(report?.per_frequency_rows));

const requiredFields = ["cohort_label","fundamental_hz","harmonic_hz","harmonic_amp",
    "harmonic_spacing_hz","harmonic_ratio","scale_N","Fs_hz","phase_ratio",
    "nearest_band_edge_hz","distance_to_band_edge_hz","harmonic_is_on_band_edge",
    "basin_count","splitting_observed",
    "inter_window_variance","energy_redistribution_index",
    "dominant_band_stability","band_transition_rate",
    "interpretation","next_action"];
assert("B3: all required fields present on every row",
    (report?.per_frequency_rows ?? []).every(r => requiredFields.every(f => f in r)));

// Specific row values
const h16 = report?.per_frequency_rows?.find(r => r.harmonic_hz === 16.0 && r.harmonic_amp === 0.50 && r.sweep_name === "boundary16_amp0.50");
const h155 = report?.per_frequency_rows?.find(r => r.harmonic_hz === 15.5);
const h165 = report?.per_frequency_rows?.find(r => r.harmonic_hz === 16.5);
const h32  = report?.per_frequency_rows?.find(r => r.harmonic_hz === 32.0 && r.sweep_name === "boundary32_amp0.50");

assert("B4: h=16.0 splits (basin_count=2)",
    h16?.basin_count === 2 && h16?.splitting_observed === true);
assert("B5: h=16.0 is on band edge",
    h16?.harmonic_is_on_band_edge === true);
assert("B6: h=16.0 distance=0",
    h16?.distance_to_band_edge_hz === 0);
assert("B7: h=16.0 has raw_band_distance non-null",
    h16?.raw_band_distance != null);
assert("B8: h=16.0 normalized_band_distance = raw / 8",
    Math.abs(h16.normalized_band_distance - h16.raw_band_distance / 8) < 0.001);

assert("B9: h=15.5 does NOT split",
    h155?.splitting_observed === false);
assert("B10: h=15.5 distance=0.5",
    Math.abs((h155?.distance_to_band_edge_hz ?? 99) - 0.5) < 0.001);
assert("B11: h=16.5 does NOT split",
    h165?.splitting_observed === false);

// IWV spike at 16 Hz: should be much higher than adjacent (observed ~1.8×)
assert("B12: IWV at h=16.0 is > 1.5× IWV at h=15.5",
    (h16?.inter_window_variance ?? 0) > 1.5 * (h155?.inter_window_variance ?? 1),
    `h16=${h16?.inter_window_variance?.toFixed(4)}, h15.5=${h155?.inter_window_variance?.toFixed(4)}`);
assert("B13: IWV at h=16.0 is > 1.5× IWV at h=16.5",
    (h16?.inter_window_variance ?? 0) > 1.5 * (h165?.inter_window_variance ?? 1));

// ERI (energy_redistribution_index) also higher at 16 Hz
assert("B14: ERI at h=16.0 > ERI at h=15.5",
    (h16?.energy_redistribution_index ?? 0) > (h155?.energy_redistribution_index ?? 1));

// 32 Hz boundary: no splitting
assert("B15: h=32.0 does NOT split",
    h32?.splitting_observed === false);
assert("B16: h=32.0 is on band edge",
    h32?.harmonic_is_on_band_edge === true);
assert("B17: h=32.0 IWV < h=16.0 IWV",
    (h32?.inter_window_variance ?? 1) < (h16?.inter_window_variance ?? 0));

// Amplitude sweep rows
const amp10  = report?.per_frequency_rows?.find(r => r.harmonic_hz === 16.0 && r.harmonic_amp === 0.10);
const amp35  = report?.per_frequency_rows?.find(r => r.harmonic_hz === 16.0 && r.harmonic_amp === 0.35);
const amp75  = report?.per_frequency_rows?.find(r => r.harmonic_hz === 16.0 && r.harmonic_amp === 0.75);

assert("B18: amp=0.10 at h=16 does NOT split",  amp10?.splitting_observed === false);
assert("B19: amp=0.35 at h=16 DOES split",       amp35?.splitting_observed === true);
assert("B20: amp=0.75 at h=16 does NOT split",   amp75?.splitting_observed === false);

// ════════════════════════════════════════════════════════════════════════════
// C. Sweep summary logic
// ════════════════════════════════════════════════════════════════════════════
section("C. Sweep summary logic");

// Test the inline summary builder
const perfectSpike = [
    { hz: 15.5, iwv: 0.171, split: false },
    { hz: 16.0, iwv: 0.305, split: true  },
    { hz: 16.5, iwv: 0.179, split: false },
];
const spikeSummary = buildSweepSummaryTest(perfectSpike);
assert("C1: sharp spike case → shape=sharp_spike",   spikeSummary.shape === "sharp_spike");
assert("C2: sharp spike case → splits=[16.0]",       JSON.stringify(spikeSummary.splits) === "[16]");
assert("C3: sharp spike case → maxIwvHz=16",         spikeSummary.maxIwvHz === 16.0);

const narrowPeak = [
    { hz: 15.5, iwv: 0.18, split: false },
    { hz: 16.0, iwv: 0.31, split: true  },
    { hz: 16.5, iwv: 0.28, split: true  },
    { hz: 17.0, iwv: 0.20, split: false },
];
assert("C4: narrow peak → shape=narrow_peak",
    buildSweepSummaryTest(narrowPeak).shape === "narrow_peak");

const noSplit = perfectSpike.map(r => ({ ...r, split: false }));
assert("C5: no splitting → shape=no_splitting",
    buildSweepSummaryTest(noSplit).shape === "no_splitting");

// Symmetry test: IWV at ±0.5 Hz
const symmetricData = [
    { hz: 15.5, iwv: 0.171, split: false },
    { hz: 16.0, iwv: 0.305, split: true  },
    { hz: 16.5, iwv: 0.172, split: false },  // ~same as 15.5
];
assert("C6: near-symmetric IWV → symmetric=true",
    buildSweepSummaryTest(symmetricData).symmetric === true);

const asymmetricData = [
    { hz: 15.5, iwv: 0.150, split: false },
    { hz: 16.0, iwv: 0.305, split: true  },
    { hz: 16.5, iwv: 0.200, split: false },  // notably different from 15.5
];
assert("C7: asymmetric IWV → symmetric=false",
    buildSweepSummaryTest(asymmetricData).symmetric === false);

// Report sweep summaries
const sums = report?.sweep_summaries ?? [];
const sum16 = sums.find(s => s.sweep_name === "boundary16_amp0.50");
const sum32 = sums.find(s => s.sweep_name === "boundary32_amp0.50");
const sumAmp = sums.find(s => s.sweep_name?.includes("ampsweep"));

assert("C8: boundary16 sweep summary present",      sum16 != null);
assert("C9: boundary32 sweep summary present",      sum32 != null);
assert("C10: amplitude sweep summary present",       sumAmp != null);
assert("C11: boundary16 response_shape = sharp_spike",
    sum16?.response_shape === "sharp_spike", `got ${sum16?.response_shape}`);
assert("C12: boundary16 splitting_zone = [16]",
    JSON.stringify(sum16?.splitting_zone_hz) === "[16]");
assert("C13: boundary32 response_shape = no_splitting",
    sum32?.response_shape === "no_splitting");
assert("C14: peak IWV at h=16 for boundary16 sweep",
    sum16?.peak_inter_window_variance_hz === 16);

// Amplitude sweep summary
const splitAmps = (report?.per_frequency_rows ?? [])
    .filter(r => r.sweep_name?.includes("ampsweep") && r.splitting_observed)
    .map(r => r.harmonic_amp);
assert("C15: amplitude sweep shows splitting in finite window (at least 2 amplitudes)",
    splitAmps.length >= 2, `found ${splitAmps.length} splitting amplitudes`);
assert("C16: amplitude splitting window excludes 0.10 (too weak)",
    !splitAmps.includes(0.10));
assert("C17: amplitude splitting window excludes 0.75 (too strong)",
    !splitAmps.includes(0.75));

// ════════════════════════════════════════════════════════════════════════════
// D. Read-side posture
// ════════════════════════════════════════════════════════════════════════════
section("D. Read-side posture");

assert("D1: not_canon = true",             report?.disclaimers?.not_canon === true);
assert("D2: probe_is_read_side_only=true", report?.disclaimers?.probe_is_read_side_only === true);
assert("D3: basin_op_not_modified=true",   report?.disclaimers?.basin_op_not_modified === true);
assert("D4: band_edges_not_changed=true",  report?.disclaimers?.band_edges_not_changed === true);
assert("D5: no_new_identity_channel=true", report?.disclaimers?.no_new_identity_channel === true);

const rowStr = JSON.stringify(report?.per_frequency_rows ?? []);
assert("D6: no canon fields in rows",
    !rowStr.includes('"canonical"') && !rowStr.includes('"promoted"') && !rowStr.includes('"C1"'));

assert("D7: metric_definitions in config",
    typeof report?.probe_config?.metric_definitions === "object");
assert("D8: key_findings in report",
    typeof report?.key_findings === "object");
assert("D9: response_shape in key_findings",
    typeof report?.key_findings?.response_shape === "string");

// All rows have required stress metrics
assert("D10: all rows have inter_window_variance",
    (report?.per_frequency_rows ?? []).every(r => typeof r.inter_window_variance === "number"));
assert("D11: all rows have energy_redistribution_index",
    (report?.per_frequency_rows ?? []).every(r => typeof r.energy_redistribution_index === "number"));
assert("D12: all rows have dominant_band_stability",
    (report?.per_frequency_rows ?? []).every(r => typeof r.dominant_band_stability === "number"));
assert("D13: all rows have band_transition_rate",
    (report?.per_frequency_rows ?? []).every(r => typeof r.band_transition_rate === "number"));

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
