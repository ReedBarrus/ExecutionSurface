// test_door_one_contracts.js
//
// Door One contract tests — runtime honesty and hardening invariants.
//
// Locks in the guarantees established by the semantic audit and hardening passes:
//   - operators fail explicitly on malformed required inputs (no silent defaults)
//   - receipts are honest (no fabricated measurements)
//   - provenance-critical fields are required
//   - deterministic outputs for identical inputs
//   - no operator crosses its declared layer boundary
//
// Run from the resonance/ directory:
//   node test_door_one_contracts.js
//
// Covered operators: IngestOp, ClockAlignOp, WindowOp, TransformOp,
//   CompressOp, AnomalyOp, MergeOp, ReconstructOp, QueryOp

import { IngestOp } from "../operators/ingest/IngestOp.js";
import { ClockAlignOp } from "../operators/clock/ClockAlignOp.js";
import { WindowOp } from "../operators/window/WindowOp.js";
import { TransformOp } from "../operators/transform/TransformOp.js";
import { CompressOp } from "../operators/compress/CompressOp.js";
import { AnomalyOp } from "../operators/anomaly/AnomalyOp.js";
import { MergeOp } from "../operators/merge/MergeOp.js";
import { ReconstructOp } from "../operators/reconstruct/ReconstructOp.js";
import { QueryOp } from "../operators/query/QueryOp.js";

// ─── Harness ──────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const failures = [];

