import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeTestSignal } from "../fixtures/test_signal.js";
import { DoorOneOrchestrator } from "../runtime/DoorOneOrchestrator.js";
import { DoorOneWorkbench } from "../runtime/DoorOneWorkbench.js";
import { reconstructFromReplayRequest } from "../runtime/reconstruction/ProvenanceReconstructionPipeline.js";
import {
    validateDoorOneLiveProvenanceReceipt,
    validateDoorOneOrchestratorReceipt,
    validateDoorOneWorkbenchReceipt,
    validateProvenanceReconstructionReceipt,
} from "../runtime/schema/ExecutionSurfaceReceiptValidators.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

let PASS = 0;
let FAIL = 0;

function section(title) {
    console.log(`\n-- ${title} --`);
}

function ok(condition, label) {
    if (condition) {
        PASS += 1;
        console.log(`  ok ${label}`);
    } else {
        FAIL += 1;
        console.error(`  not ok ${label}`);
    }
}

function eq(actual, expected, label) {
    ok(Object.is(actual, expected), `${label}${Object.is(actual, expected) ? "" : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`}`);
}

function finish() {
    console.log(`\n${PASS} passed   ${FAIL} failed`);
    if (FAIL > 0) process.exit(1);
}

const POLICIES = {
    clock_policy_id: "clock.schema.v1",
    ingest_policy: {
        policy_id: "ingest.schema.v1",
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
        policy_id: "transform.schema.v1",
        transform_type: "fft",
        normalization_mode: "forward_1_over_N",
        scaling_convention: "real_input_half_spectrum",
        numeric_policy: "tolerant",
    },
    compression_policy: {
        policy_id: "compress.schema.v1",
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
        policy_id: "anomaly.schema.v1",
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
        policy_id: "merge.schema.v1",
        adjacency_rule: "time_touching",
        phase_alignment_mode: "clock_delta_rotation",
        weights_mode: "duration",
        novelty_gate: "strict",
        merge_mode: "authoritative",
        grid_tolerance: 0,
    },
    post_merge_compression_policy: {
        policy_id: "merge.compress.schema.v1",
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
        policy_id: "reconstruct.schema.v1",
        output_format: "values",
        fill_missing_bins: "ZERO",
        validate_invariants: true,
        window_compensation: "NONE",
        numeric_policy: "tolerant",
    },
    basin_policy: {
        policy_id: "basin.schema.v1",
        similarity_threshold: 0.35,
        min_member_count: 1,
        weight_mode: "duration",
        linkage: "single_link",
    },
};

const QUERY_SPEC = {
    query_id: "q.schema.v1",
    kind: "energy_trend",
    mode: "ENERGY",
    scope: { allow_cross_segment: true },
};

const QUERY_POLICY = {
    policy_id: "qp.schema.v1",
    scoring: "energy_delta",
    normalization: "none",
    topK: 5,
};

function makeRawInput() {
    const { signal } = makeTestSignal({
        durationSec: 4,
        fs: 8,
        seed: 7,
        noiseStd: 0.01,
        source_id: "schema.fixture",
        channel: "ch0",
        modality: "voltage",
        units: "arb",
    });

    return {
        timestamps: signal.timestamps,
        values: signal.values,
        stream_id: signal.stream_id,
        source_id: signal.source_id,
        channel: signal.channel,
        modality: signal.modality,
        meta: signal.meta,
        clock_policy_id: POLICIES.clock_policy_id,
    };
}

function makeLiveProvenanceReceipt({ runResult, workbench }) {
    const runtimeReceipt = workbench?.runtime?.receipt ?? runResult?.runtime_receipt ?? {};
    const interpretation = workbench?.interpretation?.trajectory ?? {};

    return {
        receipt_type: "runtime:door_one_live_provenance_receipt",
        receipt_version: "0.1.0",
        generated_from: "schema validation fixture",
        written_at: "2026-04-13T00:00:00.000Z",
        cycle: {
            cycle_dir: "cycle_01",
            cycle_index: 1,
            run_label: runResult?.run_label ?? "schema_run_1",
        },
        scope: {
            stream_id: workbench?.scope?.stream_id ?? null,
            source_mode: "synthetic",
            source_id: runResult?.artifacts?.a1?.source_id ?? null,
            channel: runResult?.artifacts?.a1?.channel ?? null,
            modality: runResult?.artifacts?.a1?.modality ?? null,
        },
        structural_summary: {
            state_count: runtimeReceipt?.state_count ?? 0,
            basin_count: runtimeReceipt?.basin_count ?? 0,
            segment_count: runtimeReceipt?.segment_count ?? 0,
            convergence: interpretation?.trajectory_character?.convergence ?? "unknown",
            motion: interpretation?.trajectory_character?.motion ?? "unknown",
            occupancy: interpretation?.neighborhood_character?.occupancy ?? "unknown",
            recurrence: interpretation?.neighborhood_character?.recurrence_strength ?? "unknown",
            continuity: interpretation?.segment_character?.continuity ?? "unknown",
        },
        cross_run_context: {
            available: false,
            run_count: 0,
        },
        references: {
            live_cycle_dir: "./out_live/cycle_01",
            latest_workbench: "./out_live/latest_workbench.json",
            latest_run_result: "./out_live/latest_run_result.json",
            latest_cross_run_report: "./out_live/latest_cross_run_report.json",
            latest_session_summary: "./out_live/session_summary.json",
        },
    };
}

section("A. Schema files parse");
for (const rel of [
    "schemas/runtime/door_one_orchestrator_receipt.schema.json",
    "schemas/runtime/door_one_workbench_receipt.schema.json",
    "schemas/runtime/door_one_live_provenance_receipt.schema.json",
    "schemas/runtime/provenance_reconstruction_receipt.schema.json",
    "schemas/probe/probe_report_receipt.schema.json",
    "schemas/lm/workbench_lm_input.schema.json",
    "schemas/lm/workbench_lm_output.schema.json",
    "schemas/lm/local_lm_benchmark_receipt.schema.json",
    "schemas/handoff/pass_request.schema.json",
    "schemas/handoff/role_response.schema.json",
    "schemas/handoff/gate_decision.schema.json",
    "schemas/handoff/cycle_log_entry.schema.json",
    "schemas/handoff/subject_register_entry.schema.json",
]) {
    const raw = await readFile(path.join(ROOT, rel), "utf8");
    const schema = JSON.parse(raw);
    ok(typeof schema.$id === "string" && schema.$id.length > 0, `A: ${rel} parses with $id`);
}

section("B. Runtime receipt validation");
const orch = new DoorOneOrchestrator({
    policies: POLICIES,
    substrate_id: "schema_substrate",
});
const runResult = orch.runBatch(makeRawInput(), {
    query_spec: QUERY_SPEC,
    query_policy: QUERY_POLICY,
});
runResult.run_label = "schema_run_1";

const workbench = new DoorOneWorkbench().assemble(runResult);
const runtimeValidation = validateDoorOneOrchestratorReceipt(runResult.runtime_receipt);
const workbenchValidation = validateDoorOneWorkbenchReceipt(workbench.workbench_receipt);

ok(runResult.ok === true, "B1: orchestrator run succeeded");
eq(runtimeValidation.ok, true, `B2: orchestrator receipt validates${runtimeValidation.ok ? "" : ` ${runtimeValidation.errors.join("; ")}`}`);
eq(workbenchValidation.ok, true, `B3: workbench receipt validates${workbenchValidation.ok ? "" : ` ${workbenchValidation.errors.join("; ")}`}`);

section("C. Provenance and reconstruction receipt validation");
const provenanceReceipt = makeLiveProvenanceReceipt({ runResult, workbench });
const provenanceValidation = validateDoorOneLiveProvenanceReceipt(provenanceReceipt);
eq(provenanceValidation.ok, true, `C1: live provenance receipt validates${provenanceValidation.ok ? "" : ` ${provenanceValidation.errors.join("; ")}`}`);

const replay = reconstructFromReplayRequest({
    replayRequest: {
        replay_request_id: "RPLY:schema:001",
        replay_type: "runtime_reconstruction",
        request_status: "prepared",
        replay_target_type: "current_run_workbench",
        replay_target_ref: "schema_run_1",
        source_family: "Synthetic Signal",
        run_label: "schema_run_1",
        stream_id: runResult.artifacts?.a1?.stream_id ?? null,
        source_id: runResult.artifacts?.a1?.source_id ?? null,
        declared_lens: {
            transform_family: "FFT/Hann",
            window_N: 8,
            hop_N: 4,
            Fs_target: 8,
        },
        retained_tier_used: {
            tier_used: 0,
            tier_label: "Tier 0 - live working state",
            honest_posture: "Tier 0 only - session-scoped",
        },
        support_basis: ["runtime_receipt"],
        explicit_non_claims: ["not canon", "not truth", "not raw restoration"],
        derived_vs_durable: "derived - Tier 0",
    },
    runResult,
    workbench,
});
const reconstructionValidation = validateProvenanceReconstructionReceipt(
    replay.reconstruction_receipt
);

ok(replay.ok === true, "C2: reconstruction run succeeded");
eq(reconstructionValidation.ok, true, `C3: reconstruction receipt validates${reconstructionValidation.ok ? "" : ` ${reconstructionValidation.errors.join("; ")}`}`);

finish();
