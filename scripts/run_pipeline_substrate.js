// run_pipeline_substrate.js
//
// Integrated pipeline runner in batch/offline mode.
//
// Purpose:
//   - run the deterministic Door One operator chain over a synthetic signal
//   - write concrete JSON artifacts to ./out_substrate/
//   - expose the structural runtime spine without any review or canon layer

import { mkdir, writeFile } from "node:fs/promises";
import { makeTestSignal } from "../fixtures/test_signal.js";

import { IngestOp } from "../operators/ingest/IngestOp.js";
import { ClockAlignOp } from "../operators/clock/ClockAlignOp.js";
import { WindowOp } from "../operators/window/WindowOp.js";
import { TransformOp } from "../operators/transform/TransformOp.js";
import { CompressOp } from "../operators/compress/CompressOp.js";
import { AnomalyOp } from "../operators/anomaly/AnomalyOp.js";
import { MergeOp } from "../operators/merge/MergeOp.js";
import { ReconstructOp } from "../operators/reconstruct/ReconstructOp.js";
import { QueryOp } from "../operators/query/QueryOp.js";

import { SegmentTracker } from "../operators/trajectory/SegmentTracker.js";
import { MemorySubstrate } from "../operators/substrate/MemorySubstrate.js";

const CLOCK_POLICY_ID = "clock.synthetic.v1";

const INGEST_POLICY = {
    policy_id: "ingest.synthetic.v1",
    gap_threshold_multiplier: 3.0,
    allow_non_monotonic: false,
    allow_empty: false,
    non_monotonic_mode: "reject",
};

const GRID_SPEC = {
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
};

const WIN_SPEC = {
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
};

const TRANSFORM_POLICY = {
    policy_id: "transform.synthetic.v1",
    transform_type: "fft",
    normalization_mode: "forward_1_over_N",
    scaling_convention: "real_input_half_spectrum",
    numeric_policy: "tolerant",
};

const COMPRESS_POLICY = {
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
};

const ANOMALY_POLICY = {
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
};

const MERGE_POLICY = {
    policy_id: "merge.synthetic.v1",
    adjacency_rule: "time_touching",
    phase_alignment_mode: "clock_delta_rotation",
    weights_mode: "duration",
    novelty_gate: "strict",
    merge_mode: "authoritative",
    grid_tolerance: 0,
};

const POST_MERGE_COMPRESS = {
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
};

const RECONSTRUCT_POLICY = {
    policy_id: "reconstruct.synthetic.v1",
    output_format: "values",
    fill_missing_bins: "ZERO",
    validate_invariants: true,
    window_compensation: "NONE",
    numeric_policy: "tolerant",
};

const QUERY_POLICY = {
    policy_id: "query.synthetic.v1",
    scoring: "band_l1",
    normalization: "band_profile_norm",
    phase_used: false,
    allow_lens_merge: false,
    topK: 5,
};