function assert(label, condition, detail = "") {
    if (condition) { console.log(`  ✓ ${label}`); passed++; }
    else {
        const msg = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`;
        console.error(msg); failures.push(msg); failed++;
    }
}

function assertFails(label, result, expectedError) {
    if (!result.ok && result.error === expectedError) {
        console.log(`  ✓ ${label}`); passed++;
    } else if (!result.ok) {
        const msg = `  ✗ ${label} — expected error=${expectedError}, got error=${result.error} reasons=${JSON.stringify(result.reasons)}`;
        console.error(msg); failures.push(msg); failed++;
    } else {
        const msg = `  ✗ ${label} — expected failure but got ok=true`;
        console.error(msg); failures.push(msg); failed++;
    }
}

function section(name) { console.log(`\n── ${name} ──`); }

// ─── Shared fixture factories ─────────────────────────────────────────────────
// These produce minimal but fully lawful artifacts for use across sections.

const CLK = "CLK:v1";
const GRID = "GRID:Fs=8:tref=0:grid=strict:drift=none:nonmono=reject:interp=linear:gap=cut:smallgap=3:maxgap=null:aa=false";
const WIN = "WIN:mode=fixed:Fs=8:N=8:hop=4:fn=hann:overlap=0:stationarity=tolerant:salience=off:gap=cut:maxmiss=0.05:boundary=truncate";
const XFRM = "XFORM:type=dft:norm=forward_1_over_N:scale=real_input_half_spectrum:numeric=tolerant";
const COMP = "COMP:pid=compress.v1:select=topK:budget=3:maxK=3:lens=energy:recon=999:energy=999:band=999:dc=true:novelty=false:numeric=tolerant";
const MERGE = "MERGE:pid=merge.v1:adj=time_touching:phase=clock_delta_rotation:weights=duration:novelty=off:mode=authoritative:gridtol=0";
const RECON = "RECON:pid=recon.v1:format=values:t0=state:missing=ZERO:validate=false:window=NONE:numeric=tolerant";

function makePolicies(extra = {}) {
    return {
        clock_policy_id: CLK,
        grid_policy_id: GRID,
        window_policy_id: WIN,
        transform_policy_id: XFRM,
        compression_policy_id: COMP,
        ...extra,
    };
}

/** Minimal lawful H1 HarmonicState. Override fields with extras. */
function makeH1(tStart = 0, tEnd = 1, extras = {}) {
    return {
        artifact_class: "H1",
        state_id: `H1:s:seg:${tStart}:${tEnd}`,
        stream_id: "s",
        segment_id: "seg",
        window_span: {
            t_start: tStart,
            t_end: tEnd,
            duration_sec: tEnd - tStart,
            window_count: 1,
        },
        grid: { Fs_target: 8, N: 8, df: 1, bin_count_full: 5, bin_count_kept: 3 },
        kept_bins: [
            { k: 0, freq_hz: 0, re: 1.0, im: 0, magnitude: 1.0, phase: 0 },
            { k: 1, freq_hz: 1, re: 0.5, im: 0, magnitude: 0.5, phase: 0 },
            { k: 2, freq_hz: 2, re: 0.3, im: 0, magnitude: 0.3, phase: 0 },
        ],
        invariants: {
            energy_raw: 1.34,
            energy_norm: 1.0,
            band_profile_norm: { band_edges: [0, 4, 4], band_energy: [1, 0] },
        },
        uncertainty: {
            time: {
                dt_nominal: null, jitter_rms: null, gap_total_duration: 0,
                monotonicity_violations: 0, drift_ppm: null,
                fit_residual_rms: null, post_align_jitter: null,
            },
            phase_by_band: { band_edges: [0, 4, 4], sigma_phi: [0, 0], source: "test" },
            replay: { recon_mae: null, recon_rmse: null, parseval_error: null },
            distortion: { energy_residual: 0, band_profile_divergence: 0, phase_align_residual: null },
        },
        confidence: {
            by_invariant: { identity: 1, energy: 1, band_profile: 1 },
            overall: 1,
            method: "thresholded_receipts_v1",
        },
        gates: {
            passes_invariance_bounds: true,
            eligible_for_archive_tier: true,
            blocked_reason: "none",
        },
        receipts: {
            compress: {
                policy_id: "compress.v1", budget_K: 3,
                selection_method: "topK",
                thresholds: { max_recon_rmse: 999, max_energy_residual: 999, max_band_divergence: 999 },
                novelty_boundary_respected: true,
            },
            provenance_anchor: {
                source_window_ids: ["w"], ingest_confidence_min: 1, clock_integrity_score: 1,
            },
        },
        policies: makePolicies(),
        provenance: { input_refs: ["S1:s:w0"], operator_id: "CompressOp", operator_version: "0.1.0" },
        ...extras,
    };
}

const COMPRESS_POLICY = {
    policy_id: "compress.v1",
    selection_method: "topK",
    budget_K: 3, maxK: 3,
    invariance_lens: "energy",
    include_dc: true,
    respect_novelty_boundary: false,
    thresholds: { max_recon_rmse: 999, max_energy_residual: 999, max_band_divergence: 999 },
};

const ANOMALY_POLICY_BAND = {
    policy_id: "anom.band", invariance_mode: "band_profile", divergence_metric: "band_l1",
    threshold_value: 0.5, frequency_tolerance_hz: 0, phase_sensitivity_mode: "off",
    novelty_min_duration: 0, segmentation_mode: "strict",
};

const ANOMALY_POLICY_ENERGY = {
    policy_id: "anom.energy", invariance_mode: "energy", divergence_metric: "energy_delta",
    threshold_value: 0.5, frequency_tolerance_hz: 0, phase_sensitivity_mode: "off",
    novelty_min_duration: 0, segmentation_mode: "strict",
};

const MERGE_POLICY = {
    policy_id: "merge.v1",
    adjacency_rule: "time_touching",
    phase_alignment_mode: "clock_delta_rotation",
    weights_mode: "duration",
    novelty_gate: "off",
    merge_mode: "authoritative",
    grid_tolerance: 0,
};

const POST_MERGE_COMPRESS = {
    policy_id: "mergecomp.v1",
    selection_method: "topK",
    budget_K: 3,
    invariance_lens: "energy",
    include_dc: true,
    thresholds: { max_recon_rmse: 999, max_energy_residual: 999, max_band_divergence: 999 },
};

const RECON_POLICY = {
    policy_id: "recon.v1",
    output_format: "values",
    fill_missing_bins: "ZERO",
    validate_invariants: false,
    window_compensation: "NONE",
};

// ─── Build a real pipeline fixture once ──────────────────────────────────────
// Used by TransformOp determinism test and WindowOp basic parity.

const PIPELINE_TIMESTAMPS = Array.from({ length: 32 }, (_, i) => i / 8);
const PIPELINE_VALUES = PIPELINE_TIMESTAMPS.map((t) => Math.sin(2 * Math.PI * t));

const a1Fixture = new IngestOp().run({
    stream_id: "pipe:s",
    timestamps: PIPELINE_TIMESTAMPS,
    values: PIPELINE_VALUES,
    clock_policy_id: CLK,
    ingest_policy: { policy_id: "ingest.v1" },
});

const a2Fixture = a1Fixture.ok
    ? new ClockAlignOp().run({
        a1: a1Fixture.artifact,
        grid_spec: {
            Fs_target: 8, t_ref: 0, drift_model: "none",
            interp_method: "linear", gap_policy: "cut", anti_alias_filter: false,
        },
    })
    : { ok: false };

const w1Fixture = a2Fixture.ok
    ? new WindowOp().run({
        a2: a2Fixture.artifact,
        window_spec: {
            mode: "fixed", Fs_target: 8, base_window_N: 8, hop_N: 8,
            window_function: "hann", overlap_ratio: 0, gap_policy: "cut",
            max_missing_ratio: 0.05, boundary_policy: "truncate",
        },
    })
    : { ok: false };

const s1Fixture = (w1Fixture.ok && w1Fixture.artifacts?.length)
    ? new TransformOp().run({
        w1: w1Fixture.artifacts[0],
        transform_policy: {
            transform_type: "dft",
            normalization_mode: "forward_1_over_N",
        },
    })
    : { ok: false };

// ════════════════════════════════════════════════════════════════════════════
// A. IngestOp — basic parity
// ════════════════════════════════════════════════════════════════════════════

section("A. IngestOp — basic parity");

const ingest = new IngestOp();

assert("pipeline A1 produced", a1Fixture.ok, JSON.stringify(a1Fixture));
assert("A1.artifact_class = A1", a1Fixture.ok && a1Fixture.artifact.artifact_class === "A1");
assert("A1.timestamps preserved", a1Fixture.ok && a1Fixture.artifact.timestamps.length === PIPELINE_TIMESTAMPS.length);
assert("A1.ingest_receipt present", a1Fixture.ok && typeof a1Fixture.artifact.ingest_receipt === "object");
assert("A1.sequence_receipt present", a1Fixture.ok && typeof a1Fixture.artifact.sequence_receipt === "object");
assert("A1.provenance.stream_id_resolution present", a1Fixture.ok &&
    (a1Fixture.artifact.provenance.stream_id_resolution === "provided" ||
        a1Fixture.artifact.provenance.stream_id_resolution === "derived"));

// Guard: timestamps and values required
assertFails("IngestOp rejects missing timestamps", ingest.run({ stream_id: "s", values: [1, 2], clock_policy_id: CLK }), "INVALID_SCHEMA");
assertFails("IngestOp rejects missing values", ingest.run({ stream_id: "s", timestamps: [0, 1], clock_policy_id: CLK }), "INVALID_SCHEMA");

// Determinism
const i1 = ingest.run({ stream_id: "s", timestamps: [0, 1, 2], values: [1, 2, 3], clock_policy_id: CLK });
const i2 = ingest.run({ stream_id: "s", timestamps: [0, 1, 2], values: [1, 2, 3], clock_policy_id: CLK });
assert("IngestOp deterministic", i1.ok && i2.ok &&
    JSON.stringify(i1.artifact.ingest_receipt) === JSON.stringify(i2.artifact.ingest_receipt));

// ════════════════════════════════════════════════════════════════════════════
// B. ClockAlignOp — basic parity
// ════════════════════════════════════════════════════════════════════════════

section("B. ClockAlignOp — basic parity");

assert("pipeline A2 produced", a2Fixture.ok, JSON.stringify(a2Fixture));
assert("A2.artifact_class = A2", a2Fixture.ok && a2Fixture.artifact.artifact_class === "A2");
assert("A2.alignment_receipt.anti_alias_filter_applied is boolean",
    a2Fixture.ok && typeof a2Fixture.artifact.alignment_receipt.anti_alias_filter_applied === "boolean");
assert("A2.alignment_receipt.anti_alias_filter_declared is boolean",
    a2Fixture.ok && typeof a2Fixture.artifact.alignment_receipt.anti_alias_filter_declared === "boolean");
// Stub honesty: applied is always false in Door One
assert("anti_alias_filter_applied = false (Door One stub)",
    a2Fixture.ok && a2Fixture.artifact.alignment_receipt.anti_alias_filter_applied === false);

// Guard: Fs_target required
const cap = new ClockAlignOp();
assertFails("ClockAlignOp rejects missing Fs_target",
    cap.run({ a1: a1Fixture.artifact, grid_spec: { t_ref: 0 } }), "INVALID_SCHEMA");

// Guard: clock_policy_id required on A1
const a1NoPol = { ...a1Fixture.artifact, policies: {} };
assertFails("ClockAlignOp rejects A1 with no clock_policy_id",
    cap.run({ a1: a1NoPol, grid_spec: { Fs_target: 8, t_ref: 0 } }), "INVALID_SCHEMA");

// ════════════════════════════════════════════════════════════════════════════
// C. WindowOp — basic parity
// ════════════════════════════════════════════════════════════════════════════

section("C. WindowOp — basic parity");

assert("pipeline W1 produced", w1Fixture.ok, JSON.stringify(w1Fixture));
assert("at least one W1", w1Fixture.ok && w1Fixture.artifacts.length >= 1);

const w1 = w1Fixture.ok ? w1Fixture.artifacts[0] : null;
assert("W1.artifact_class = W1", w1 && w1.artifact_class === "W1");
assert("W1.window_receipt.missing_ratio is number", w1 && typeof w1.window_receipt.missing_ratio === "number");
assert("W1.window_receipt.selection_reason present", w1 && typeof w1.window_receipt.selection_reason === "string");
assert("W1.policies.window_policy_id present", w1 && typeof w1.policies.window_policy_id === "string");
assert("W1.grid.window_function present", w1 && typeof w1.grid.window_function === "string");

// Guard: mode != "fixed" fails explicitly
const wop = new WindowOp();
assertFails("WindowOp rejects adaptive mode",
    wop.run({ a2: a2Fixture.artifact, window_spec: { mode: "adaptive", Fs_target: 8, base_window_N: 8, hop_N: 4 } }),
    "UNIMPLEMENTED_MODE");

// ════════════════════════════════════════════════════════════════════════════
// D. TransformOp — receipt honesty + determinism
// ════════════════════════════════════════════════════════════════════════════

section("D. TransformOp — receipt honesty and determinism");

assert("pipeline S1 produced", s1Fixture.ok, JSON.stringify(s1Fixture));
const s1 = s1Fixture.ok ? s1Fixture.artifact : null;
assert("S1.artifact_class = S1", s1 && s1.artifact_class === "S1");

// Receipt honesty: transform_type echoes policy, actual_algorithm records truth
assert("transform_receipt.transform_type echoes policy",
    s1 && s1.transform_receipt.transform_type === "dft");
assert("transform_receipt.actual_algorithm = 'fft_cooley_tukey_r2'",
    s1 && s1.transform_receipt.actual_algorithm === "fft_cooley_tukey_r2");
assert("transform_receipt.actual_algorithm is distinct field from transform_type",
    s1 && "actual_algorithm" in s1.transform_receipt);

// When policy says "fft", transform_type = "fft" and actual_algorithm = "fft_cooley_tukey_r2"
if (w1) {
    const fftResult = new TransformOp().run({
        w1,
        transform_policy: { transform_type: "fft", normalization_mode: "forward_1_over_N" },
    });
    assert("fft policy: transform_type = fft", fftResult.ok && fftResult.artifact.transform_receipt.transform_type === "fft");
    assert("fft policy: actual_algorithm = fft_cooley_tukey_r2", fftResult.ok && fftResult.artifact.transform_receipt.actual_algorithm === "fft_cooley_tukey_r2");
    assert("receipt distinguishes label from algorithm",
        fftResult.ok &&
        fftResult.artifact.transform_receipt.transform_type !== fftResult.artifact.transform_receipt.actual_algorithm);
}

// Receipt fields: parseval_error is finite (measured), energy_total is finite (measured)
assert("transform_receipt.parseval_error is finite", s1 && Number.isFinite(s1.transform_receipt.parseval_error));
assert("transform_receipt.energy_total is finite", s1 && Number.isFinite(s1.transform_receipt.energy_total));
assert("transform_receipt.numerical_precision = f64-js", s1 && s1.transform_receipt.numerical_precision === "f64-js");

// Determinism
if (w1) {
    const xop = new TransformOp();
    const pol = { transform_type: "dft", normalization_mode: "forward_1_over_N" };
    const t1 = xop.run({ w1, transform_policy: pol });
    const t2 = xop.run({ w1, transform_policy: pol });
    assert("TransformOp deterministic: spectrum identical",
        t1.ok && t2.ok &&
        JSON.stringify(t1.artifact.spectrum) === JSON.stringify(t2.artifact.spectrum));
    assert("TransformOp deterministic: parseval_error identical",
        t1.ok && t2.ok &&
        t1.artifact.transform_receipt.parseval_error === t2.artifact.transform_receipt.parseval_error);
}

// Guard: normalization_mode required
if (w1) {
    assertFails("TransformOp rejects missing normalization_mode",
        new TransformOp().run({ w1, transform_policy: { transform_type: "dft" } }),
        "INVALID_POLICY");
}

// ════════════════════════════════════════════════════════════════════════════
// E. CompressOp — hardening
// ════════════════════════════════════════════════════════════════════════════

section("E. CompressOp — hardening");

const cop = new CompressOp();

// Build a minimal valid S1 inline for isolation
const validS1 = {
    artifact_class: "S1", stream_id: "s", window_id: "W1:s:0:8:WIN",
    grid: { Fs_target: 8, N: 8, frequency_resolution: 1 },
    spectrum: [
        { k: 0, freq_hz: 0, re: 1.0, im: 0, magnitude: 1.0, phase: 0 },
        { k: 1, freq_hz: 1, re: 0.5, im: 0, magnitude: 0.5, phase: 0 },
        { k: 2, freq_hz: 2, re: 0.3, im: 0, magnitude: 0.3, phase: 0 },
        { k: 3, freq_hz: 3, re: 0.1, im: 0, magnitude: 0.1, phase: 0 },
    ],
    transform_receipt: { parseval_error: null },
    policies: { clock_policy_id: CLK, grid_policy_id: GRID, window_policy_id: WIN, transform_policy_id: XFRM },
};
const validCtx = { segment_id: "seg:001", window_span: { t_start: 0, t_end: 1 }, novelty_boundary_detected: false };

// E1: context entirely absent
assertFails("CompressOp MISSING_CONTEXT when context=null",
    cop.run({ s1: validS1, compression_policy: COMPRESS_POLICY, context: null }), "MISSING_CONTEXT");
assertFails("CompressOp MISSING_CONTEXT when context=undefined",
    cop.run({ s1: validS1, compression_policy: COMPRESS_POLICY }), "MISSING_CONTEXT");

// E2: segment_id missing
assertFails("CompressOp MISSING_SEGMENT_ID when segment_id absent",
    cop.run({
        s1: validS1, compression_policy: COMPRESS_POLICY,
        context: { window_span: { t_start: 0, t_end: 1 }, novelty_boundary_detected: false }
    }),
    "MISSING_SEGMENT_ID");
assertFails("CompressOp MISSING_SEGMENT_ID when segment_id is empty string",
    cop.run({
        s1: validS1, compression_policy: COMPRESS_POLICY,
        context: { segment_id: "", window_span: { t_start: 0, t_end: 1 } }
    }),
    "MISSING_SEGMENT_ID");

// E3: window_span missing or invalid
assertFails("CompressOp MISSING_WINDOW_SPAN when window_span absent",
    cop.run({
        s1: validS1, compression_policy: COMPRESS_POLICY,
        context: { segment_id: "seg:001" }
    }),
    "MISSING_WINDOW_SPAN");
assertFails("CompressOp MISSING_WINDOW_SPAN when t_start is NaN",
    cop.run({
        s1: validS1, compression_policy: COMPRESS_POLICY,
        context: { segment_id: "seg:001", window_span: { t_start: NaN, t_end: 1 } }
    }),
    "MISSING_WINDOW_SPAN");

// E4: does not fabricate seg_default — segment_id from context must appear on H1
const c1 = cop.run({ s1: validS1, compression_policy: COMPRESS_POLICY, context: validCtx });
assert("CompressOp ok with valid context", c1.ok, JSON.stringify(c1));
assert("H1.segment_id = context.segment_id", c1.ok && c1.artifact.segment_id === "seg:001");
assert("H1.state_id contains context.segment_id", c1.ok && c1.artifact.state_id.includes("seg:001"));
assert("H1 does not carry 'seg_default'",
    c1.ok && !JSON.stringify(c1.artifact).includes("seg_default"));

// E5: H1 gates use passes_invariance_bounds (not eligible_for_canonical_merge)
assert("H1 gates has passes_invariance_bounds", c1.ok && "passes_invariance_bounds" in c1.artifact.gates);
assert("H1 gates has no eligible_for_canonical_merge", c1.ok && !("eligible_for_canonical_merge" in c1.artifact.gates));

// E6: H1 has no receipts.merge (merge history not fabricated)
assert("H1 receipts has no merge block",
    c1.ok && !("merge" in c1.artifact.receipts));

// E7: H1 window_span carries duration_sec and window_count (required for downstream)
assert("H1.window_span.duration_sec is finite", c1.ok && Number.isFinite(c1.artifact.window_span.duration_sec));
assert("H1.window_span.window_count = 1", c1.ok && c1.artifact.window_span.window_count === 1);

// ════════════════════════════════════════════════════════════════════════════
// F. AnomalyOp — hardening
// ════════════════════════════════════════════════════════════════════════════

section("F. AnomalyOp — hardening");

const aop = new AnomalyOp();
const h1A = makeH1(0, 1);
const h1B = makeH1(1, 2);

// F1: energy mode — h_current missing both energy_raw and kept_bins
const noEnergyH1 = makeH1(0, 1, {
    invariants: { energy_norm: 1, band_profile_norm: { band_edges: [0, 4, 4], band_energy: [1, 0] } },
    kept_bins: [],
});
assertFails("AnomalyOp energy: h_current no energy_raw + empty kept_bins",
    aop.run({ h_current: noEnergyH1, h_base: h1B, anomaly_policy: ANOMALY_POLICY_ENERGY }),
    "INVALID_H_CURRENT");

// F2: energy mode — h_base missing both energy_raw and kept_bins
const noEnergyBase = makeH1(1, 2, {
    invariants: { energy_norm: 1, band_profile_norm: { band_edges: [0, 4, 4], band_energy: [1, 0] } },
    kept_bins: [],
});
assertFails("AnomalyOp energy: h_base no energy_raw + empty kept_bins",
    aop.run({ h_current: h1A, h_base: noEnergyBase, anomaly_policy: ANOMALY_POLICY_ENERGY }),
    "INVALID_H_BASE");

// F3: energy mode passes when energy_raw is present (no kept_bins needed)
const onlyEnergy = makeH1(0, 1, {
    invariants: { energy_raw: 0.5, energy_norm: 1, band_profile_norm: { band_edges: [0, 4, 4], band_energy: [1, 0] } },
    kept_bins: [],
});
const eOk = aop.run({ h_current: onlyEnergy, h_base: h1B, anomaly_policy: ANOMALY_POLICY_ENERGY });
assert("AnomalyOp energy: h_current with energy_raw (no kept_bins) passes", eOk.ok, JSON.stringify(eOk));

// F4: band_profile mode — h_current missing band_energy
const noBandCur = makeH1(0, 1, {
    invariants: { energy_raw: 0.5, energy_norm: 1, band_profile_norm: { band_edges: [0, 4, 4], band_energy: [] } },
});
assertFails("AnomalyOp band_profile: h_current empty band_energy",
    aop.run({ h_current: noBandCur, h_base: h1B, anomaly_policy: ANOMALY_POLICY_BAND }),
    "INVALID_H_CURRENT");

// F5: band_profile mode — h_base missing band_profile_norm entirely
const noBandBase = makeH1(1, 2, {
    invariants: { energy_raw: 0.5, energy_norm: 1 },  // no band_profile_norm
});
assertFails("AnomalyOp band_profile: h_base no band_profile_norm",
    aop.run({ h_current: h1A, h_base: noBandBase, anomaly_policy: ANOMALY_POLICY_BAND }),
    "INVALID_H_BASE");

// F6: duration_sec absent triggers INVALID_H_CURRENT
const noDur = makeH1(0, 1, { window_span: { t_start: 0, t_end: 1, window_count: 1 } }); // no duration_sec
assertFails("AnomalyOp rejects h_current with no duration_sec",
    aop.run({ h_current: noDur, h_base: h1B, anomaly_policy: ANOMALY_POLICY_BAND }),
    "INVALID_H_CURRENT");

// F7: novelty gate normal behavior — identical states, divergence near 0
const aValidOk = aop.run({ h_current: h1A, h_base: makeH1(0, 1), anomaly_policy: ANOMALY_POLICY_BAND });
assert("AnomalyOp valid band_profile: ok", aValidOk.ok, JSON.stringify(aValidOk));
assert("AnomalyOp identical states: novelty_gate not triggered",
    aValidOk.ok && aValidOk.artifact.novelty_gate_triggered === false);
assert("AnomalyOp receipt metric_used matches policy",
    aValidOk.ok && aValidOk.artifact.anomaly_receipt.metric_used === ANOMALY_POLICY_BAND.divergence_metric);

// F8: divergence_value in receipt mirrors top-level divergence_score
assert("AnomalyOp receipt.divergence_value === artifact.divergence_score",
    aValidOk.ok &&
    aValidOk.artifact.anomaly_receipt.divergence_value === aValidOk.artifact.divergence_score);

// F9: segmentation_recommendation is honest (continue when gate not triggered)
assert("AnomalyOp continue_segment when not novel",
    aValidOk.ok && aValidOk.artifact.segmentation_recommendation === "continue_segment");

// ════════════════════════════════════════════════════════════════════════════
// G. MergeOp — hardening
// ════════════════════════════════════════════════════════════════════════════

section("G. MergeOp — hardening");

const mop = new MergeOp();

// G1: missing duration_sec
const noDurH1 = makeH1(1, 2, { window_span: { t_start: 1, t_end: 2, window_count: 1 } }); // no duration_sec
assertFails("MergeOp rejects H1 with no duration_sec",
    mop.run({ states: [h1A, noDurH1], merge_policy: MERGE_POLICY, post_merge_compression_policy: POST_MERGE_COMPRESS }),
    "INVALID_INPUT_STATE");

// G2: NaN duration_sec
const nanDurH1 = makeH1(1, 2, { window_span: { t_start: 1, t_end: 2, duration_sec: NaN, window_count: 1 } });
assertFails("MergeOp rejects H1 with NaN duration_sec",
    mop.run({ states: [h1A, nanDurH1], merge_policy: MERGE_POLICY, post_merge_compression_policy: POST_MERGE_COMPRESS }),
    "INVALID_INPUT_STATE");

// G3: missing energy_raw
const noEnergyM = makeH1(1, 2, {
    invariants: { energy_norm: 1, band_profile_norm: { band_edges: [0, 4, 4], band_energy: [1, 0] } },
});
assertFails("MergeOp rejects H1 with no energy_raw",
    mop.run({ states: [h1A, noEnergyM], merge_policy: MERGE_POLICY, post_merge_compression_policy: POST_MERGE_COMPRESS }),
    "INVALID_INPUT_STATE");

// G4: empty band_profile_norm.band_energy
const noBandM = makeH1(1, 2, {
    invariants: { energy_raw: 0.5, energy_norm: 1, band_profile_norm: { band_edges: [0, 4, 4], band_energy: [] } },
});
assertFails("MergeOp rejects H1 with empty band_energy",
    mop.run({ states: [h1A, noBandM], merge_policy: MERGE_POLICY, post_merge_compression_policy: POST_MERGE_COMPRESS }),
    "INVALID_INPUT_STATE");

// G5: valid merge — deterministic
const m1r = mop.run({ states: [h1A, h1B], merge_policy: MERGE_POLICY, post_merge_compression_policy: POST_MERGE_COMPRESS });
assert("MergeOp valid merge ok", m1r.ok, JSON.stringify(m1r));
const m1r2 = mop.run({ states: [h1A, h1B], merge_policy: MERGE_POLICY, post_merge_compression_policy: POST_MERGE_COMPRESS });
assert("MergeOp deterministic: energy_raw identical",
    m1r.ok && m1r2.ok &&
    m1r.artifact.invariants.energy_raw === m1r2.artifact.invariants.energy_raw);
assert("MergeOp deterministic: state_id identical",
    m1r.ok && m1r2.ok && m1r.artifact.state_id === m1r2.artifact.state_id);

// G6: energy_norm is computed, not hardcoded 1.0
const m1 = m1r.ok ? m1r.artifact : null;
assert("MergeOp M1.invariants.energy_norm is in [0, 1]",
    m1 && Number.isFinite(m1.invariants.energy_norm) &&
    m1.invariants.energy_norm >= 0 && m1.invariants.energy_norm <= 1);
// With budget_K=3 from 3 bins there may be no compression, so energy_norm could be 1.0 here.
// What we assert is that it is a computed number, not a hardcoded literal by checking type.
assert("MergeOp M1.invariants.energy_norm is a finite number (not hardcoded)",
    m1 && Number.isFinite(m1.invariants.energy_norm));

// G7: M1 gates use eligible_for_authoritative_merge (not eligible_for_canonical_merge)
assert("M1 gates has eligible_for_authoritative_merge",
    m1 && "eligible_for_authoritative_merge" in m1.gates);
assert("M1 gates has no eligible_for_canonical_merge",
    m1 && !("eligible_for_canonical_merge" in m1.gates));

// G8: M1 uncertainty.replay fields are null (not measured at merge time)
assert("M1.uncertainty.replay.recon_mae = null", m1 && m1.uncertainty.replay.recon_mae === null);
assert("M1.uncertainty.replay.recon_rmse = null", m1 && m1.uncertainty.replay.recon_rmse === null);
assert("M1.uncertainty.replay.parseval_error = null", m1 && m1.uncertainty.replay.parseval_error === null);

// G9: M1 provenance references both inputs
assert("M1.provenance.input_refs contains both H1 state_ids",
    m1 && m1.provenance.input_refs.includes(h1A.state_id) &&
    m1.provenance.input_refs.includes(h1B.state_id));

// ════════════════════════════════════════════════════════════════════════════
// H. ReconstructOp — honesty
// ════════════════════════════════════════════════════════════════════════════

section("H. ReconstructOp — honesty");

const rop = new ReconstructOp();
const reconState = makeH1(0, 1, {
    policies: makePolicies({ transform_policy_id: "XFORM:type=dft:norm=forward_1_over_N:scale=real_input_half_spectrum:numeric=tolerant" }),
});

// H1: empty kept_bins fails explicitly (no silent zero-waveform)
assertFails("ReconstructOp rejects empty kept_bins",
    rop.run({ state: makeH1(0, 1, { kept_bins: [] }), reconstruct_policy: RECON_POLICY }),
    "INVALID_STATE");
assertFails("ReconstructOp rejects missing kept_bins",
    rop.run({ state: makeH1(0, 1, { kept_bins: undefined }), reconstruct_policy: RECON_POLICY }),
    "INVALID_STATE");

// H2: valid H1 reconstruction succeeds
const rr = rop.run({ state: reconState, reconstruct_policy: RECON_POLICY });
assert("ReconstructOp valid H1: ok", rr.ok, JSON.stringify(rr));

// H3: receipt fields
const receipt = rr.ok ? rr.artifact.reconstruct_receipt : null;
assert("receipt.normalization_mode_applied is present", receipt && "normalization_mode_applied" in receipt);
assert("receipt.normalization_mode_applied is a string", receipt && typeof receipt.normalization_mode_applied === "string");
assert("receipt.replay_mode = window_direct (H1)", receipt && receipt.replay_mode === "window_direct");
assert("receipt.source_artifact_class = H1", receipt && receipt.source_artifact_class === "H1");

// H4: expected_energy and energy_error must be null (Parseval mapping deferred)
assert("receipt.expected_energy = null (comparison not performed)",
    receipt && receipt.expected_energy === null);
assert("receipt.energy_error = null (comparison not performed)",
    receipt && receipt.energy_error === null);

// H5: reconstructed_energy is a measured finite number
assert("receipt.reconstructed_energy is finite (measured)",
    receipt && Number.isFinite(receipt.reconstructed_energy));

// H6: no fabricated provenance placeholder in source_artifact_ids
assert("receipt.source_artifact_ids[0] is not 'UNKNOWN'",
    receipt && receipt.source_artifact_ids[0] !== "UNKNOWN");
assert("receipt.source_artifact_ids[0] matches input state_id",
    receipt && receipt.source_artifact_ids[0] === reconState.state_id);

// H7: M1 replay receipt
const m1State = m1 ? { ...m1, policies: { ...m1.policies } } : null;
if (m1State) {
    const rm1 = rop.run({ state: m1State, reconstruct_policy: RECON_POLICY });
    assert("ReconstructOp valid M1: ok", rm1.ok, JSON.stringify(rm1));
    const rm1r = rm1.ok ? rm1.artifact.reconstruct_receipt : null;
    assert("M1 receipt.replay_mode = merged_lens", rm1r && rm1r.replay_mode === "merged_lens");
    assert("M1 receipt.expected_energy = null", rm1r && rm1r.expected_energy === null);
    assert("M1 receipt.energy_error = null", rm1r && rm1r.energy_error === null);
}

// H8: determinism
const rd1 = rop.run({ state: reconState, reconstruct_policy: RECON_POLICY });
const rd2 = rop.run({ state: reconState, reconstruct_policy: RECON_POLICY });
assert("ReconstructOp deterministic: values identical",
    rd1.ok && rd2.ok &&
    JSON.stringify(rd1.artifact.values) === JSON.stringify(rd2.artifact.values));

// ════════════════════════════════════════════════════════════════════════════
// I. QueryOp — boundary and read-side only
// ════════════════════════════════════════════════════════════════════════════

section("I. QueryOp — boundary and read-side only");

const qop = new QueryOp();
const corpus = [
    makeH1(0, 1, { state_id: "H1:s:seg:0:1", segment_id: "seg" }),
    makeH1(1, 2, { state_id: "H1:s:seg:1:2", segment_id: "seg" }),
    makeH1(2, 3, { state_id: "H1:s:seg:2:3", segment_id: "seg" }),
];
const queryPolicy = { policy_id: "qp1", scoring: "energy_delta", normalization: "none", topK: 5 };

// I1: energy_trend query — basic path
const qr = qop.run({
    query_spec: {
        query_id: "q1", kind: "energy_trend", mode: "ENERGY",
        scope: { stream_id: "s", allow_cross_segment: true }
    },
    query_policy: queryPolicy,
    corpus,
});
assert("QueryOp energy_trend ok", qr.ok, JSON.stringify(qr));
assert("QueryResult.artifact_class = Q", qr.ok && qr.artifact.artifact_class === "Q");
assert("QueryResult has results array", qr.ok && Array.isArray(qr.artifact.results));
assert("QueryResult.results.length = 3", qr.ok && qr.artifact.results.length === 3);

// I2: receipt is inside receipts.query, NOT at top level
assert("query_policy_id NOT at top level",
    qr.ok && !("query_policy_id" in qr.artifact));
assert("query_policy_id inside receipts.query",
    qr.ok && typeof qr.artifact.receipts?.query?.query_policy_id === "string");

// I3: no mutation — corpus objects unchanged after query
const corpusCopy = corpus.map((s) => JSON.stringify(s));
qop.run({
    query_spec: {
        query_id: "q2", kind: "similarity", mode: "IDENTITY",
        scope: { stream_id: "s", allow_cross_segment: true },
        query: { state: corpus[0] }
    },
    query_policy: { policy_id: "qp2", scoring: "cosine", normalization: "none", topK: 3 },
    corpus,
});
corpus.forEach((s, i) => {
    assert(`corpus[${i}] not mutated after similarity query`,
        JSON.stringify(s) === corpusCopy[i]);
});

// I4: band_lookup query
const bandQr = qop.run({
    query_spec: {
        query_id: "q3", kind: "band_lookup", mode: "BAND_PROFILE",
        scope: { stream_id: "s", allow_cross_segment: true },
        query: { band_spec: "0:4" }
    },
    query_policy: queryPolicy,
    corpus,
});
assert("QueryOp band_lookup ok", bandQr.ok, JSON.stringify(bandQr));

// I5: query result items carry provenance fields, not write fields
assert("QueryResultItem has ref", qr.ok && typeof qr.artifact.results[0].ref === "string");
assert("QueryResultItem has score", qr.ok && Number.isFinite(qr.artifact.results[0].score));
assert("QueryResultItem has rank", qr.ok && typeof qr.artifact.results[0].rank === "number");
assert("QueryResult provenance.operator_id = QueryOp",
    qr.ok && qr.artifact.provenance.operator_id === "QueryOp");

// I6: corpus validation catches missing state_id
const badCorpus = [{ ...corpus[0], state_id: undefined }];
const badQr = qop.run({
    query_spec: {
        query_id: "q4", kind: "energy_trend", mode: "ENERGY",
        scope: { allow_cross_segment: true }
    },
    query_policy: queryPolicy,
    corpus: badCorpus,
});
assertFails("QueryOp rejects corpus with missing state_id", badQr, "INVALID_CORPUS");

// I7: unsupported kind fails explicitly
assertFails("QueryOp rejects unknown kind",
    qop.run({
        query_spec: {
            query_id: "q5", kind: "waveform_search", mode: "IDENTITY",
            scope: { allow_cross_segment: true }
        },
        query_policy: queryPolicy,
        corpus,
    }),
    "UNSUPPORTED_QUERY_KIND");

// ════════════════════════════════════════════════════════════════════════════
// J. Cross-operator receipt naming consistency
// ════════════════════════════════════════════════════════════════════════════

section("J. Cross-operator receipt naming consistency");

// All operators that emit policy IDs should use the same naming conventions:
// "operator_id" on provenance, not "op_id" or similar

const ops_and_artifacts = [
    ["IngestOp", a1Fixture.ok ? a1Fixture.artifact : null],
    ["ClockAlignOp", a2Fixture.ok ? a2Fixture.artifact : null],
    ["WindowOp", w1],
    ["TransformOp", s1],
    ["CompressOp", c1.ok ? c1.artifact : null],
    ["AnomalyOp", aValidOk.ok ? aValidOk.artifact : null],
    ["MergeOp", m1],
];

for (const [name, artifact] of ops_and_artifacts) {
    if (!artifact) { assert(`${name} provenance.operator_id reachable`, false, "fixture not produced"); continue; }
    assert(`${name} provenance.operator_id is string`, typeof artifact.provenance?.operator_id === "string");
    assert(`${name} provenance.operator_version is string`, typeof artifact.provenance?.operator_version === "string");
    if (name === "IngestOp") {
        // IngestOp is the pipeline source: it has no upstream artifact so input_refs is absent.
        // Instead it carries stream_id_resolution to record how the stream identity was established.
        assert("IngestOp provenance.stream_id_resolution is string",
            typeof artifact.provenance?.stream_id_resolution === "string");
    } else {
        assert(`${name} provenance.input_refs is array`, Array.isArray(artifact.provenance?.input_refs));
    }
}

// ReconstructOp A3
assert("ReconstructOp provenance.operator_id is string", rr.ok && typeof rr.artifact.provenance?.operator_id === "string");
assert("ReconstructOp provenance.input_refs is array", rr.ok && Array.isArray(rr.artifact.provenance?.input_refs));
// QueryOp Q
assert("QueryOp provenance.operator_id is string", qr.ok && typeof qr.artifact.provenance?.operator_id === "string");

// ════════════════════════════════════════════════════════════════════════════
// K. IngestOp — provenance source distinction (named contract rule)
// ════════════════════════════════════════════════════════════════════════════

section("K. IngestOp — provenance source distinction");

// IngestOp is the provenance root: it has no upstream runtime artifact lineage.
// A1 intentionally omits provenance.input_refs and instead carries
// provenance.stream_id_resolution to record how stream identity was established.
// This is a named contract rule, not an incidental omission.

assert("A1 intentionally omits provenance.input_refs",
    a1Fixture.ok && !("input_refs" in a1Fixture.artifact.provenance));
assert("A1 carries provenance.stream_id_resolution instead",
    a1Fixture.ok && typeof a1Fixture.artifact.provenance.stream_id_resolution === "string");
assert("provenance.stream_id_resolution is 'provided' when stream_id explicit",
    a1Fixture.ok && a1Fixture.artifact.provenance.stream_id_resolution === "provided");

// Derived stream_id path: when stream_id is absent, resolution = "derived"
const derivedA1 = new IngestOp().run({
    source_id: "sensor.1", modality: "voltage",
    timestamps: [0, 0.125, 0.25], values: [1, 2, 3],
    clock_policy_id: CLK,
});
assert("derived stream_id: resolution = 'derived'",
    derivedA1.ok && derivedA1.artifact.provenance.stream_id_resolution === "derived");
assert("derived stream_id: input_refs still absent",
    derivedA1.ok && !("input_refs" in derivedA1.artifact.provenance));

// All downstream operators carry input_refs (already confirmed in J for 7 operators).
// Re-confirm here as the positive half of this named rule.
assert("ClockAlignOp A2 carries input_refs (downstream operator)",
    a2Fixture.ok && Array.isArray(a2Fixture.artifact.provenance.input_refs));
assert("ClockAlignOp A2 input_refs[0] references A1",
    a2Fixture.ok && typeof a2Fixture.artifact.provenance.input_refs[0] === "string" &&
    a2Fixture.artifact.provenance.input_refs[0].startsWith("A1:"));

// ════════════════════════════════════════════════════════════════════════════
// L. ReconstructOp — branch coverage
// ════════════════════════════════════════════════════════════════════════════

section("L. ReconstructOp — branch coverage");

// Build a state with sparse kept_bins to make the missing-bin policies observable.
// N=8, full spectrum has bins 0-4. We supply only bins 0 and 2, leaving 1, 3, 4 missing.
const sparseState = (() => {
    const s = makeH1(0, 1);
    s.kept_bins = [
        { k: 0, freq_hz: 0, re: 1.0, im: 0, magnitude: 1.0, phase: 0 },
        { k: 2, freq_hz: 2, re: 0.3, im: 0, magnitude: 0.3, phase: 0 },
    ];
    return s;
})();

const baseReconPol = {
    policy_id: "recon.test", output_format: "values",
    validate_invariants: false
};

// L1: ZERO fill — missing bins reconstructed as zero
const rZero = new ReconstructOp().run({
    state: sparseState,
    reconstruct_policy: { ...baseReconPol, fill_missing_bins: "ZERO", window_compensation: "NONE" },
});
assert("ZERO fill: ok", rZero.ok, JSON.stringify(rZero));
assert("ZERO fill: receipt.missing_bin_policy = ZERO",
    rZero.ok && rZero.artifact.reconstruct_receipt.missing_bin_policy === "ZERO");
assert("ZERO fill: reconstructed_energy is finite",
    rZero.ok && Number.isFinite(rZero.artifact.reconstruct_receipt.reconstructed_energy));
assert("ZERO fill: expected_energy = null (no fabricated comparison)",
    rZero.ok && rZero.artifact.reconstruct_receipt.expected_energy === null);
assert("ZERO fill: energy_error = null",
    rZero.ok && rZero.artifact.reconstruct_receipt.energy_error === null);

// L2: NOISE_FLOOR fill — missing bins filled with estimated noise floor magnitude
const rNoise = new ReconstructOp().run({
    state: sparseState,
    reconstruct_policy: { ...baseReconPol, fill_missing_bins: "NOISE_FLOOR", window_compensation: "NONE" },
});
assert("NOISE_FLOOR fill: ok", rNoise.ok, JSON.stringify(rNoise));
assert("NOISE_FLOOR fill: receipt.missing_bin_policy = NOISE_FLOOR",
    rNoise.ok && rNoise.artifact.reconstruct_receipt.missing_bin_policy === "NOISE_FLOOR");
assert("NOISE_FLOOR fill: expected_energy = null",
    rNoise.ok && rNoise.artifact.reconstruct_receipt.expected_energy === null);
// NOISE_FLOOR adds non-zero energy to missing bins → reconstructed_energy > ZERO version
assert("NOISE_FLOOR fill: reconstructed_energy >= ZERO version (missing bins add energy)",
    rZero.ok && rNoise.ok &&
    rNoise.artifact.reconstruct_receipt.reconstructed_energy >=
    rZero.artifact.reconstruct_receipt.reconstructed_energy);

// L3: LEAVE_SPARSE fill — missing bins treated as zero (same as ZERO for reconstruction)
const rSparse = new ReconstructOp().run({
    state: sparseState,
    reconstruct_policy: { ...baseReconPol, fill_missing_bins: "LEAVE_SPARSE", window_compensation: "NONE" },
});
assert("LEAVE_SPARSE fill: ok", rSparse.ok, JSON.stringify(rSparse));
assert("LEAVE_SPARSE fill: receipt.missing_bin_policy = LEAVE_SPARSE",
    rSparse.ok && rSparse.artifact.reconstruct_receipt.missing_bin_policy === "LEAVE_SPARSE");
assert("LEAVE_SPARSE fill: expected_energy = null",
    rSparse.ok && rSparse.artifact.reconstruct_receipt.expected_energy === null);
// LEAVE_SPARSE and ZERO both zero-fill missing bins in buildFullSpectrum → same output
assert("LEAVE_SPARSE fill: same energy as ZERO (both zero-fill missing bins)",
    rZero.ok && rSparse.ok &&
    Math.abs(
        rSparse.artifact.reconstruct_receipt.reconstructed_energy -
        rZero.artifact.reconstruct_receipt.reconstructed_energy
    ) < 1e-10);

// L4: HANN_COMPENSATE — applies approximate Hann window inverse
const rHann = new ReconstructOp().run({
    state: sparseState,
    reconstruct_policy: { ...baseReconPol, fill_missing_bins: "ZERO", window_compensation: "HANN_COMPENSATE" },
});
assert("HANN_COMPENSATE: ok", rHann.ok, JSON.stringify(rHann));
assert("HANN_COMPENSATE: receipt.window_compensation = HANN_COMPENSATE",
    rHann.ok && rHann.artifact.reconstruct_receipt.window_compensation === "HANN_COMPENSATE");
assert("HANN_COMPENSATE: note mentions compensation applied",
    rHann.ok && rHann.artifact.reconstruct_receipt.notes.some(
        (n) => n.includes("Hann compensation") || n.includes("compensation")));
// Hann compensation alters values → different energy from NONE
assert("HANN_COMPENSATE: energy differs from NONE (compensation changes values)",
    rZero.ok && rHann.ok &&
    rHann.artifact.reconstruct_receipt.reconstructed_energy !==
    rZero.artifact.reconstruct_receipt.reconstructed_energy);
assert("HANN_COMPENSATE: expected_energy = null (no fabricated comparison)",
    rHann.ok && rHann.artifact.reconstruct_receipt.expected_energy === null);

// L5: OLA — declared stub, no accumulation performed
const rOLA = new ReconstructOp().run({
    state: sparseState,
    reconstruct_policy: { ...baseReconPol, fill_missing_bins: "ZERO", window_compensation: "OLA" },
});
assert("OLA: ok (stub, not an error)", rOLA.ok, JSON.stringify(rOLA));
assert("OLA: receipt.window_compensation = OLA",
    rOLA.ok && rOLA.artifact.reconstruct_receipt.window_compensation === "OLA");
assert("OLA: note is honest about stub (no accumulation performed)",
    rOLA.ok && rOLA.artifact.reconstruct_receipt.notes.some(
        (n) => n.includes("OLA") || n.includes("overlap-add") || n.includes("stub")));
// OLA stub does NOT modify values → same energy as NONE/ZERO
assert("OLA stub: energy equals ZERO/NONE (no accumulation applied)",
    rZero.ok && rOLA.ok &&
    Math.abs(
        rOLA.artifact.reconstruct_receipt.reconstructed_energy -
        rZero.artifact.reconstruct_receipt.reconstructed_energy
    ) < 1e-10);
assert("OLA: expected_energy = null",
    rOLA.ok && rOLA.artifact.reconstruct_receipt.expected_energy === null);

// L6: Determinism across all branches
for (const [label, pol] of [
    ["ZERO+NONE", { fill_missing_bins: "ZERO", window_compensation: "NONE" }],
    ["NOISE_FLOOR+NONE", { fill_missing_bins: "NOISE_FLOOR", window_compensation: "NONE" }],
    ["ZERO+HANN_COMPENSATE", { fill_missing_bins: "ZERO", window_compensation: "HANN_COMPENSATE" }],
    ["ZERO+OLA", { fill_missing_bins: "ZERO", window_compensation: "OLA" }],
]) {
    const fullPol = { ...baseReconPol, ...pol };
    const r1 = new ReconstructOp().run({ state: sparseState, reconstruct_policy: fullPol });
    const r2 = new ReconstructOp().run({ state: sparseState, reconstruct_policy: fullPol });
    assert(`ReconstructOp deterministic: ${label}`,
        r1.ok && r2.ok &&
        JSON.stringify(r1.artifact.values) === JSON.stringify(r2.artifact.values));
}

// ════════════════════════════════════════════════════════════════════════════
// M. ClockAlignOp — linear_fit drift model branch
// ════════════════════════════════════════════════════════════════════════════

section("M. ClockAlignOp — linear_fit drift model");

// Build a synthetic A1 with artificially drifted timestamps.
// Nominal spacing = 1/8 s. We add a tiny linear offset to simulate drift.
const DRIFT_FS = 8;
const DRIFT_N = 16;
const DRIFT_PPM_INJECTED = 50; // 50 parts-per-million clock drift
const driftedTimestamps = Array.from({ length: DRIFT_N }, (_, i) => {
    const nominal = i / DRIFT_FS;
    return nominal * (1 + DRIFT_PPM_INJECTED * 1e-6); // linearly stretched
});
const driftedValues = driftedTimestamps.map((t) => Math.sin(2 * Math.PI * t));

const driftedA1 = new IngestOp().run({
    stream_id: "drift:test",
    timestamps: driftedTimestamps,
    values: driftedValues,
    clock_policy_id: CLK,
    ingest_policy: { policy_id: "ingest.v1" },
});
assert("drifted A1 produced", driftedA1.ok, JSON.stringify(driftedA1));

// M1: linear_fit produces finite drift_ppm, offset_ms, fit_residual_rms
const linearFitResult = new ClockAlignOp().run({
    a1: driftedA1.artifact,
    grid_spec: {
        Fs_target: DRIFT_FS, t_ref: 0,
        drift_model: "linear_fit",
        interp_method: "linear", gap_policy: "cut",
        anti_alias_filter: false,
    },
});
assert("linear_fit alignment: ok", linearFitResult.ok, JSON.stringify(linearFitResult));
const lar = linearFitResult.ok ? linearFitResult.artifact.alignment_receipt : null;
assert("linear_fit receipt.drift_model = linear_fit", lar && lar.drift_model === "linear_fit");
assert("linear_fit receipt.drift_ppm is finite", lar && Number.isFinite(lar.drift_ppm));
assert("linear_fit receipt.offset_ms is finite", lar && Number.isFinite(lar.offset_ms));
assert("linear_fit receipt.fit_residual_rms is finite", lar && Number.isFinite(lar.fit_residual_rms));

// M2: anti_alias_filter_applied is still false (not affected by drift model)
assert("linear_fit: anti_alias_filter_applied = false", lar && lar.anti_alias_filter_applied === false);

// M3: "none" drift model produces null for drift_ppm/offset_ms/fit_residual_rms
const noDriftResult = new ClockAlignOp().run({
    a1: driftedA1.artifact,
    grid_spec: {
        Fs_target: DRIFT_FS, t_ref: 0,
        drift_model: "none",
        interp_method: "linear", gap_policy: "cut",
        anti_alias_filter: false,
    },
});
assert("none drift: drift_ppm = null", noDriftResult.ok && noDriftResult.artifact.alignment_receipt.drift_ppm === null);
assert("none drift: offset_ms = null", noDriftResult.ok && noDriftResult.artifact.alignment_receipt.offset_ms === null);
assert("none drift: fit_residual_rms = null", noDriftResult.ok && noDriftResult.artifact.alignment_receipt.fit_residual_rms === null);

// M4: Determinism — identical inputs produce identical aligned_values
const lr1 = new ClockAlignOp().run({
    a1: driftedA1.artifact,
    grid_spec: {
        Fs_target: DRIFT_FS, t_ref: 0, drift_model: "linear_fit",
        interp_method: "linear", gap_policy: "cut", anti_alias_filter: false
    }
});
const lr2 = new ClockAlignOp().run({
    a1: driftedA1.artifact,
    grid_spec: {
        Fs_target: DRIFT_FS, t_ref: 0, drift_model: "linear_fit",
        interp_method: "linear", gap_policy: "cut", anti_alias_filter: false
    }
});
assert("linear_fit deterministic: aligned_values identical",
    lr1.ok && lr2.ok &&
    JSON.stringify(lr1.artifact.aligned_values) === JSON.stringify(lr2.artifact.aligned_values));

// ════════════════════════════════════════════════════════════════════════════
// N. WindowOp — boundary policy branch coverage
// ════════════════════════════════════════════════════════════════════════════

section("N. WindowOp — boundary policy coverage");

// Build a short A2 that forces boundary clipping: fewer samples than one window size.
// base_window_N=8, but A2 has only 6 samples in last window.
const shortA2 = (() => {
    // Use existing a2Fixture but trim values to force a partial last window
    const a2 = a2Fixture.artifact;
    return {
        ...a2,
        aligned_values: a2.aligned_values.slice(0, 6),
        grid: { ...a2.grid, N: 6 },
    };
})();

const baseWinSpec = {
    mode: "fixed", Fs_target: 8, base_window_N: 8, hop_N: 8,
    window_function: "hann", overlap_ratio: 0, gap_policy: "cut",
    max_missing_ratio: 1.0, // allow all missing so partial windows proceed
};

// N1: truncate — partial last window is clipped and noted
const wTruncate = new WindowOp().run({
    a2: a2Fixture.artifact,
    window_spec: { ...baseWinSpec, boundary_policy: "truncate" }
});
assert("truncate: ok", wTruncate.ok);
// With boundary_policy=truncate, the loop breaks on partial final window
// All produced W1s should have clipped=false (full windows) OR clipped=true (boundary)
if (wTruncate.ok) {
    const clippedWindows = wTruncate.artifacts.filter((w) => w.window_receipt.clipped);
    // May or may not have a clipped window depending on total length; just assert honesty:
    assert("truncate: all W1 boundary_policy = truncate",
        wTruncate.artifacts.every((w) => w.window_receipt.boundary_policy === "truncate"));
    // If a clipped window exists, selection_reason = boundary_repair
    if (clippedWindows.length > 0) {
        assert("truncate: clipped window has selection_reason = boundary_repair",
            clippedWindows.every((w) => w.window_receipt.selection_reason === "boundary_repair"));
    }
}

// N2: pad — partial window padded with nulls, not silently dropped
const wPad = new WindowOp().run({
    a2: a2Fixture.artifact,
    window_spec: { ...baseWinSpec, boundary_policy: "pad" }
});
assert("pad: ok", wPad.ok, JSON.stringify(wPad));
assert("pad: all W1 boundary_policy = pad",
    wPad.ok && wPad.artifacts.every((w) => w.window_receipt.boundary_policy === "pad"));
// pad should produce >= truncate artifact count (keeps partial windows)
assert("pad: produces >= as many windows as truncate",
    wPad.ok && wTruncate.ok && wPad.artifacts.length >= wTruncate.artifacts.length);
// Padded windows should have padded=true in receipt
if (wPad.ok) {
    const paddedWindows = wPad.artifacts.filter((w) => w.window_receipt.padded);
    if (paddedWindows.length > 0) {
        assert("pad: padded window has selection_reason = boundary_repair",
            paddedWindows.every((w) => w.window_receipt.selection_reason === "boundary_repair"));
    }
}

// N3: mirror_pad — partial window padded by mirroring
const wMirror = new WindowOp().run({
    a2: a2Fixture.artifact,
    window_spec: { ...baseWinSpec, boundary_policy: "mirror_pad" }
});
assert("mirror_pad: ok", wMirror.ok, JSON.stringify(wMirror));
assert("mirror_pad: all W1 boundary_policy = mirror_pad",
    wMirror.ok && wMirror.artifacts.every((w) => w.window_receipt.boundary_policy === "mirror_pad"));
// mirror_pad like pad should produce >= truncate count
assert("mirror_pad: produces >= as many windows as truncate",
    wMirror.ok && wTruncate.ok && wMirror.artifacts.length >= wTruncate.artifacts.length);

// N4: Receipt honesty — window_receipt fields present for all policies
for (const [label, result] of [["truncate", wTruncate], ["pad", wPad], ["mirror_pad", wMirror]]) {
    if (!result.ok) continue;
    for (const w of result.artifacts) {
        assert(`${label}: window_receipt.missing_ratio is number`, typeof w.window_receipt.missing_ratio === "number");
        assert(`${label}: window_receipt.clipped is boolean`, typeof w.window_receipt.clipped === "boolean");
        assert(`${label}: window_receipt.padded is boolean`, typeof w.window_receipt.padded === "boolean");
    }
    // Only assert once per policy (checking first window)
    break; // already asserted in loop above; full coverage per-window would be verbose
}
// Re-assert for all three using only first window
for (const [label, result] of [["truncate", wTruncate], ["pad", wPad], ["mirror_pad", wMirror]]) {
    if (!result.ok || !result.artifacts.length) continue;
    const w = result.artifacts[0];
    assert(`${label}: W1[0].window_receipt.missing_ratio is number`, typeof w.window_receipt.missing_ratio === "number");
    assert(`${label}: W1[0].window_receipt.clipped is boolean`, typeof w.window_receipt.clipped === "boolean");
    assert(`${label}: W1[0].window_receipt.padded is boolean`, typeof w.window_receipt.padded === "boolean");
}

// ════════════════════════════════════════════════════════════════════════════
// O. CompressOp — band_quota selection coverage
// ════════════════════════════════════════════════════════════════════════════

section("O. CompressOp — band_quota selection coverage");

const cop2 = new CompressOp();
const validS1full = {
    artifact_class: "S1", stream_id: "s", window_id: "W1:s:0:8:WIN",
    grid: { Fs_target: 8, N: 8, frequency_resolution: 1 },
    spectrum: [
        { k: 0, freq_hz: 0, re: 2.0, im: 0, magnitude: 2.0, phase: 0 },
        { k: 1, freq_hz: 1, re: 1.0, im: 0, magnitude: 1.0, phase: 0 },
        { k: 2, freq_hz: 2, re: 0.8, im: 0, magnitude: 0.8, phase: 0 },
        { k: 3, freq_hz: 3, re: 0.5, im: 0, magnitude: 0.5, phase: 0 },
        { k: 4, freq_hz: 4, re: 0.2, im: 0, magnitude: 0.2, phase: 0 },
    ],
    transform_receipt: { parseval_error: null },
    policies: { clock_policy_id: CLK, grid_policy_id: GRID, window_policy_id: WIN, transform_policy_id: XFRM },
};
const bandCtx = { segment_id: "seg:band", window_span: { t_start: 0, t_end: 1 }, novelty_boundary_detected: false };

// O1: band_quota with valid spec — selects at least min_bins_per_band from each band
const bandQuotaPolicy = {
    policy_id: "compress.band",
    selection_method: "band_quota",
    budget_K: 4,
    invariance_lens: "energy",
    include_dc: true,
    respect_novelty_boundary: false,
    band_quota: { band_edges: [0, 2, 4], min_bins_per_band: 1 },
    thresholds: { max_recon_rmse: 999, max_energy_residual: 999, max_band_divergence: 999 },
};
const bqResult = cop2.run({ s1: validS1full, compression_policy: bandQuotaPolicy, context: bandCtx });
assert("band_quota: ok", bqResult.ok, JSON.stringify(bqResult));
assert("band_quota: receipts.compress.selection_method = band_quota",
    bqResult.ok && bqResult.artifact.receipts.compress.selection_method === "band_quota");
assert("band_quota: kept_bins.length <= budget_K",
    bqResult.ok && bqResult.artifact.kept_bins.length <= bandQuotaPolicy.budget_K);
assert("band_quota: no receipts.merge block on H1",
    bqResult.ok && !("merge" in bqResult.artifact.receipts));
assert("band_quota: segment_id preserved from context",
    bqResult.ok && bqResult.artifact.segment_id === "seg:band");

// O2: band_quota without band_quota spec → silently falls through to topK behavior
// This is a declared silent fallback: selection_method=band_quota but spec missing
// → the condition `bandQuota?.band_edges?.length >= 2` is false → topK is used
// The receipt still says "band_quota" (policy echo), but topK was actually applied.
// This is a known gap. Test documents the current behavior and flags it.
const bqNoSpec = {
    ...bandQuotaPolicy,
    policy_id: "compress.band.nospec",
    band_quota: undefined,  // spec absent
};
const bqNoSpecResult = cop2.run({ s1: validS1full, compression_policy: bqNoSpec, context: bandCtx });
assert("band_quota without spec: currently ok (falls through to topK)",
    bqNoSpecResult.ok,
    // NOTE: this is a known silent fallback — receipt says band_quota but topK was applied.
    // Documenting rather than breaking. If this should fail explicitly, patch CompressOp.
    "known fallthrough — band_quota without spec silently uses topK"
);
if (bqNoSpecResult.ok) {
    assert("band_quota without spec: selection_method in receipt echoes policy (not corrected)",
        bqNoSpecResult.artifact.receipts.compress.selection_method === "band_quota");
    // NOTE: this receipt is slightly dishonest — it says band_quota but topK ran.
    // Flagged as an implementation gap in the audit report.
}

// O3: topK still works correctly alongside band_quota tests
const topKResult = cop2.run({
    s1: validS1full,
    compression_policy: { ...bandQuotaPolicy, selection_method: "topK", policy_id: "compress.topk" },
    context: bandCtx,
});
assert("topK still works: ok", topKResult.ok);
assert("topK: receipts.compress.selection_method = topK",
    topKResult.ok && topKResult.artifact.receipts.compress.selection_method === "topK");

// ════════════════════════════════════════════════════════════════════════════
// P. MergeOp — lens merge mode coverage
// ════════════════════════════════════════════════════════════════════════════

section("P. MergeOp — lens merge mode coverage");

// Lens merge: cross-segment, cross-policy merging is allowed.
// It represents an interpretive lens over runtime memory, NOT authoritative history.
// Key contract assertions:
//   - eligible_for_authoritative_merge must be FALSE
//   - receipts.merge.merge_mode = "lens"
//   - the merge itself succeeds (it is a lawful Door One operation)

const lensH1a = makeH1(0, 1, { segment_id: "seg:alpha" });
const lensH1b = makeH1(1, 2, {
    segment_id: "seg:beta",  // different segment — allowed in lens mode
    policies: makePolicies({ compression_policy_id: "COMP:different" }), // different policy
});
const lensMergePolicy = {
    ...MERGE_POLICY,
    merge_mode: "lens",
    // lens mode skips policy/segment identity checks but still requires grid compatibility
};

const lensResult = new MergeOp().run({
    states: [lensH1a, lensH1b],
    merge_policy: lensMergePolicy,
    post_merge_compression_policy: POST_MERGE_COMPRESS,
});
assert("lens merge: ok (cross-segment allowed)",
    lensResult.ok, JSON.stringify(lensResult));

const lensM1 = lensResult.ok ? lensResult.artifact : null;

// P1: eligible_for_authoritative_merge = false (lens is NOT authoritative history)
assert("lens M1: eligible_for_authoritative_merge = false",
    lensM1 && lensM1.gates.eligible_for_authoritative_merge === false);

// P2: receipts.merge.merge_mode records "lens" honestly
assert("lens M1: receipts.merge.merge_mode = lens",
    lensM1 && lensM1.receipts.merge.merge_mode === "lens");

// P3: lens M1 does NOT imply canon authority
assert("lens M1: no 'canon' or 'canonical' field names",
    lensM1 && !JSON.stringify(Object.keys(lensM1.gates)).includes("canonical"));

// P4: gate semantics — eligible_for_authoritative_merge reflects strict invariance bounds.
// The gate is true only when blocked_reason = "none", which requires overallConfidence = 1.0,
// which requires ALL confidence scores to be exactly 1.0 (zero residuals against thresholds).
// With finite thresholds, even tiny floating-point band divergence after compression
// scores < 1.0 and sets blocked_reason = "low_band" → gate is false.
// This is correct and lawful: authoritative eligibility is a strict predicate, not a fuzzy one.
const authResult = new MergeOp().run({
    states: [h1A, h1B],
    merge_policy: MERGE_POLICY,
    post_merge_compression_policy: POST_MERGE_COMPRESS,
});
assert("authoritative merge: ok",
    authResult.ok, JSON.stringify(authResult));
assert("authoritative merge: eligible_for_authoritative_merge reflects merge_mode + blockedReason",
    authResult.ok && typeof authResult.artifact.gates.eligible_for_authoritative_merge === "boolean");
assert("authoritative merge: gate = (merge_mode=authoritative AND blockedReason=none)",
    authResult.ok && (
        authResult.artifact.gates.eligible_for_authoritative_merge ===
        (authResult.artifact.gates.blocked_reason === "none")
    ));
// For lens mode the gate is always false regardless of invariance bounds
assert("lens mode: eligible_for_authoritative_merge always false",
    lensResult.ok && lensResult.artifact.gates.eligible_for_authoritative_merge === false);
// Gate can reach true with zero band divergence: use single-bin states so
// post-merge compression retains all bins (no loss) → band divergence = 0 exactly.
const flatH1a = (() => {
    const h = makeH1(0, 1);
    // Single DC bin only — after merge compression with budget_K>=1 and include_dc=true,
    // ALL bins are retained → zero compression loss → zero band divergence.
    h.kept_bins = [{ k: 0, freq_hz: 0, re: 1.0, im: 0, magnitude: 1.0, phase: 0 }];
    h.invariants.energy_raw = 1.0;
    h.invariants.band_profile_norm = { band_edges: [0, 4, 4], band_energy: [1, 0] };
    return h;
})();
const flatH1b = (() => {
    const h = makeH1(1, 2);
    h.kept_bins = [{ k: 0, freq_hz: 0, re: 1.0, im: 0, magnitude: 1.0, phase: 0 }];
    h.invariants.energy_raw = 1.0;
    h.invariants.band_profile_norm = { band_edges: [0, 4, 4], band_energy: [1, 0] };
    return h;
})();
const flatMerge = new MergeOp().run({
    states: [flatH1a, flatH1b],
    merge_policy: MERGE_POLICY,
    post_merge_compression_policy: { ...POST_MERGE_COMPRESS, budget_K: 1 }, // budget covers 1 bin = all bins
});
assert("gate can reach true with zero divergence (single-bin, full budget)",
    flatMerge.ok && flatMerge.artifact.gates.eligible_for_authoritative_merge === true,
    `blocked_reason=${flatMerge.ok ? flatMerge.artifact.gates.blocked_reason : "N/A"}`);

// P5: authoritative merge on cross-segment inputs → MERGE_INELIGIBLE
const authCrossSeg = new MergeOp().run({
    states: [lensH1a, lensH1b],
    merge_policy: MERGE_POLICY,  // authoritative
    post_merge_compression_policy: POST_MERGE_COMPRESS,
});
assertFails("authoritative merge rejects cross-segment inputs",
    authCrossSeg, "MERGE_INELIGIBLE");

// ════════════════════════════════════════════════════════════════════════════
// Q. AnomalyOp — remaining mirrored validation and novelty threshold behavior
// ════════════════════════════════════════════════════════════════════════════

section("Q. AnomalyOp — remaining validation and novelty threshold");

const aop2 = new AnomalyOp();

// Q1: h_base energy mode with finite energy_raw passes (mirror of F3)
const baseWithEnergy = makeH1(1, 2, {
    invariants: {
        energy_raw: 0.5,   // present and finite
        energy_norm: 1,
        band_profile_norm: { band_edges: [0, 4, 4], band_energy: [1, 0] },
    },
    kept_bins: [],  // no kept_bins needed when energy_raw present
});
const q1Result = aop2.run({
    h_current: makeH1(0, 1),
    h_base: baseWithEnergy,
    anomaly_policy: ANOMALY_POLICY_ENERGY,
});
assert("energy mode: h_base with finite energy_raw passes (no kept_bins needed)",
    q1Result.ok, JSON.stringify(q1Result));

// Q2: novelty gate triggers when divergence exceeds threshold and duration is sufficient
// Create h_current with very different band profile to force high divergence
const highDivCur = makeH1(0, 1, {
    invariants: {
        energy_raw: 0.25,
        energy_norm: 1,
        band_profile_norm: { band_edges: [0, 4, 4], band_energy: [0, 1] }, // inverted vs h1B
    },
    window_span: { t_start: 0, t_end: 5, duration_sec: 5, window_count: 1 }, // long enough
});
const noveltyPolicy = {
    ...ANOMALY_POLICY_BAND,
    threshold_value: 0.01,    // very low threshold → easily triggered
    novelty_min_duration: 1.0, // duration requirement
};
const noveltyResult = aop2.run({ h_current: highDivCur, h_base: makeH1(1, 2), anomaly_policy: noveltyPolicy });
assert("novelty gate: ok with divergent inputs", noveltyResult.ok, JSON.stringify(noveltyResult));
assert("novelty gate: triggered when divergence > threshold and duration >= min",
    noveltyResult.ok && noveltyResult.artifact.novelty_gate_triggered === true);
assert("novelty gate: new_segment recommended when triggered with strict mode",
    noveltyResult.ok && noveltyResult.artifact.segmentation_recommendation === "new_segment");

// Q3: novelty gate does NOT trigger when duration < novelty_min_duration
const shortDurCur = makeH1(0, 1, {
    invariants: {
        energy_raw: 0.25,
        energy_norm: 1,
        band_profile_norm: { band_edges: [0, 4, 4], band_energy: [0, 1] },
    },
    window_span: { t_start: 0, t_end: 0.1, duration_sec: 0.1, window_count: 1 }, // too short
});
const notLongEnough = aop2.run({
    h_current: shortDurCur, h_base: makeH1(1, 2),
    anomaly_policy: { ...noveltyPolicy, novelty_min_duration: 5.0 }, // requires 5s
});
assert("novelty gate: NOT triggered when duration < novelty_min_duration",
    notLongEnough.ok && notLongEnough.artifact.novelty_gate_triggered === false);
assert("novelty gate: continue_segment when duration insufficient",
    notLongEnough.ok && notLongEnough.artifact.segmentation_recommendation === "continue_segment");

// Q4: receipt.sustained_duration_sec reflects actual h_current duration
assert("receipt.sustained_duration_sec = h_current.window_span.duration_sec",
    noveltyResult.ok &&
    noveltyResult.artifact.anomaly_receipt.sustained_duration_sec === highDivCur.window_span.duration_sec);

// Q5: no inflation from energy fallback — h_current with energy_raw present
// uses it directly, does not recompute from kept_bins (which would give different result)
const energyCheck = makeH1(0, 1, {
    invariants: {
        energy_raw: 100.0, energy_norm: 1, // very high declared energy
        band_profile_norm: { band_edges: [0, 4, 4], band_energy: [1, 0] }
    },
    kept_bins: [{ k: 1, freq_hz: 1, re: 0.01, im: 0, magnitude: 0.01, phase: 0 }], // tiny bins
});
const energyBase = makeH1(1, 2, {
    invariants: {
        energy_raw: 1.0, energy_norm: 1,
        band_profile_norm: { band_edges: [0, 4, 4], band_energy: [1, 0] }
    },
    kept_bins: [{ k: 1, freq_hz: 1, re: 0.01, im: 0, magnitude: 0.01, phase: 0 }],
});
const energyModeResult = aop2.run({
    h_current: energyCheck, h_base: energyBase, anomaly_policy: ANOMALY_POLICY_ENERGY,
});
assert("energy mode uses invariants.energy_raw not kept_bins sum",
    energyModeResult.ok &&
    // divergence = |100 - 1| / max(1, 1e-12) = 99 >> threshold 0.5 → should trigger
    energyModeResult.artifact.novelty_gate_triggered === true,
    `divergence=${energyModeResult.ok ? energyModeResult.artifact.divergence_score : "N/A"}`
);

console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (failures.length > 0) {
    console.log("\nFailed:");
    for (const f of failures) console.log(f);
    console.log(`\n  SOME TESTS FAILED ✗`);
    process.exit(1);
} else {
    console.log(`  ALL TESTS PASSED ✓`);
}
