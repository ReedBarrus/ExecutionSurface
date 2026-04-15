// tests/test_rms_envelope_adapter.js
//
// Contract tests for RmsEnvelopeAdapter
//
// Covers:
//   A. Derived trace contract normalization
//   B. Provenance preservation of parent source identity
//   C. No bypass of lawful ingest boundary
//   D. Envelope trace runner smoke test (executes and emits receipt-style rows)
//
// Run:
//   node tests/test_rms_envelope_adapter.js

import { RmsEnvelopeAdapter } from "../operators/sampler/RmsEnvelopeAdapter.js";
import { IngestOp }           from "../operators/ingest/IngestOp.js";

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
function section(name) { console.log(`\n── ${name} ──`); }

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FS_RAW = 256;
const RMS_W  = 16;            // → Fs_envelope = 16 Hz
const N      = FS_RAW * 4;    // 4 seconds

function makeSineValues(freq_hz, amplitude, n, fs) {
    return Array.from({ length: n }, (_, i) => amplitude * Math.sin(2 * Math.PI * freq_hz * i / fs));
}
function makeTimestamps(n, fs) {
    return Array.from({ length: n }, (_, i) => i / fs);
}

const PARENT_SPEC_BASE = { source_id: "probe.baseline_amplitude", label: "baseline_amplitude" };
const PARENT_SPEC_SHIFT = { source_id: "probe.amplitude_shift", label: "amplitude_shift" };

const RAW_BASE_VALUES  = makeSineValues(20, 1.0, N, FS_RAW);
const RAW_SHIFT_VALUES = makeSineValues(20, 2.5, N, FS_RAW);
const TIMESTAMPS       = makeTimestamps(N, FS_RAW);

const adapter = new RmsEnvelopeAdapter({ rms_window_N: RMS_W, Fs_raw: FS_RAW });

// ════════════════════════════════════════════════════════════════════════════
// A. Derived trace contract normalization
// ════════════════════════════════════════════════════════════════════════════

section("A. Derived trace contract normalization");

const baseResult = adapter.derive({
    values: RAW_BASE_VALUES, timestamps: TIMESTAMPS, parentSpec: PARENT_SPEC_BASE
});

assert("A1: derive returns ok=true",          baseResult.ok, JSON.stringify(baseResult.error));
assert("A2: ingest_input is object",          typeof baseResult.ingest_input === "object");

const ii = baseResult.ingest_input;

// Required ingest contract fields
assert("A3: timestamps array present",        Array.isArray(ii.timestamps) && ii.timestamps.length > 0);
assert("A4: values array present",            Array.isArray(ii.values) && ii.values.length > 0);
assert("A5: stream_id is string",             typeof ii.stream_id === "string" && ii.stream_id.length > 0);
assert("A6: source_id is string",             typeof ii.source_id === "string" && ii.source_id.length > 0);
assert("A7: channel present",                 typeof ii.channel === "string");
assert("A8: modality present",                typeof ii.modality === "string");
assert("A9: clock_policy_id present",         typeof ii.clock_policy_id === "string");
assert("A10: meta.Fs_nominal is number",      typeof ii.meta?.Fs_nominal === "number" && ii.meta.Fs_nominal > 0);
assert("A11: meta.units present",             typeof ii.meta?.units === "string");
assert("A12: ingest_policy present",          typeof ii.ingest_policy === "object");
assert("A13: ingest_policy.policy_id present",typeof ii.ingest_policy?.policy_id === "string");

// Derived-trace-specific metadata
assert("A14: meta.source_mode = derived_trace",
    ii.meta?.source_mode === "derived_trace");
assert("A15: meta.derived_trace_type = rms_envelope",
    ii.meta?.derived_trace_type === "rms_envelope");
assert("A16: modality = rms_amplitude",
    ii.modality === "rms_amplitude");

// Envelope sample count and rate
const expectedFrames = Math.floor(N / RMS_W);
assert("A17: correct envelope frame count",
    ii.values.length === expectedFrames, `got ${ii.values.length}, expected ${expectedFrames}`);
assert("A18: correct Fs_nominal = Fs_raw / rms_window_N",
    ii.meta.Fs_nominal === FS_RAW / RMS_W);
assert("A19: envelope_frames in meta",
    ii.meta.envelope_frames === expectedFrames);
assert("A20: rms_window_N in meta",
    ii.meta.rms_window_N === RMS_W);

// All envelope values are non-negative (RMS is always ≥ 0)
assert("A21: all envelope values are non-negative",
    ii.values.every(v => v >= 0));
// Envelope values are finite
assert("A22: all envelope values are finite",
    ii.values.every(v => Number.isFinite(v)));
