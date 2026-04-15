// scripts/run_door_one_workbench.js
//
// Door One Workbench runner
//
// Purpose:
//   - run a lawful Door One batch pass
//   - assemble the DoorOneWorkbench view
//   - write inspection outputs to ./out_workbench/
//   - print a concise terminal summary
//
// Boundary contract:
//   - thin executable wrapper only
//   - does not define new artifact meaning
//   - does not activate canon or promotion
//   - consumes DoorOneOrchestrator + DoorOneWorkbench as-is
//   - JSON-only output surface

import { mkdir, writeFile } from "node:fs/promises";

import { makeTestSignal } from "../fixtures/test_signal.js";
import { DoorOneOrchestrator } from "../runtime/DoorOneOrchestrator.js";
import { DoorOneWorkbench } from "../runtime/DoorOneWorkbench.js";
import { CrossRunSession } from "../runtime/CrossRunSession.js";

const POLICIES = {
    clock_policy_id: "clock.synthetic.v1",
    ingest_policy: {
        policy_id: "ingest.synthetic.v1",
        gap_threshold_multiplier: 3.0,
        allow_non_monotonic: false,
        allow_empty: false,
        non_monotonic_mode: "reject",
    },
    grid_spec: {
        Fs_target: 256,
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
        Fs_target: 256,
        base_window_N: 256,
        hop_N: 128,
        window_function: "hann",
        overlap_ratio: 0.5,
        stationarity_policy: "tolerant",
        salience_policy: "off",
        gap_policy: "interpolate_small",
        max_missing_ratio: 0.25,
        boundary_policy: "pad",
    },
    transform_policy: {
        policy_id: "transform.synthetic.v1",
        transform_type: "fft",
        normalization_mode: "forward_1_over_N",
        scaling_convention: "real_input_half_spectrum",
        numeric_policy: "tolerant",
    },
    compression_policy: {
        policy_id: "compress.synthetic.v1",
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
        policy_id: "anomaly.synthetic.v1",
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
        policy_id: "merge.synthetic.v1",
        adjacency_rule: "time_touching",
        phase_alignment_mode: "clock_delta_rotation",
        weights_mode: "duration",
        novelty_gate: "strict",
        merge_mode: "authoritative",
        grid_tolerance: 0,
    },
    post_merge_compression_policy: {
        policy_id: "merge.compress.synthetic.v1",
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
        policy_id: "reconstruct.synthetic.v1",
        output_format: "values",
        fill_missing_bins: "ZERO",
        validate_invariants: true,
        window_compensation: "NONE",
        numeric_policy: "tolerant",
    },
    basin_policy: {
        policy_id: "basin.synthetic.v1",
        similarity_threshold: 0.35,
        min_member_count: 1,
        weight_mode: "duration",
        linkage: "single_link",
    },
};

const QUERY_SPEC = {
    query_id: "q.workbench.synthetic.v1",
    kind: "energy_trend",
    mode: "ENERGY",
    scope: { allow_cross_segment: true },
};

const QUERY_POLICY = {
    policy_id: "qp.workbench.synthetic.v1",
    scoring: "energy_delta",
    normalization: "none",
    topK: 5,
};

const SYNTHETIC_CASES = {
    baseline: {
        run_label: "workbench_run_a",
        substrate_id: "door_one_workbench_substrate_a",
        raw: {
            seed: 42,
            noiseStd: 0.03,
            source_id: "synthetic_workbench_v1"
        },
        anomaly_threshold: 0.15
    },
    clean: {
        run_label: "workbench_run_b",
        substrate_id: "door_one_workbench_substrate_b",
        raw: {
            seed: 42,
            noiseStd: 0.01,
            source_id: "synthetic_workbench_clean_v1"
        },
        anomaly_threshold: 0.20
    },
    rough: {
        run_label: "workbench_run_c",
        substrate_id: "door_one_workbench_substrate_c",
        raw: {
            seed: 123,
            noiseStd: 0.08,
            source_id: "synthetic_workbench_rough_v1"
        },
        anomaly_threshold: 0.08
    }
};

