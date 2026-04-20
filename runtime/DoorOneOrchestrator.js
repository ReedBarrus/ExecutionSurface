// DoorOneOrchestrator.js
//
// Layer: Substrate Space orchestration helper
// Authority class: none. This is a runtime coordinator, not a pipeline operator.
//
// Purpose:
// Provide one obvious, stable way to run the Door One stack end-to-end for:
//   - batch execution via runBatch()
//   - incremental execution via ingestAndAlign() / processWindow() / finalise()
//
// Boundary contract:
//   - does not define new operators, artifact classes, or policy defaults
//   - all policy must be supplied by the caller
//   - output is a plain-data object that separates:
//       artifacts  - pipeline artifact classes
//       substrate  - substrate commit counts, basin sets, transition report
//       summaries  - operational summaries
//       audit      - skipped windows and merge failures
//   - deterministic and audit-friendly
//   - does not activate canon, promotion, or review layers

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

export class DoorOneOrchestrator {
    /**
     * @param {Object} cfg
     * @param {DoorOnePolicies} cfg.policies
     * @param {string} [cfg.substrate_id]
     * @param {number} [cfg.trajectory_max_frames=2048]
     */
    constructor({ policies, substrate_id, trajectory_max_frames = 2048 }) {
        if (!policies) throw new Error("DoorOneOrchestrator: policies is required");

        this.policies = policies;

        this._ingestOp = new IngestOp();
        this._clockAlignOp = new ClockAlignOp();
        this._windowOp = new WindowOp();
        this._transformOp = new TransformOp();
        this._compressOp = new CompressOp();
        this._anomalyOp = new AnomalyOp();
        this._mergeOp = new MergeOp();
        this._reconstructOp = new ReconstructOp();
        this._queryOp = new QueryOp();

        this._substrate = new MemorySubstrate({
            substrate_id: substrate_id ?? "door_one_substrate",
            trajectory_max_frames,
        });

        /** @type {SegmentTracker|null} */
        this._segTracker = null;

        this._h1s = [];
        this._anomalyReports = [];
        this._segmentTransitions = [];
        this._skippedWindows = [];
        this._currentBaseline = null;
        this._a1 = null;
        this._a2 = null;
    }

    /**
     * Run IngestOp -> ClockAlignOp and initialize the SegmentTracker.
     *
     * @param {Object} raw
     * @returns {{ ok: true, a1: Object, a2: Object } | { ok: false, stage: string, error: string, reasons: string[] }}
     */
    ingestAndAlign(raw) {
        const p = this.policies;

        const ingest = this._ingestOp.run({
            timestamps: raw.timestamps,
            values: raw.values,
            meta: raw.meta,
            clock_policy_id: raw.clock_policy_id ?? p.clock_policy_id,
            ingest_policy: p.ingest_policy,
            stream_id: raw.stream_id,
            source_id: raw.source_id,
            channel: raw.channel,
            modality: raw.modality,
        });
        if (!ingest.ok) {
            return { ok: false, stage: "IngestOp", error: ingest.error, reasons: ingest.reasons };
        }

        this._a1 = ingest.artifact;
        this._segTracker = new SegmentTracker({ stream_id: this._a1.stream_id });

        const align = this._clockAlignOp.run({
            a1: this._a1,
            grid_spec: { ...p.grid_spec, t_ref: this._a1.timestamps[0] ?? 0 },
        });
        if (!align.ok) {
            return { ok: false, stage: "ClockAlignOp", error: align.error, reasons: align.reasons };
        }

        this._a2 = align.artifact;
        return { ok: true, a1: this._a1, a2: this._a2 };
    }

    /**
     * Run WindowOp over the aligned stream.
     *
     * @param {Object} a2
     * @returns {{ ok: true, w1s: Object[] } | { ok: false, stage: string, error: string, reasons: string[] }}
     */
    window(a2) {
        const out = this._windowOp.run({ a2, window_spec: this.policies.window_spec });
        if (!out.ok) {
            return { ok: false, stage: "WindowOp", error: out.error, reasons: out.reasons };
        }
        return { ok: true, w1s: out.artifacts };
    }