// Timestamps have same count as values
assert("A23: timestamps.length === values.length",
    ii.timestamps.length === ii.values.length);
// Timestamps are monotonically increasing
assert("A24: envelope timestamps are monotonically increasing",
    ii.timestamps.every((t, i) => i === 0 || t > ii.timestamps[i - 1]));

// ════════════════════════════════════════════════════════════════════════════
// B. Provenance preservation of parent source identity
// ════════════════════════════════════════════════════════════════════════════

section("B. Provenance preservation of parent source identity");

assert("B1: meta.parent_source_id = parent spec source_id",
    ii.meta?.parent_source_id === PARENT_SPEC_BASE.source_id);
assert("B2: meta.parent_stream_id = null when not provided",
    ii.meta?.parent_stream_id === null);

// With explicit parent_stream_id
const withParentStream = adapter.derive({
    values: RAW_BASE_VALUES, timestamps: TIMESTAMPS,
    parentSpec: PARENT_SPEC_BASE,
    parent_stream_id: "STR:probe.baseline_amplitude:ch0:voltage:256",
});
assert("B3: parent_stream_id preserved when supplied",
    withParentStream.ok &&
    withParentStream.ingest_input.meta.parent_stream_id ===
        "STR:probe.baseline_amplitude:ch0:voltage:256");

// stream_id distinguishes envelope from raw
assert("B4: stream_id contains 'rms_envelope'",
    ii.stream_id.includes("rms_envelope"));
assert("B5: source_id distinct from parent_source_id",
    ii.source_id !== ii.meta.parent_source_id);
assert("B6: stream_id contains parent_source_id for traceback",
    ii.stream_id.includes(PARENT_SPEC_BASE.source_id));

// Amplitude shift cohort: parent_source_id is different
const shiftResult = adapter.derive({
    values: RAW_SHIFT_VALUES, timestamps: TIMESTAMPS, parentSpec: PARENT_SPEC_SHIFT
});
assert("B7: amplitude_shift envelope parent_source_id is distinct from baseline",
    shiftResult.ok &&
    shiftResult.ingest_input.meta.parent_source_id === PARENT_SPEC_SHIFT.source_id &&
    shiftResult.ingest_input.meta.parent_source_id !== PARENT_SPEC_BASE.source_id);

// Amplitude shift envelope values should be larger (RMS scales with amplitude)
const baseRMS  = baseResult.ingest_input.values.reduce((a, b) => a + b, 0) / baseResult.ingest_input.values.length;
const shiftRMS = shiftResult.ingest_input.values.reduce((a, b) => a + b, 0) / shiftResult.ingest_input.values.length;
assert("B8: amplitude_shift envelope mean RMS > baseline mean RMS",
    shiftRMS > baseRMS, `shift=${shiftRMS.toFixed(4)}, base=${baseRMS.toFixed(4)}`);
assert("B9: RMS ratio approximates amplitude ratio (within 10%)",
    Math.abs(shiftRMS / baseRMS - 2.5) < 0.25,
    `ratio=${(shiftRMS / baseRMS).toFixed(3)}, expected ~2.5`);

// meta.Fs_raw preserves the parent sample rate
assert("B10: meta.Fs_raw = FS_RAW",
    ii.meta.Fs_raw === FS_RAW);

// ════════════════════════════════════════════════════════════════════════════
// C. No bypass of lawful ingest boundary
// ════════════════════════════════════════════════════════════════════════════

section("C. No bypass of lawful ingest boundary");

// The envelope ingest_input must pass through IngestOp successfully
const ingestOp  = new IngestOp();
const ingestRes = ingestOp.run(ii);
assert("C1: envelope ingest_input passes IngestOp",
    ingestRes.ok, JSON.stringify(ingestRes.error ?? ingestRes.reasons));
assert("C2: IngestOp result has artifact_class A1",
    ingestRes.artifact?.artifact_class === "A1");
assert("C3: IngestOp preserves stream_id from envelope input",
    ingestRes.artifact?.stream_id === ii.stream_id);

// Raw signal values are not modified
const rawCopy = [...RAW_BASE_VALUES];
adapter.derive({ values: RAW_BASE_VALUES, timestamps: TIMESTAMPS, parentSpec: PARENT_SPEC_BASE });
assert("C4: derive does not mutate raw values",
    RAW_BASE_VALUES.every((v, i) => v === rawCopy[i]));

// Error cases — adapter refuses invalid input
const emptyResult = adapter.derive({ values: [], timestamps: [], parentSpec: PARENT_SPEC_BASE });
assert("C5: empty values returns ok=false with INVALID_INPUT",
    !emptyResult.ok && emptyResult.error === "INVALID_INPUT");