function makeRawInput({ seed = 42, noiseStd = 0.03, source_id = "synthetic_workbench_v1" } = {}) {
    const { signal } = makeTestSignal({
        durationSec: 10,
        fs: 256,
        seed,
        noiseStd,
        source_id,
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

function conciseWorkbenchSummary(workbench) {
    const runtimeReceipt = workbench?.runtime?.receipt ?? {};
    const trajectory = workbench?.interpretation?.trajectory ?? {};

    return [
        "",
        "Door One Workbench",
        `  stream_id: ${workbench?.scope?.stream_id ?? "-"}`,
        `  segments: ${(workbench?.scope?.segment_ids ?? []).length}`,
        `  states: ${runtimeReceipt?.state_count ?? 0}`,
        `  basins: ${runtimeReceipt?.basin_count ?? 0}`,
        `  cross_run: ${workbench?.scope?.cross_run_context?.available ? `yes (${workbench.scope.cross_run_context.run_count})` : "no"}`,
        `  convergence: ${trajectory?.trajectory_character?.convergence ?? "-"}`,
        `  recurrence: ${trajectory?.neighborhood_character?.recurrence_strength ?? "-"}`,
        "",
    ].join("\n");
}

async function writeJson(path, data) {
    await writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

async function writeWorkbenchBundle(caseName, assembled, result) {
    const dir = `./out_workbench/${caseName}`;
    await mkdir(dir, { recursive: true });

    await writeJson(`${dir}/orchestrator_result.json`, result);
    await writeJson(`${dir}/workbench.json`, assembled);
    await writeFile(`${dir}/summary.txt`, conciseWorkbenchSummary(assembled), "utf8");
    await writeJson(`${dir}/cross_run_report.json`, assembled.cross_run?.report);

    console.log(`[${caseName}] wrote ${dir}/`);
}

function runWorkbenchCase({ run_label, substrate_id, raw, anomaly_threshold }) {
    const orch = new DoorOneOrchestrator({
        policies: {
            ...POLICIES,
            anomaly_policy: {
                ...POLICIES.anomaly_policy,
                threshold_value: anomaly_threshold
            }
        },
        substrate_id
    });

    const result = orch.runBatch(
        makeRawInput(raw),
        { query_spec: QUERY_SPEC, query_policy: QUERY_POLICY }
    );

    if (!result?.ok) {
        throw new Error(`DoorOneOrchestrator failed for ${run_label}`);
    }

    result.run_label = run_label;
    return result;
}

async function main() {
    await mkdir("./out_workbench", { recursive: true });

    const cases = {
        baseline: {
            raw: { seed: 42, noiseStd: 0.03, source_id: "synthetic_workbench_v1" },
            anomaly_threshold: 0.15,
            substrate_id: "door_one_workbench_substrate_baseline",
            run_label: "workbench_run_baseline",
        },
        clean: {
            raw: { seed: 42, noiseStd: 0.01, source_id: "synthetic_workbench_clean_v1" },
            anomaly_threshold: 0.20,
            substrate_id: "door_one_workbench_substrate_clean",
            run_label: "workbench_run_clean",
        },
        rough: {
            raw: { seed: 123, noiseStd: 0.08, source_id: "synthetic_workbench_rough_v1" },
            anomaly_threshold: 0.08,
            substrate_id: "door_one_workbench_substrate_rough",
            run_label: "workbench_run_rough",
        },
    };

    const results = {};

    for (const [caseName, cfg] of Object.entries(cases)) {
        const orch = new DoorOneOrchestrator({
            policies: {
                ...POLICIES,
                anomaly_policy: {
                    ...POLICIES.anomaly_policy,
                    threshold_value: cfg.anomaly_threshold,
                },
            },
            substrate_id: cfg.substrate_id,
        });

        const result = orch.runBatch(
            makeRawInput(cfg.raw),
            {
                query_spec: QUERY_SPEC,
                query_policy: QUERY_POLICY,
            }
        );

        if (!result?.ok) {
            console.error(`DoorOneOrchestrator failed for ${caseName}:`);
            console.error(JSON.stringify(result, null, 2));
            process.exit(1);
        }

        result.run_label = cfg.run_label;
        results[caseName] = result;
    }

    const session = new CrossRunSession({
        session_id: "door-one-workbench-session",
        max_runs: 10,
    });

    session.addRun(results.baseline);
    session.addRun(results.clean);
    session.addRun(results.rough);

    const workbench = new DoorOneWorkbench();

    const assembledBaseline = workbench.assemble(results.baseline, { crossRunSession: session });
    const assembledClean = workbench.assemble(results.clean, { crossRunSession: session });
    const assembledRough = workbench.assemble(results.rough, { crossRunSession: session });

    if (!assembledBaseline?.workbench_type || !assembledClean?.workbench_type || !assembledRough?.workbench_type) {
        console.error("DoorOneWorkbench assembly failed.");
        process.exit(1);
    }

    await writeWorkbenchBundle("baseline", assembledBaseline, results.baseline);
    await writeWorkbenchBundle("clean", assembledClean, results.clean);
    await writeWorkbenchBundle("rough", assembledRough, results.rough);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