    /**
     * Process one W1 through TransformOp -> CompressOp -> AnomalyOp -> commit.
     *
     * @param {Object} w1
     * @returns {{
     *   ok: boolean,
     *   h1: Object|null,
     *   anomaly_report: Object|null,
     *   segment_transition: Object|null,
     *   skipped: boolean,
     *   skip_reason: string|null,
     * }}
     */
    processWindow(w1) {
        if (!this._segTracker) {
            return {
                ok: false,
                skipped: true,
                skip_reason: "ingestAndAlign() must be called first",
                h1: null,
                anomaly_report: null,
                segment_transition: null,
            };
        }

        const p = this.policies;

        const tOut = this._transformOp.run({ w1, transform_policy: p.transform_policy });
        if (!tOut.ok) {
            const skip = {
                window_id: w1.window_id,
                stage: "transform",
                error: tOut.error,
                reasons: tOut.reasons,
            };
            this._skippedWindows.push(skip);
            return {
                ok: false,
                skipped: true,
                skip_reason: tOut.error,
                h1: null,
                anomaly_report: null,
                segment_transition: null,
            };
        }

        const t_start = w1.grid?.t0 ?? w1.window_span?.t_start ?? 0;
        const t_end = t_start + (w1.grid?.N ?? 0) / (w1.grid?.Fs_target ?? 1);
        const cOut = this._compressOp.run({
            s1: tOut.artifact,
            compression_policy: p.compression_policy,
            context: {
                segment_id: this._segTracker.currentSegmentId,
                window_span: { t_start, t_end },
            },
        });
        if (!cOut.ok) {
            const skip = {
                window_id: w1.window_id,
                stage: "compress",
                error: cOut.error,
                reasons: cOut.reasons,
            };
            this._skippedWindows.push(skip);
            return {
                ok: false,
                skipped: true,
                skip_reason: cOut.error,
                h1: null,
                anomaly_report: null,
                segment_transition: null,
            };
        }

        const h1 = cOut.artifact;
        this._h1s.push(h1);

        const isSegmentBaseline = this._currentBaseline === null;
        if (isSegmentBaseline) this._currentBaseline = h1;

        let anomalyReport = null;
        let segmentTransition = null;
        let currentNovelty = false;

        if (!isSegmentBaseline && this._currentBaseline) {
            const aOut = this._anomalyOp.run({
                h_current: h1,
                h_base: this._currentBaseline,
                anomaly_policy: p.anomaly_policy,
            });
            if (aOut.ok) {
                anomalyReport = aOut.artifact;
                this._anomalyReports.push(anomalyReport);
                currentNovelty = Boolean(anomalyReport.novelty_gate_triggered);
            }
        }

        this._substrate.commit(h1, { novelty_gate_triggered: currentNovelty });

        if (anomalyReport) {
            const transition = this._segTracker.observe(anomalyReport);
            if (transition) {
                segmentTransition = transition;
                this._segmentTransitions.push(transition);
                this._currentBaseline = null;
            }
        }

        return {
            ok: true,
            skipped: false,
            skip_reason: null,
            h1,
            anomaly_report: anomalyReport,
            segment_transition: segmentTransition,
        };
    }

    /**
     * Complete the pipeline after all windows have been processed.
     *
     * @param {Object} [opts]
     * @param {Object} [opts.query_spec]
     * @param {Object} [opts.query_policy]
     * @returns {DoorOneResult}
     */
    finalise({ query_spec, query_policy } = {}) {
        const p = this.policies;

        const m1s = [];
        const mergeFailures = [];

        const h1sBySegment = new Map();
        for (const h1 of this._h1s) {
            if (!h1sBySegment.has(h1.segment_id)) h1sBySegment.set(h1.segment_id, []);
            h1sBySegment.get(h1.segment_id).push(h1);
        }

        for (const [segId, segH1s] of h1sBySegment) {
            for (let i = 0; i + 1 < segH1s.length; i += 2) {
                const mOut = this._mergeOp.run({
                    states: [segH1s[i], segH1s[i + 1]],
                    merge_policy: p.merge_policy,
                    post_merge_compression_policy: p.post_merge_compression_policy,
                    merge_tree_position: { level: 0, index: Math.floor(i / 2) },
                });
                if (mOut.ok) {
                    m1s.push(mOut.artifact);
                    this._substrate.commit(mOut.artifact);
                } else {
                    mergeFailures.push({
                        segment_id: segId,
                        pair: i,
                        error: mOut.error,
                        reasons: mOut.reasons,
                    });
                }
            }
        }

        const basinSets = [];
        if (this._segTracker && p.basin_policy) {
            for (const segId of this._segTracker.segmentHistory()) {
                const segStates = this._substrate.statesForSegment(segId);
                if (segStates.length === 0) continue;

                const bPolicy = segStates.length >= (p.basin_policy.min_member_count ?? 1)
                    ? p.basin_policy
                    : {
                        ...p.basin_policy,
                        min_member_count: 1,
                        policy_id: `${p.basin_policy.policy_id}.single`,
                    };

                const rbResult = this._substrate.rebuildBasins({
                    segment_id: segId,
                    basin_policy: bPolicy,
                });
                if (rbResult.ok) basinSets.push(rbResult.artifact);
            }
        }

        let a3 = null;
        const reconTarget = m1s[0] ?? this._h1s[0] ?? null;
        if (reconTarget && p.reconstruct_policy) {
            const rOut = this._reconstructOp.run({
                state: reconTarget,
                reconstruct_policy: p.reconstruct_policy,
            });
            if (rOut.ok) a3 = rOut.artifact;
        }

        let q = null;
        if (query_spec && query_policy && (this._h1s.length + m1s.length) > 0) {
            const qOut = this._substrate.queryStates(query_spec, query_policy);
            if (qOut.ok) q = qOut.artifact;
        }

        const transitionReport = this._substrate.neighborhoodTransitionReport();

        return buildResult({
            a1: this._a1,
            a2: this._a2,
            h1s: this._h1s,
            m1s,
            a3,
            q,
            basinSets,
            anomalyReports: this._anomalyReports,
            segmentTransitions: this._segmentTransitions,
            substrate: this._substrate,
            transitionReport,
            skippedWindows: this._skippedWindows,
            mergeFailures,
            segTracker: this._segTracker,
        });
    }