const mismatchResult = adapter.derive({
    values: [1, 2, 3],
    timestamps: [0, 1],
    parentSpec: PARENT_SPEC_BASE,
});
assert("C6: length mismatch returns ok=false with LENGTH_MISMATCH",
    !mismatchResult.ok && mismatchResult.error === "LENGTH_MISMATCH");

// Signal shorter than one RMS window
const shortAdapter   = new RmsEnvelopeAdapter({ rms_window_N: 256, Fs_raw: 256 });
const shortResult    = shortAdapter.derive({
    values: [1, 2, 3],
    timestamps: [0, 0.004, 0.008],
    parentSpec: PARENT_SPEC_BASE,
});
assert("C7: signal shorter than rms_window_N returns SIGNAL_TOO_SHORT",
    !shortResult.ok && shortResult.error === "SIGNAL_TOO_SHORT");

// Constructor validates config
let constructorThrew = false;
try { new RmsEnvelopeAdapter({ rms_window_N: -1, Fs_raw: 256 }); }
catch (e) { constructorThrew = true; }
assert("C8: constructor rejects invalid rms_window_N",  constructorThrew);

let constructorThrew2 = false;
try { new RmsEnvelopeAdapter({ rms_window_N: 16, Fs_raw: 0 }); }
catch (e) { constructorThrew2 = true; }
assert("C9: constructor rejects Fs_raw <= 0", constructorThrew2);

// source_mode explicitly distinguishes from raw amplitude path
assert("C10: derived trace source_mode !== 'synthetic' (not confused with raw)",
    ii.meta.source_mode !== "synthetic" &&
    ii.meta.source_mode !== "sampler_flush_all" &&
    ii.meta.source_mode === "derived_trace");

// No canon / ontology fields in envelope ingest_input
const iiStr = JSON.stringify(ii);
assert("C11: no artifact_class C1 in envelope ingest_input", !iiStr.includes('"C1"'));
assert("C12: no canonical / promoted / truth in envelope ingest_input",
    !iiStr.includes('"canonical"') && !iiStr.includes('"promoted"') && !iiStr.includes('"truth"'));

// ════════════════════════════════════════════════════════════════════════════
// D. Envelope trace runner smoke test
// ════════════════════════════════════════════════════════════════════════════

section("D. Envelope trace runner smoke test");

// Simulate what the probe runner does:
// derive both envelope traces, run through IngestOp, confirm receipt-style row fields
import { IngestOp as IngestOp2 }   from "../operators/ingest/IngestOp.js";
import { ClockAlignOp }             from "../operators/clock/ClockAlignOp.js";
import { WindowOp }                 from "../operators/window/WindowOp.js";
import { TransformOp }              from "../operators/transform/TransformOp.js";
import { CompressOp }               from "../operators/compress/CompressOp.js";

const envelopeAdapter = new RmsEnvelopeAdapter({ rms_window_N: RMS_W, Fs_raw: FS_RAW });