async function main() {
    await mkdir("./out_substrate", { recursive: true });

    const fixture = makeTestSignal({
        durationSec: 10,
        fs: 256,
        seed: 42,
        noiseStd: 0.03,
        source_id: "synthetic_fixture_v1",
        channel: "ch0",
        modality: "voltage",
        units: "arb",
    });
    const { signal, truth } = fixture;

    const ingestOp = new IngestOp();
    const a1 = assertOk("IngestOp", ingestOp.run({
        timestamps: signal.timestamps,
        values: signal.values,
        meta: signal.meta,
        clock_policy_id: CLOCK_POLICY_ID,
        ingest_policy: INGEST_POLICY,
        stream_id: signal.stream_id,
        source_id: signal.source_id,
        channel: signal.channel,
        modality: signal.modality,
    })).artifact;

    const a2 = assertOk("ClockAlignOp", new ClockAlignOp().run({
        a1,
        grid_spec: { ...GRID_SPEC, t_ref: a1.timestamps[0] ?? 0 },
    })).artifact;

    const w1s = assertOk("WindowOp", new WindowOp().run({
        a2,
        window_spec: WIN_SPEC,
    })).artifacts;

    const segTracker = new SegmentTracker({ stream_id: a1.stream_id });
    const substrate = new MemorySubstrate({
        substrate_id: `substrate:${a1.stream_id}`,
        trajectory_max_frames: 2048,
    });

    const transformOp = new TransformOp();
    const compressOp = new CompressOp();
    const anomalyOp = new AnomalyOp();

    const h1s = [];
    const anomalyReports = [];
    const segmentTransitions = [];
    const skippedWindows = [];
    let currentBaseline = null;

    for (const w1 of w1s) {
        const tOut = transformOp.run({ w1, transform_policy: TRANSFORM_POLICY });
        if (!tOut.ok) {
            skippedWindows.push({ window_id: w1.window_id, stage: "transform", error: tOut.error, reasons: tOut.reasons });
            continue;
        }

        const cOut = compressOp.run({
            s1: tOut.artifact,
            compression_policy: COMPRESS_POLICY,
            context: {
                segment_id: segTracker.currentSegmentId,
                window_span: {
                    t_start: w1.grid.t0,
                    t_end: w1.grid.t0 + w1.grid.N / w1.grid.Fs_target,
                },
            },
        });
        if (!cOut.ok) {
            skippedWindows.push({ window_id: w1.window_id, stage: "compress", error: cOut.error, reasons: cOut.reasons });
            continue;
        }

        const h1 = cOut.artifact;
        h1s.push(h1);

        const isSegmentBaseline = currentBaseline === null;
        if (isSegmentBaseline) currentBaseline = h1;

        let report = null;
        let currentNovelty = false;

        if (!isSegmentBaseline && currentBaseline) {
            const aOut = anomalyOp.run({
                h_current: h1,
                h_base: currentBaseline,
                anomaly_policy: ANOMALY_POLICY,
            });
            if (aOut.ok) {
                report = aOut.artifact;
                anomalyReports.push(report);
                currentNovelty = Boolean(report.novelty_gate_triggered);
            }
        }

        substrate.commit(h1, { novelty_gate_triggered: currentNovelty });

        if (report) {
            const transition = segTracker.observe(report);
            if (transition) {
                segmentTransitions.push(transition);
                currentBaseline = null;
            }
        }
    }

    const mergeOp = new MergeOp();
    const m1s = [];
    const mergeFailures = [];
    const h1sBySegment = new Map();

    for (const h1 of h1s) {
        if (!h1sBySegment.has(h1.segment_id)) h1sBySegment.set(h1.segment_id, []);
        h1sBySegment.get(h1.segment_id).push(h1);
    }

    for (const [segId, segH1s] of h1sBySegment) {
        for (let i = 0; i + 1 < segH1s.length; i += 2) {
            const mOut = mergeOp.run({
                states: [segH1s[i], segH1s[i + 1]],
                merge_policy: MERGE_POLICY,
                post_merge_compression_policy: POST_MERGE_COMPRESS,
                merge_tree_position: { level: 0, index: Math.floor(i / 2) },
            });
            if (mOut.ok) {
                m1s.push(mOut.artifact);
                substrate.commit(mOut.artifact);
            } else {
                mergeFailures.push({ segment_id: segId, pair: i, error: mOut.error, reasons: mOut.reasons });
            }
        }
    }

    let a3 = null;
    const reconTarget = m1s[0] ?? h1s[0];
    if (reconTarget) {
        a3 = assertOk("ReconstructOp", new ReconstructOp().run({
            state: reconTarget,
            reconstruct_policy: RECONSTRUCT_POLICY,
        })).artifact;
    }

    const q = assertOk("QueryOp", new QueryOp().run({
        query_spec: {
            query_id: "query.synthetic.1",
            kind: "similarity",
            mode: "IDENTITY",
            scope: {
                stream_id: a1.stream_id,
                allow_cross_segment: true,
                same_grid_only: true,
            },
            query: { state: h1s[0] },
        },
        query_policy: QUERY_POLICY,
        corpus: [...h1s, ...m1s],
    })).artifact;

    const substrateSummary = substrate.summary();
    const trajectorySummary = substrate.trajectory.summary();

    await writeJson("./out_substrate/fixture.signal.json", signal);
    await writeJson("./out_substrate/fixture.truth.json", truth);
    await writeJson("./out_substrate/A1.json", a1);
    await writeJson("./out_substrate/A2.json", a2);
    await writeJson("./out_substrate/W1.json", w1s);
    await writeJson("./out_substrate/H1.json", h1s);
    await writeJson("./out_substrate/AnomalyReports.json", anomalyReports);
    await writeJson("./out_substrate/SegmentTransitions.json", segmentTransitions);
    await writeJson("./out_substrate/M1.json", m1s);
    await writeJson("./out_substrate/A3.json", a3);
    await writeJson("./out_substrate/Q.json", q);
    await writeJson("./out_substrate/TrajectoryFrames.json", substrate.trajectory.all());
    await writeJson("./out_substrate/skipped_windows.json", skippedWindows);
    await writeJson("./out_substrate/merge_failures.json", mergeFailures);

    await writeJson("./out_substrate/summary.json", {
        run_timestamp: new Date().toISOString(),
        stream_id: a1.stream_id,
        signal_duration_sec: truth.durationSec,
        signal_fs: truth.fs,
        sample_count: signal.values.length,
        truth_segment_count: truth.segments.length,
        aligned_sample_count: a2.aligned_values.length,
        window_count: w1s.length,
        h1_count: h1s.length,
        m1_count: m1s.length,
        anomaly_report_count: anomalyReports.length,
        skipped_window_count: skippedWindows.length,
        merge_failure_count: mergeFailures.length,
        segment_count: segTracker.summary().segment_count,
        segment_transitions: segmentTransitions.length,
        segment_ids: segTracker.segmentHistory(),
        substrate_state_count: substrateSummary.state_count,
        substrate_basin_count: substrateSummary.basin_count,
        substrate_trajectory_frames: trajectorySummary.frame_count,
        t_span: substrateSummary.t_span,
        query_result_count: q.results.length,
        top_query_refs: q.results.slice(0, 3).map((r) => r.ref),
        reconstruction_target_class: reconTarget?.artifact_class ?? null,
        reconstruction_target_id: reconTarget?.state_id ?? null,
    });

    console.log("");
    console.log("Door One pipeline substrate run complete");
    console.log(`  stream: ${a1.stream_id}`);
    console.log(`  windows: ${w1s.length}`);
    console.log(`  states: ${substrateSummary.state_count}`);
    console.log(`  basins: ${substrateSummary.basin_count}`);
    console.log(`  trajectory frames: ${trajectorySummary.frame_count}`);
    console.log("  outputs: ./out_substrate/");
    console.log("");
}

function assertOk(label, result) {
    if (!result?.ok) {
        console.error(`\n${label} FAILED`);
        console.error(JSON.stringify(result, null, 2));
        process.exit(1);
    }
    return result;
}

async function writeJson(path, value) {
    await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
