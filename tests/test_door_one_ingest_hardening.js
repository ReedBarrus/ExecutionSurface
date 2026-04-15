// tests/test_door_one_ingest_hardening.js
//
// Contract tests for bounded Door One ingest hardening.
//
// Scope:
//   - file-backed adapter normalization through the same lawful ingest seam
//   - device/socket-backed adapter normalization through the same lawful ingest seam
//   - explicit adapter failure posture
//   - required raw-ingest field preservation
//   - bounded repeated quasi-live ingest behavior at the executive seam
//   - no semantic elevation by adapter convenience
//
// Boundary contract:
//   - adapters remain pre-ingest only
//   - all source diversity collapses into one lawful ingest boundary
//   - executive lane remains the normalization/validation gate
//   - no canon / no truth / no ontology / no promotion
//
// References:
//   - README_DoorOneAdapterPolicy.md
//   - README_DoorOneRuntimeBoundary.md
//   - README_MasterConstitution.md
//   - README_WorkflowContract.md

import { DoorOneExecutiveLane } from "../runtime/DoorOneExecutiveLane.js";
import { makeTestSignal } from "../fixtures/test_signal.js";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal test harness
// ─────────────────────────────────────────────────────────────────────────────

let PASS = 0;
let FAIL = 0;

function section(title) {
    console.log(`\n── ${title} ──`);
}

function ok(condition, label) {
    if (condition) {
        PASS += 1;
        console.log(`  ✓ ${label}`);
    } else {
        FAIL += 1;
        console.log(`  ✗ ${label}`);
    }
}

function eq(actual, expected, label) {
    ok(
        Object.is(actual, expected),
        `${label}${Object.is(actual, expected) ? "" : ` (expected ${expected}, got ${actual})`}`
    );
}

function deepEq(a, b, label) {
    const sa = JSON.stringify(a);
    const sb = JSON.stringify(b);
    ok(sa === sb, `${label}${sa === sb ? "" : " (deep mismatch)"}`);
}

function includes(str, sub, label) {
    ok(String(str).includes(sub), label);
}

function notIncludes(str, sub, label) {
    ok(!String(str).includes(sub), label);
}