function smokeRunEnvelope(rawValues, rawTimestamps, parentSpec) {
    const dr = envelopeAdapter.derive({ values: rawValues, timestamps: rawTimestamps, parentSpec });
    if (!dr.ok) return { ok: false, error: dr.error };

    const inp = dr.ingest_input;
    const ingestOp2 = new IngestOp2();
    const a1r = ingestOp2.run(inp);
    if (!a1r.ok) return { ok: false, error: `IngestOp: ${a1r.error}` };

    const Fs_env = dr.Fs_envelope;
    const alignOp = new ClockAlignOp();
    const a2r = alignOp.run({
        a1: a1r.artifact,
        grid_spec: {
            Fs_target: Fs_env, t_ref: inp.timestamps[0],
            drift_model: "none", non_monotonic_policy: "reject",
            interp_method: "linear", gap_policy: "interpolate_small",
            small_gap_multiplier: 3.0, max_gap_seconds: null, anti_alias_filter: false,
        },
    });
    if (!a2r.ok) return { ok: false, error: `ClockAlignOp: ${a2r.error}` };

    const winN = Math.min(8, Math.floor(dr.envelope_frames / 2));
    const windowOp2 = new WindowOp();
    const w1r = windowOp2.run({
        a2: a2r.artifact,
        window_spec: {
            mode: "fixed", Fs_target: Fs_env,
            base_window_N: winN, hop_N: Math.max(1, Math.floor(winN / 2)),
            window_function: "hann", overlap_ratio: 0.5, stationarity_policy: "tolerant",
            salience_policy: "off", gap_policy: "interpolate_small",
            max_missing_ratio: 0.25, boundary_policy: "truncate",
        },
    });
    if (!w1r.ok) return { ok: false, error: `WindowOp: ${w1r.error}` };

    const transformOp2 = new TransformOp();
    const compressOp2  = new CompressOp();
    const s1s = [], h1s = [];

    for (let wi = 0; wi < Math.min(w1r.artifacts.length, 4); wi++) {
        const w1 = w1r.artifacts[wi];
        const tr = transformOp2.run({ w1, transform_policy: {
            policy_id: "transform.env.smoke.v1",
            transform_type: "fft", normalization_mode: "forward_1_over_N",
            scaling_convention: "real_input_half_spectrum", numeric_policy: "tolerant",
        }});
        if (!tr.ok) continue;
        s1s.push(tr.artifact);

        const t_start = w1.grid?.t0 ?? (wi * (Math.max(1, Math.floor(winN / 2))) / Fs_env);
        const cr = compressOp2.run({
            s1: tr.artifact,
            compression_policy: {
                policy_id: "compress.env.smoke.v1", selection_method: "topK",
                budget_K: 4, maxK: 4, include_dc: false, invariance_lens: "energy",
                numeric_policy: "tolerant", respect_novelty_boundary: false,
                thresholds: { max_recon_rmse: 999, max_energy_residual: 999, max_band_divergence: 999 },
            },
            context: {
                segment_id: `seg:${parentSpec.source_id}:env:0`,
                window_span: { t_start, t_end: t_start + winN / Fs_env },
            },
        });
        if (cr.ok) h1s.push(cr.artifact);
    }

    return {
        ok: true,
        s1s, h1s,
        source_trace_identity:   inp.stream_id,
        parent_source_identity:  inp.meta.parent_source_id,
        trace_family:            "rms_envelope",
    };
}

const baseSmoke  = smokeRunEnvelope(RAW_BASE_VALUES,  TIMESTAMPS, PARENT_SPEC_BASE);
const shiftSmoke = smokeRunEnvelope(RAW_SHIFT_VALUES, TIMESTAMPS, PARENT_SPEC_SHIFT);

assert("D1: baseline envelope smoke run ok",   baseSmoke.ok,  JSON.stringify(baseSmoke.error));
assert("D2: amplitude_shift smoke run ok",     shiftSmoke.ok, JSON.stringify(shiftSmoke.error));
assert("D3: baseline smoke produced S1s",      (baseSmoke.s1s?.length ?? 0) > 0);
assert("D4: baseline smoke produced H1s",      (baseSmoke.h1s?.length ?? 0) > 0);
assert("D5: trace_family = rms_envelope",
    baseSmoke.trace_family === "rms_envelope");
assert("D6: source_trace_identity contains rms_envelope",
    baseSmoke.source_trace_identity?.includes("rms_envelope"));
assert("D7: parent_source_identity preserved",
    baseSmoke.parent_source_identity === PARENT_SPEC_BASE.source_id);

// Simulate receipt-style row output
function makeReceiptRow({ trace_family, pair, stage, metric, raw_value,
    temporal_stability = null, n_windows = null,
    source_trace_identity, parent_source_identity }) {
    return {
        trace_family,
        pair,
        stage,
        metric,
        raw_value:              typeof raw_value === "number" ? parseFloat(raw_value.toFixed(6)) : raw_value,
        threshold:              "see probe source",
        classification:         raw_value == null ? "unknown" : raw_value > 0.1 ? "separated" : "similar",
        temporal_stability,
        n_windows,
        source_trace_identity,
        parent_source_identity,
        interpretation:         "smoke test row",
        next_action:            "run full multitrace probe for detailed diagnostics",
    };
}

const smokeRow = makeReceiptRow({
    trace_family:           "rms_envelope",
    pair:                   "baseline_amplitude vs amplitude_shift",
    stage:                  "post_compress",
    metric:                 "band_profile_distance",
    raw_value:              0.123,
    n_windows:              baseSmoke.h1s?.length ?? 0,
    source_trace_identity:  baseSmoke.source_trace_identity,
    parent_source_identity: baseSmoke.parent_source_identity,
});

// Verify all required receipt-style fields are present
const requiredFields = ["trace_family","pair","stage","metric","raw_value","threshold",
    "classification","interpretation","next_action"];
assert("D8: receipt row has all required fields",
    requiredFields.every(f => f in smokeRow));
assert("D9: receipt row trace_family = rms_envelope",
    smokeRow.trace_family === "rms_envelope");
assert("D10: receipt row source_trace_identity is string",
    typeof smokeRow.source_trace_identity === "string");
assert("D11: receipt row parent_source_identity is string",
    typeof smokeRow.parent_source_identity === "string");

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════

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