    /**
     * Run the full Door One pipeline in one call over raw input.
     *
     * @param {Object} raw
     * @param {Object} [opts]
     * @returns {DoorOneResult}
     */
    runBatch(raw, opts = {}) {
        const ia = this.ingestAndAlign(raw);
        if (!ia.ok) return { ok: false, stage: ia.stage, error: ia.error, reasons: ia.reasons };

        const win = this.window(ia.a2);
        if (!win.ok) return { ok: false, stage: win.stage, error: win.error, reasons: win.reasons };

        for (const w1 of win.w1s) {
            this.processWindow(w1);
        }

        return this.finalise(opts);
    }

    get substrate() {
        return this._substrate;
    }

    get currentSegmentId() {
        return this._segTracker?.currentSegmentId ?? null;
    }
}

/**
 * @typedef {Object} DoorOneResult
 * @property {boolean} ok
 * @property {Object} artifacts
 * @property {Object} substrate
 * @property {Object} summaries
 * @property {Object} audit
 */
function buildResult({
    a1,
    a2,
    h1s,
    m1s,
    a3,
    q,
    basinSets,
    anomalyReports,
    segmentTransitions,
    substrate,
    transitionReport,
    skippedWindows,
    mergeFailures,
    segTracker,
}) {
    const substrateSummary = substrate.summary();
    const trajSummary = substrate.trajectory.summary();
    const segSummary = segTracker?.summary() ?? null;
    const segmentIds = segSummary?.segment_ids ?? [];
    const runtimeReceipt = {
        receipt_type: "runtime:door_one_orchestrator_receipt",
        stream_id: a1?.stream_id ?? null,
        source_id: a1?.source_id ?? null,
        state_count: substrateSummary.state_count,
        basin_count: substrateSummary.basin_count,
        segment_count: substrateSummary.segment_count,
        trajectory_frames: trajSummary.frame_count,
        segment_transition_count: segmentTransitions.length,
        h1_count: h1s.length,
        m1_count: m1s.length,
        anomaly_count: anomalyReports.length,
        query_present: !!q,
        skipped_window_count: skippedWindows.length,
        merge_failure_count: mergeFailures.length,
    };

    const baseInput = {
        ok: true,
        artifacts: {
            a1,
            a2,
            h1s,
            m1s,
            a3,
            q,
            anomaly_reports: anomalyReports,
            basin_sets: basinSets,
        },
        substrate: {
            state_count: substrateSummary.state_count,
            latest_committed_state_id: substrateSummary.latest_committed_state_id,
            latest_committed_memory_object_id: substrateSummary.latest_committed_memory_object_id,
            basin_count: substrateSummary.basin_count,
            segment_count: substrateSummary.segment_count,
            trajectory_frames: trajSummary.frame_count,
            t_span: substrateSummary.t_span,
            segment_ids: segmentIds,
            segment_transitions: segmentTransitions,
            transition_report: transitionReport,
        },
        summaries: {
            substrate: substrateSummary,
            trajectory: trajSummary,
            segtracker: segSummary,
        },
        audit: {
            skipped_windows: skippedWindows,
            merge_failures: mergeFailures,
        },
        runtime_receipt: runtimeReceipt,
    };

    return {
        ok: true,
        artifacts: baseInput.artifacts,
        substrate: {
            state_count: substrateSummary.state_count,
            latest_committed_state_id: substrateSummary.latest_committed_state_id,
            latest_committed_memory_object_id: substrateSummary.latest_committed_memory_object_id,
            basin_count: substrateSummary.basin_count,
            segment_count: substrateSummary.segment_count,
            t_span: substrateSummary.t_span,
            trajectory_frames: trajSummary.frame_count,
            segment_ids: segTracker?.segmentHistory() ?? [],
            segment_transitions: segmentTransitions,
            transition_report: transitionReport,
        },
        summaries: {
            substrate: substrateSummary,
            trajectory: trajSummary,
            segtracker: segSummary,
        },
        runtime_receipt: runtimeReceipt,
        audit: {
            skipped_windows: skippedWindows,
            merge_failures: mergeFailures,
        },
    };
}

/**
 * @typedef {Object} DoorOnePolicies
 * @property {string} clock_policy_id
 * @property {Object} ingest_policy
 * @property {Object} grid_spec
 * @property {Object} window_spec
 * @property {Object} transform_policy
 * @property {Object} compression_policy
 * @property {Object} anomaly_policy
 * @property {Object} merge_policy
 * @property {Object} post_merge_compression_policy
 * @property {Object} [reconstruct_policy]
 * @property {Object} [basin_policy]
 */