function finish() {
    console.log("\n══════════════════════════════════════════════════════");
    console.log(`  ${PASS} passed   ${FAIL} failed`);
    console.log(FAIL === 0 ? "  ALL TESTS PASSED ✓" : "  TESTS FAILED ✗");
    if (FAIL > 0) process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared lawful policies
// ─────────────────────────────────────────────────────────────────────────────

const BASE_POLICIES = {
    clock_policy_id: "clock.ingest.synthetic.v1",

    ingest_policy: {
        policy_id: "ingest.ingest.synthetic.v1",
        gap_threshold_multiplier: 3.0,
        allow_non_monotonic: false,
        allow_empty: false,
        non_monotonic_mode: "reject",
    },

    grid_spec: {
        Fs_target: 8,
        t_ref: 0,
        grid_policy: "strict",
        drift_model: "none",
        non_monotonic_policy: "reject",
        interp_method: "linear",
        gap_policy: "interpolate_small",
        small_gap_multiplier: 3.0,
        max_gap_seconds: null,
        anti_alias_filter: false,
    },

    window_spec: {
        mode: "fixed",
        Fs_target: 8,
        base_window_N: 8,
        hop_N: 4,
        window_function: "hann",
        overlap_ratio: 0.5,
        stationarity_policy: "tolerant",
        salience_policy: "off",
        gap_policy: "interpolate_small",
        max_missing_ratio: 0.25,
        boundary_policy: "pad",
    },

    transform_policy: {
        policy_id: "transform.ingest.synthetic.v1",
        transform_type: "fft",
        normalization_mode: "forward_1_over_N",
        scaling_convention: "real_input_half_spectrum",
        numeric_policy: "tolerant",
    },

    compression_policy: {
        policy_id: "compress.ingest.synthetic.v1",
        selection_method: "topK",
        budget_K: 8,
        maxK: 8,
        include_dc: true,
        invariance_lens: "identity",
        numeric_policy: "tolerant",
        respect_novelty_boundary: true,
        thresholds: {
            max_recon_rmse: 0.25,
            max_energy_residual: 0.25,
            max_band_divergence: 0.30,
        },
    },

    anomaly_policy: {
        policy_id: "anomaly.ingest.synthetic.v1",
        invariance_mode: "band_profile",
        divergence_metric: "band_l1",
        threshold_value: 0.15,
        frequency_tolerance_hz: 1.0,
        phase_sensitivity_mode: "strict",
        novelty_min_duration: 0,
        segmentation_mode: "strict",
        dominant_bin_threshold: 0.2,
        new_frequency_threshold: 0.15,
        vanished_frequency_threshold: 0.15,
        energy_shift_threshold: 0.15,
    },

    merge_policy: {
        policy_id: "merge.ingest.synthetic.v1",
        adjacency_rule: "time_touching",
        phase_alignment_mode: "clock_delta_rotation",
        weights_mode: "duration",
        novelty_gate: "strict",
        merge_mode: "authoritative",
        grid_tolerance: 0,
    },

    post_merge_compression_policy: {
        policy_id: "merge.compress.ingest.synthetic.v1",
        selection_method: "topK",
        budget_K: 8,
        maxK: 8,
        include_dc: true,
        invariance_lens: "identity",
        thresholds: {
            max_recon_rmse: 0.30,
            max_energy_residual: 0.30,
            max_band_divergence: 0.30,
        },
    },

    reconstruct_policy: {
        policy_id: "reconstruct.ingest.synthetic.v1",
        output_format: "values",
        fill_missing_bins: "ZERO",
        validate_invariants: true,
        window_compensation: "NONE",
        numeric_policy: "tolerant",
    },

    basin_policy: {
        policy_id: "basin.ingest.synthetic.v1",
        similarity_threshold: 0.35,
        min_member_count: 1,
        weight_mode: "duration",
        linkage: "single_link",
    },

    consensus_policy: {
        policy_id: "consensus.ingest.synthetic.v1",
        promotion_threshold: 0.8,
        max_energy_drift: 0.1,
        max_band_drift: 0.1,
        coherence_tests: ["energy_invariance", "band_profile_invariance"],
        settlement_mode: "single_node",
    },
};

const QUERY_SPEC = {
    query_id: "q.ingest.hardening",
    kind: "energy_trend",
    mode: "ENERGY",
    scope: { allow_cross_segment: true },
};

const QUERY_POLICY = {
    policy_id: "qp.ingest.hardening",
    scoring: "energy_delta",
    normalization: "none",
    topK: 5,
};

const EPOCH_CONTEXT = {
    epoch_id: "epoch.ingest.hardening.1",
    t_start: 0,
    t_end: 20,
    settlement_policy_id: "settlement.ingest.synthetic.v1",
    consensus_window: 10,
};

const CONSENSUS_POLICY = {
    policy_id: "consensus.ingest.hardening.v1",
};

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function makeLane(max_runs = 3) {
    return new DoorOneExecutiveLane({
        policies: clone(BASE_POLICIES),
        querySpec: clone(QUERY_SPEC),
        queryPolicy: clone(QUERY_POLICY),
        epochContext: clone(EPOCH_CONTEXT),
        consensusPolicy: clone(CONSENSUS_POLICY),
        max_runs,
        session_id: "door-one-ingest-hardening-session",
    });
}

function makeRawInput({
    durationSec = 4,
    fs = 8,
    seed = 7,
    noiseStd = 0.01,
    source_id = "ingest.probe",
    channel = "ch0",
    modality = "voltage",
    units = "arb",
    stream_id = null,
} = {}) {
    const { signal } = makeTestSignal({
        durationSec,
        fs,
        seed,
        noiseStd,
        source_id,
        channel,
        modality,
        units,
    });

    return {
        timestamps: signal.timestamps,
        values: signal.values,
        stream_id:
            stream_id ??
            signal.stream_id ??
            `STR:${source_id}:${channel}:${modality}:${units}:fixture`,
        source_id,
        channel,
        modality,
        meta: {
            ...(signal.meta ?? {}),
            source_id,
            channel,
            modality,
        },
        clock_policy_id: BASE_POLICIES.clock_policy_id,
    };
}

// Mock file-backed adapter output: explicit pre-ingest normalization to raw payload.
function makeFileAdapterRaw(overrides = {}) {
    return {
        ...makeRawInput({
            seed: 11,
            source_id: "file.csv.synthetic",
            channel: "file_ch0",
            modality: "voltage",
        }),
        meta: {
            adapter_kind: "file",
            file_format: "csv",
            import_units: "arb",
            nominal_fs: 8,
        },
        ...overrides,
    };
}

// Mock device/socket-backed adapter flush result: bounded flush surface with ingest_input.
function makeDeviceAdapterFlush({
    ok: flushOk = true,
    reasons = [],
    ingest_input = null,
} = {}) {
    return {
        ok: flushOk,
        reasons,
        ingest_input:
            ingest_input ??
            {
                ...makeRawInput({
                    seed: 17,
                    source_id: "device.socket.synthetic",
                    channel: "dev0",
                    modality: "voltage",
                }),
                meta: {
                    adapter_kind: "device",
                    device_transport: "socket",
                    nominal_fs: 8,
                },
            },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

section("A. File-backed and device-backed source convergence");

const laneA = makeLane();

const fileRaw = makeFileAdapterRaw();
const fileRes = laneA.ingest(fileRaw, { run_label: "file_adapter_run" });

eq(fileRes.ok, true, "A1: file-backed normalized raw input is accepted");
ok(
    fileRes.run_result?.artifacts?.a1?.artifact_class === "A1",
    "A2: file-backed input yields A1 artifact"
);
ok(
    Array.isArray(fileRes.run_result?.artifacts?.a1?.timestamps),
    "A3: file-backed A1 preserves raw timestamps surface"
);
ok(
    Array.isArray(fileRes.run_result?.artifacts?.a1?.values),
    "A4: file-backed A1 preserves raw values surface"
);

const deviceFlush = makeDeviceAdapterFlush();
const deviceRes = laneA.ingest(deviceFlush, { run_label: "device_adapter_run" });

eq(deviceRes.ok, true, "A5: device-backed lawful flush result is accepted");
ok(
    deviceRes.run_result?.artifacts?.a1?.artifact_class === "A1",
    "A6: device-backed flush yields A1 artifact"
);
ok(
    Array.isArray(deviceRes.run_result?.artifacts?.a1?.timestamps),
    "A7: device-backed A1 preserves raw timestamps surface"
);
ok(
    Array.isArray(deviceRes.run_result?.artifacts?.a1?.values),
    "A8: device-backed A1 preserves raw values surface"
);

eq(
    laneA.sessionSummary().run_count,
    2,
    "A9: mixed adapter classes still accumulate through one executive seam"
);

section("B. Explicit adapter failure posture");

const laneB = makeLane();

const failedFlush = makeDeviceAdapterFlush({
    ok: false,
    reasons: ["socket timeout", "buffer underrun"],
});

const failedFlushRes = laneB.ingest(failedFlush, { run_label: "failed_flush_run" });

eq(failedFlushRes.ok, false, "B1: non-ok flush result fails explicitly");
eq(failedFlushRes.error, "INVALID_INPUT", "B2: non-ok flush result error classified");
ok(
    Array.isArray(failedFlushRes.reasons) && failedFlushRes.reasons.length >= 1,
    "B3: non-ok flush result exposes bounded reasons"
);
eq(laneB.sessionSummary().run_count, 0, "B4: failed flush does not advance runtime state");

const missingIngestFlush = {
    ok: true,
    reasons: [],
    ingest_input: null,
};

const missingIngestRes = laneB.ingest(missingIngestFlush, { run_label: "missing_ingest_run" });

eq(missingIngestRes.ok, false, "B5: flush without ingest_input fails explicitly");
eq(missingIngestRes.error, "INVALID_INPUT", "B6: missing ingest_input classified as invalid");
eq(laneB.sessionSummary().run_count, 0, "B7: missing ingest_input does not advance runtime state");

section("C. Raw-ingest contract hardening targets");

const laneC = makeLane();

const emptyTimestamps = makeRawInput();
emptyTimestamps.timestamps = [];
const emptyTsRes = laneC.ingest(emptyTimestamps, { run_label: "empty_ts" });

eq(emptyTsRes.ok, false, "C1: empty timestamps rejected");
includes(
    JSON.stringify(emptyTsRes.reasons),
    "timestamps",
    "C2: empty timestamps failure mentions timestamps"
);

const mismatchedLengths = makeRawInput();
mismatchedLengths.values = mismatchedLengths.values.slice(1);
const mismatchRes = laneC.ingest(mismatchedLengths, { run_label: "mismatch" });

eq(mismatchRes.ok, false, "C3: mismatched timestamps/values rejected");
includes(
    JSON.stringify(mismatchRes.reasons),
    "same length",
    "C4: length mismatch failure mentions same length"
);

// The adapter policy requires these fields to be preserved at the ingest boundary.
// This section is the main hardening target and may expose the next implementation gap.
const missingSourceId = makeRawInput();
delete missingSourceId.source_id;
const missingSourceRes = laneC.ingest(missingSourceId, { run_label: "missing_source_id" });

eq(missingSourceRes.ok, false, "C5: missing source_id rejected");

const missingStreamId = makeRawInput();
delete missingStreamId.stream_id;
const missingStreamRes = laneC.ingest(missingStreamId, { run_label: "missing_stream_id" });

eq(missingStreamRes.ok, false, "C6: missing stream_id rejected");

const missingChannel = makeRawInput();
delete missingChannel.channel;
const missingChannelRes = laneC.ingest(missingChannel, { run_label: "missing_channel" });

eq(missingChannelRes.ok, false, "C7: missing channel rejected");

const missingModality = makeRawInput();
delete missingModality.modality;
const missingModalityRes = laneC.ingest(missingModality, { run_label: "missing_modality" });

eq(missingModalityRes.ok, false, "C8: missing modality rejected");

const missingClockPolicy = makeRawInput();
delete missingClockPolicy.clock_policy_id;
const missingClockRes = laneC.ingest(missingClockPolicy, { run_label: "missing_clock_policy" });

eq(missingClockRes.ok, false, "C9: missing clock_policy_id rejected");

section("D. No semantic elevation by adapter convenience");

const laneD = makeLane();

const semanticizedFileRaw = makeFileAdapterRaw({
    canonical: true,
    promoted: true,
    ontology: "declared_truth_surface",
    prediction: { status: "pretend" },
    meta: {
        adapter_kind: "file",
        semantic_overlay: "bad_ui_claim",
    },
});

const semanticizedRes = laneD.ingest(semanticizedFileRaw, { run_label: "semanticized_file_run" });

// This should still remain below canon, and the run output must not mint C1/truth/promotion.
eq(semanticizedRes.ok, true, "D1: extra adapter metadata does not create a new payload class");

const semanticizedStr = JSON.stringify(semanticizedRes);
notIncludes(semanticizedStr, '"artifact_class":"C1"', "D2: no C1 minted through adapter convenience");
notIncludes(semanticizedStr, '"canonical_state"', "D3: no canonical state emitted");
notIncludes(semanticizedStr, '"ontology":"declared_truth_surface"', "D4: ontology claim not propagated as authority");
notIncludes(semanticizedStr, '"promoted":true', "D5: promotion not emitted as runtime outcome");

section("E. Bounded repeated quasi-live ingest");

const laneE = makeLane(3);

const run1 = laneE.ingest(makeRawInput({ seed: 7, source_id: "qlive.1" }), { run_label: "qlive_1" });
const run2 = laneE.ingest(makeRawInput({ seed: 11, source_id: "qlive.2" }), { run_label: "qlive_2" });
const run3 = laneE.ingest(makeRawInput({ seed: 13, source_id: "qlive.3" }), { run_label: "qlive_3" });
const run4 = laneE.ingest(makeRawInput({ seed: 17, source_id: "qlive.4" }), { run_label: "qlive_4" });

eq(run1.ok, true, "E1: first quasi-live ingest ok");
eq(run2.ok, true, "E2: second quasi-live ingest ok");
eq(run3.ok, true, "E3: third quasi-live ingest ok");
eq(run4.ok, true, "E4: fourth quasi-live ingest ok");

const summaryE = laneE.sessionSummary();

eq(summaryE.run_count, 3, "E5: session remains bounded by max_runs");
eq(summaryE.cross_run_available, true, "E6: bounded repeated-run context remains available");
eq(
    laneE.latestRunResult()?.run_label,
    "qlive_4",
    "E7: latestRunResult tracks most recent ingest"
);
eq(
    laneE.latestWorkbench()?.scope?.stream_id,
    laneE.latestRunResult()?.artifacts?.a1?.stream_id,
    "E8: latest workbench stays aligned to latest run"
);

section("F. Determinism and input immutability across adapter classes");

const laneF1 = makeLane();
const laneF2 = makeLane();

const rawA = makeFileAdapterRaw({ seed: 23, source_id: "det.file" });
const rawB = clone(rawA);

const outF1 = laneF1.ingest(rawA, { run_label: "det_file_run" });
const outF2 = laneF2.ingest(rawB, { run_label: "det_file_run" });

eq(outF1.ok, true, "F1: first deterministic ingest ok");
eq(outF2.ok, true, "F2: second deterministic ingest ok");
deepEq(rawA, rawB, "F3: raw adapter payload not mutated by executive lane");
eq(
    outF1.run_result?.substrate?.state_count,
    outF2.run_result?.substrate?.state_count,
    "F4: deterministic state_count across identical file-backed input"
);
eq(
    outF1.run_result?.substrate?.transition_report?.total_transitions,
    outF2.run_result?.substrate?.transition_report?.total_transitions,
    "F5: deterministic transition totals across identical file-backed input"
);

finish();