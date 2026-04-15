// operators/trajectory/SegmentTracker.js
//
// SegmentTracker
//
// Purpose:
// Maintain the current segment_id for an ongoing stream by consuming
// AnomalyReport artifacts and enforcing the segmentation rules from
// README_SubstrateLayer.md §1 (SegmentTracker contract).
//
// A segment represents a structurally coherent era.
// A segment transition occurs when:
//   1. AnomalyOp sets novelty_gate_triggered = true
//   2. The divergence has been sustained for >= novelty_min_windows
//      (this rule is already enforced inside AnomalyOp; we respect its output)
//
// SegmentTracker does NOT:
//   - Override or re-evaluate AnomalyOp decisions
//   - Modify any artifact
//   - Make merge or compression decisions
//
// It is a stateful bookkeeper — it gives CompressOp context.segment_id
// and MergeOp its eligibility boundaries, nothing more.
//
// Segment ID format:
//   seg:<stream_id>:<epoch_counter>
//   e.g. "seg:STR:fixture:ch0:voltage:...:0"
//        "seg:STR:fixture:ch0:voltage:...:1"
//
// Determinism:
//   Given the same ordered sequence of AnomalyReports, SegmentTracker
//   produces identical segment_ids and transition records.
//
// References:
// - README_SubstrateLayer.md §1 (SegmentTracker, segment ID format)
// - README_MasterConstitution.md §3 (AnomalyOp, runtime memory layer)
// - OPERATOR_CONTRACTS.md §6 (AnomalyOp)

/**
 * @typedef {Object} SegmentTransition
 * @property {string} from_segment_id
 * @property {string} to_segment_id
 * @property {number} t_transition        — t_start of first window in new segment
 * @property {string} trigger_window_ref  — state_id or window_ref from AnomalyReport
 * @property {number} divergence_score
 * @property {string[]} detected_event_types
 * @property {number} epoch_counter
 */

export class SegmentTracker {
    /**
     * @param {Object} cfg
     * @param {string} cfg.stream_id
     * @param {string} [cfg.initial_segment_suffix="0"]   — first segment epoch index
     */
    constructor(cfg) {
        if (!cfg?.stream_id || typeof cfg.stream_id !== "string") {
            throw new Error("SegmentTracker: cfg.stream_id must be a non-empty string");
        }
        this.stream_id = cfg.stream_id;
        this._epoch_counter = 0;
        this._current_segment_id = this._makeSegmentId(this._epoch_counter);

        /** @type {SegmentTransition[]} */
        this._transitions = [];
        this._window_count = 0;        // total windows seen (for audit)
        this._novelty_count = 0;       // total novelty gates triggered
    }

    // ─── Primary interface ────────────────────────────────────────────────────

    /**
     * Current segment_id. Pass this as context.segment_id to CompressOp.
     * @returns {string}
     */
    get currentSegmentId() {
        return this._current_segment_id;
    }

    /**
     * Feed one AnomalyReport. If novelty_gate_triggered, transitions to a new
     * segment and returns the transition record. Otherwise returns null.
     *
     * Call this AFTER CompressOp (since the H1 being anomaly-checked has already
     * been compressed with the current segment_id), and BEFORE the next CompressOp
     * call (so future H1s get the new segment_id).
     *
     * @param {Object} anomaly_report   — AnomalyReport artifact from AnomalyOp
     * @returns {SegmentTransition|null}
     */
    observe(anomaly_report) {
        if (!anomaly_report || typeof anomaly_report !== "object") return null;

        this._window_count++;

        if (!anomaly_report.novelty_gate_triggered) return null;

        this._novelty_count++;

        const from_segment_id = this._current_segment_id;
        this._epoch_counter++;
        this._current_segment_id = this._makeSegmentId(this._epoch_counter);

        // window_ref is "t_start:t_end" string (e.g. "2.5:3.5")
        const wref = anomaly_report.window_ref ?? null;
        let t_transition = null;
        if (typeof wref === "string") {
            const p = parseFloat(wref.split(":")[0]);
            if (Number.isFinite(p)) t_transition = p;
        }

        /** @type {SegmentTransition} */
        const transition = {
            from_segment_id,
            to_segment_id: this._current_segment_id,
            t_transition,
            trigger_window_ref: wref,
            divergence_score: anomaly_report.divergence_score ?? null,
            detected_event_types: (anomaly_report.detected_events ?? []).map(e => e.type),
            epoch_counter: this._epoch_counter,
        };

        this._transitions.push(transition);
        return transition;
    }

    /**
     * Batch-observe an array of AnomalyReports in order.
     * Returns all transitions that occurred.
     * @param {Object[]} reports
     * @returns {SegmentTransition[]}
     */
    observeAll(reports) {
        const transitions = [];
        for (const r of reports) {
            const t = this.observe(r);
            if (t) transitions.push(t);
        }
        return transitions;
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

    /**
     * All segment transitions that have occurred so far.
     * @returns {SegmentTransition[]}
     */
    get transitions() {
        return [...this._transitions];
    }

    /**
     * All segment IDs that have been active, in order of first activation.
     * @returns {string[]}
     */
    segmentHistory() {
        const ids = [this._makeSegmentId(0)];
        for (const t of this._transitions) ids.push(t.to_segment_id);
        return ids;
    }

    /**
     * Summary of tracking state.
     * @returns {Object}
     */
    summary() {
        return {
            stream_id: this.stream_id,
            current_segment_id: this._current_segment_id,
            epoch_counter: this._epoch_counter,
            segment_count: this._epoch_counter + 1,
            windows_observed: this._window_count,
            novelty_gates_triggered: this._novelty_count,
            transitions: this._transitions.length,
        };
    }

    /**
     * Reset to initial state (e.g. for replay from beginning of stream).
     */
    reset() {
        this._epoch_counter = 0;
        this._current_segment_id = this._makeSegmentId(0);
        this._transitions = [];
        this._window_count = 0;
        this._novelty_count = 0;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    _makeSegmentId(epoch) {
        return `seg:${this.stream_id}:${epoch}`;
    }
}
