// operators/trajectory/TrajectoryBuffer.js

/**
 * TrajectoryBuffer
 *
 * Purpose:
 * Maintain a rolling, indexed record of H1/M1 state transitions over time,
 * forming the observed state-space trajectory of a stream.
 *
 * This is NOT an operator in the pipeline sense — it does not transform artifacts.
 * It is a structural memory substrate component: a causal time-ordered index of
 * state visits with enough geometric metadata to track proximity to structural
 * memory neighborhoods (proto-basins) and observe band-profile velocity over time.
 *
 * Contract:
 * - append-only for temporal/state identity fields: push() creates new frames and
 *   frame ordering is never rewritten
 * - derived neighborhood annotations (basin_id, distance_to_basin_centroid) may be
 *   back-filled later by MemorySubstrate after rebuildBasins()
 * - deterministic frame identity given identical state and push order
 * - never mutates referenced H1/M1 artifacts
 * - evicts oldest frames when capacity exceeded (circular buffer semantics)
 * - all reads return immutable snapshots
 *
 * Trajectory Frame structure:
 *   t_start          — signal time of the state window start
 *   t_end            — signal time of the state window end
 *   state_id         — reference to H1 or M1 artifact (canonical address)
 *   artifact_class   — "H1" | "M1"
 *   stream_id        — lineage key (conserved from ingest)
 *   segment_id       — novelty-segmented era identifier
 *   basin_id         — assigned structural neighborhood ID (null at first commit; may be back-filled after basin rebuild)
 *   distance_to_basin_centroid — L1 band-profile distance to basin centroid (null at first commit or if no basin; may be back-filled after basin rebuild)
 *   band_profile_snapshot      — normalized band energy vector at this frame
 *   energy_raw                 — raw spectral energy scalar
 *   confidence                 — overall confidence from source artifact
 *   novelty_gate_triggered     — whether AnomalyOp flagged this transition
 *
 * Dynamics and observational methods:
 *   velocityEstimate(n)              — band-profile L1 velocity over last n frames
 *   isConverging(n)                  — linear regression on distance_to_basin_centroid
 *   currentBasinDwellCount()         — consecutive frames in current neighborhood
 *   currentDwellDurationSec()        — signal-time dwell in current neighborhood
 *   neighborhoodTransitionSummary()  — detected non-null→different-non-null transitions
 *   dwellSummary()                   — per-neighborhood run counts and durations
 *   recurrenceSummary()              — re-entry counts per neighborhood
 * All dynamics methods are observational only — no prediction, no canon.
 *
 * Non-responsibilities:
 * - does NOT transform, compress, or produce pipeline artifacts
 * - does NOT promote canon or assert truth
 * - does NOT predict future trajectory states
 * - neighborhood transition/dwell/recurrence are structural observations;
 *   they do NOT prove dynamical basin membership
 *
 * Layer: Substrate Space
 * Authority class: Derived (observational substrate component, not pipeline operator)
 *
 * Artifact IO:
 *   Input:  H1 or M1 (via push())
 *   Output: TrajectoryFrame[] (read-side; all reads return immutable copies)
 *
 * References:
 * - README_WorkflowContract.md
 * - README_SubstrateLayer.md §2
 * - README_MasterConstitution.md §3 (substrate layer)
 */

/**
 * @typedef {Object} TrajectoryFrame
 * @property {number} t_start
 * @property {number} t_end
 * @property {string} state_id
 * @property {"H1"|"M1"} artifact_class
 * @property {string} stream_id
 * @property {string} segment_id
 * @property {string|null} basin_id
 * @property {number|null} distance_to_basin_centroid
 * @property {number[]} band_profile_snapshot
 * @property {number} energy_raw
 * @property {number} confidence
 * @property {boolean} novelty_gate_triggered
 * @property {number} frame_index
 */

/**
 * @typedef {Object} TrajectoryVelocity
 * @property {number} mean_l1_delta   — mean band-profile L1 change per frame
 * @property {number} max_l1_delta
 * @property {number} frames_used
 * @property {boolean} sufficient_data
 */

/**
 * @typedef {Object} ConvergenceReport
 * @property {boolean} is_converging
 * @property {number|null} trend_slope   — negative = converging toward basin
 * @property {number} frames_used
 * @property {boolean} sufficient_data
 */

export class TrajectoryBuffer {
    /**
     * @param {Object} cfg
     * @param {number} [cfg.max_frames=1024]   — circular capacity
     * @param {string} [cfg.buffer_id]
     */
    constructor(cfg = {}) {
        this.max_frames = cfg.max_frames ?? 1024;
        this.buffer_id = cfg.buffer_id ?? "trajectory_buffer";

        /** @type {TrajectoryFrame[]} */
        this._frames = [];
        this._total_appended = 0;
        this._write_head = 0;           // next write position (circular)
    }

    // ─── Write ────────────────────────────────────────────────────────────────

    /**
     * Append a new frame derived from an H1 or M1 artifact.
     * Band profile and energy are extracted from the artifact's invariants.
     *
     * @param {Object} args
     * @param {Object} args.state          — H1 or M1 artifact
     * @param {string|null} [args.basin_id]
     * @param {number|null} [args.distance_to_basin_centroid]
     * @param {boolean} [args.novelty_gate_triggered=false]
     * @returns {{ ok: true, frame: TrajectoryFrame } | { ok: false, error: string, reasons: string[] }}
     */
    push({ state, basin_id = null, distance_to_basin_centroid = null, novelty_gate_triggered = false }) {
        const reasons = [];

        if (!state || (state.artifact_class !== "H1" && state.artifact_class !== "M1")) {
            reasons.push("state must be a valid H1 or M1 artifact");
        }
        if (!state?.state_id || typeof state.state_id !== "string") {
            reasons.push("state.state_id must be a non-empty string");
        }
        if (!state?.stream_id || typeof state.stream_id !== "string") {
            reasons.push("state.stream_id must be a non-empty string");
        }
        if (!state?.segment_id || typeof state.segment_id !== "string") {
            reasons.push("state.segment_id must be a non-empty string");
        }
        if (!Number.isFinite(state?.window_span?.t_start) || !Number.isFinite(state?.window_span?.t_end)) {
            reasons.push("state.window_span must have finite t_start and t_end");
        }

        if (reasons.length > 0) {
            return { ok: false, error: "INVALID_STATE", reasons };
        }

        const band_profile_snapshot = [...(state.invariants?.band_profile_norm?.band_energy ?? [])];
        const energy_raw = state.invariants?.energy_raw ?? 0;
        // confidence.overall is the min of per-invariant confidences (SystemLegitimacy §5)
        const confidence = state.confidence?.overall ?? 0;

        /** @type {TrajectoryFrame} */
        const frame = {
            t_start: state.window_span.t_start,
            t_end: state.window_span.t_end,
            state_id: state.state_id,
            artifact_class: state.artifact_class,
            stream_id: state.stream_id,
            segment_id: state.segment_id,
            basin_id,
            distance_to_basin_centroid,
            band_profile_snapshot,
            energy_raw,
            confidence,
            novelty_gate_triggered: Boolean(novelty_gate_triggered),
            frame_index: this._total_appended,
        };

        if (this._frames.length < this.max_frames) {
            this._frames.push(frame);
        } else {
            // Circular overwrite — evict oldest
            this._frames[this._write_head] = frame;
        }

        this._write_head = (this._write_head + 1) % this.max_frames;
        this._total_appended += 1;

        return { ok: true, frame };
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

    /**
     * Return all frames in chronological order (oldest first).
     * Returns immutable copies (Substrate Read class). Not pipeline artifacts.
     * @returns {TrajectoryFrame[]}
     */
    all() {
        return chronologicalOrder(this._frames, this._write_head, this._total_appended, this.max_frames);
    }

    /**
     * Return frames within [t_start, t_end] inclusive, chronological order.
     * @param {number} t_start
     * @param {number} t_end
     * @returns {TrajectoryFrame[]}
     */
    slice(t_start, t_end) {
        return this.all().filter(f => f.t_start >= t_start && f.t_end <= t_end);
    }

    /**
     * Return the N most recent frames, newest first.
     * @param {number} n
     * @returns {TrajectoryFrame[]}
     */
    tail(n) {
        const ordered = this.all();
        return ordered.slice(Math.max(0, ordered.length - n)).reverse();
    }

    /**
     * Return frames belonging to a specific segment_id.
     * @param {string} segment_id
     * @returns {TrajectoryFrame[]}
     */
    bySegment(segment_id) {
        return this.all().filter(f => f.segment_id === segment_id);
    }

    /**
     * Return frames assigned to a specific basin.
     * @param {string} basin_id
     * @returns {TrajectoryFrame[]}
     */
    byBasin(basin_id) {
        return this.all().filter(f => f.basin_id === basin_id);
    }

    // ─── Dynamics ─────────────────────────────────────────────────────────────

    /**
     * Estimate state-space velocity: mean and max band-profile L1 change
     * over the last `window_n` frames.
     *
     * A low velocity indicates the system is dwelling in a stable
     * band-profile neighborhood. A high velocity indicates transition
     * or perturbation. This is a structural observation, not a formal
     * dynamical convergence proof.
     *
     * @param {number} [window_n=8]
     * @returns {TrajectoryVelocity}
     */
    velocityEstimate(window_n = 8) {
        const recent = this.tail(window_n + 1).reverse(); // chronological
        if (recent.length < 2) {
            return { mean_l1_delta: 0, max_l1_delta: 0, frames_used: recent.length, sufficient_data: false };
        }

        const deltas = [];
        for (let i = 1; i < recent.length; i++) {
            const d = l1(recent[i].band_profile_snapshot, recent[i - 1].band_profile_snapshot);
            deltas.push(d);
        }

        const mean_l1_delta = mean(deltas);
        const max_l1_delta = Math.max(...deltas);

        return {
            mean_l1_delta,
            max_l1_delta,
            frames_used: recent.length,
            sufficient_data: true,
        };
    }

    /**
     * Assess whether the trajectory is converging toward a structural
     * neighborhood centroid (proto-basin approach indicator).
     *
     * Uses linear regression on distance_to_basin_centroid over the last
     * `window_n` frames. A negative slope indicates approach.
     * This is a geometric trend estimate, not a formal dynamical
     * basin-convergence proof.
     *
     * Frames without basin assignment are excluded. If fewer than 2 frames
     * have basin distances, sufficient_data = false.
     *
     * @param {number} [window_n=8]
     * @returns {ConvergenceReport}
     */
    isConverging(window_n = 8) {
        const recent = this.tail(window_n).reverse()
            .filter(f => f.distance_to_basin_centroid !== null);

        if (recent.length < 2) {
            return { is_converging: false, trend_slope: null, frames_used: recent.length, sufficient_data: false };
        }

        const xs = recent.map((_, i) => i);
        const ys = recent.map(f => f.distance_to_basin_centroid);
        const { slope } = linearRegression(xs, ys);

        return {
            is_converging: slope < 0,
            trend_slope: slope,
            frames_used: recent.length,
            sufficient_data: true,
        };
    }

    /**
     * Count how many consecutive recent frames belong to the same basin.
     * Returns 0 if the most recent frame has no basin assignment.
     * @returns {number}
     */
    currentBasinDwellCount() {
        const ordered = this.all();
        if (ordered.length === 0) return 0;

        const last = ordered[ordered.length - 1];
        if (last.basin_id === null) return 0;

        let count = 0;
        for (let i = ordered.length - 1; i >= 0; i--) {
            if (ordered[i].basin_id === last.basin_id) {
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    // ─── Metrics ──────────────────────────────────────────────────────────────

    /**
     * Summary statistics over all frames in the buffer.
     * @returns {Object}
     */
    summary() {
        const all = this.all();
        if (all.length === 0) {
            return {
                frame_count: 0,
                total_appended: this._total_appended,
                evicted: Math.max(0, this._total_appended - this.max_frames),
                t_span: null,
                segment_count: 0,
                basin_count: 0,
                novelty_event_count: 0,
                mean_confidence: null,
                mean_energy_raw: null,
            };
        }

        const segments = new Set(all.map(f => f.segment_id));
        const basins = new Set(all.filter(f => f.basin_id).map(f => f.basin_id));
        const noveltyCount = all.filter(f => f.novelty_gate_triggered).length;
        const meanConf = mean(all.map(f => f.confidence));
        const meanEnergy = mean(all.map(f => f.energy_raw));

        return {
            frame_count: all.length,
            total_appended: this._total_appended,
            evicted: Math.max(0, this._total_appended - this.max_frames),
            t_span: { t_start: all[0].t_start, t_end: all[all.length - 1].t_end },
            segment_count: segments.size,
            basin_count: basins.size,
            novelty_event_count: noveltyCount,
            mean_confidence: meanConf,
            mean_energy_raw: meanEnergy,
        };
    }

    /**
     * Unique segment IDs seen in the buffer, in order of first appearance.
     * @returns {string[]}
     */
    segmentIds() {
        const seen = new Set();
        const out = [];
        for (const f of this.all()) {
            if (!seen.has(f.segment_id)) {
                seen.add(f.segment_id);
                out.push(f.segment_id);
            }
        }
        return out;
    }

    // ─── Observational instrumentation ────────────────────────────────────────
    // All methods below are derived read-side reports over committed trajectory
    // frames. They describe structural neighborhood dwell, transitions, and
    // recurrence as observational substrate evidence only.
    //
    // Semantic contract:
    //   - "transition" = consecutive non-null frames with DIFFERENT basin_ids
    //   - null→BN and BN→null are NOT counted as transitions
    //     (entering/leaving unknown territory is not a structural change)
    //   - "dwell" = consecutive frames with the SAME non-null basin_id
    //   - "re-entry" = returning to a neighborhood after leaving it
    //   - All reports are deterministic given identical frame sequences
    //   - None of these methods imply canon, prediction, or true basinhood

    /**
     * Duration (in signal seconds) of the current unbroken dwell in the most
     * recent neighborhood. Returns 0 if the last frame has no basin assignment.
     *
     * Uses frame t_start/t_end to accumulate signal time, not frame count.
     * Mirrors currentBasinDwellCount() but measures time rather than frames.
     *
     * @returns {number}
     */
    currentDwellDurationSec() {
        const ordered = this.all();
        if (ordered.length === 0) return 0;

        const last = ordered[ordered.length - 1];
        if (last.basin_id === null) return 0;

        let duration = 0;
        for (let i = ordered.length - 1; i >= 0; i--) {
            if (ordered[i].basin_id === last.basin_id) {
                duration += (ordered[i].t_end - ordered[i].t_start);
            } else {
                break;
            }
        }
        return duration;
    }

    /**
     * Summarize neighborhood transitions observed in the buffer.
     *
     * A transition is recorded when consecutive non-null frames have different
     * basin_ids. Null-to-non-null and non-null-to-null are NOT transitions.
     *
     * @param {Object} [opts]
     * @param {string} [opts.segment_id]  — restrict to frames in this segment only
     * @returns {{
     *   total_transitions: number,
     *   transition_counts: Object,   // "BN_a->BN_b": count
     *   transitions: Array<{from: string, to: string, t_transition: number, segment_id: string}>,
     *   segment_id: string|null,
     * }}
     */
    neighborhoodTransitionSummary(opts = {}) {
        let frames = this.all();
        if (opts.segment_id) {
            frames = frames.filter(f => f.segment_id === opts.segment_id);
        }

        const transitions = [];
        const transition_counts = {};

        for (let i = 1; i < frames.length; i++) {
            const prev = frames[i - 1];
            const curr = frames[i];
            // Only record non-null → different-non-null
            if (prev.basin_id !== null && curr.basin_id !== null &&
                prev.basin_id !== curr.basin_id) {
                const key = `${prev.basin_id}->${curr.basin_id}`;
                transition_counts[key] = (transition_counts[key] ?? 0) + 1;
                transitions.push({
                    from: prev.basin_id,
                    to: curr.basin_id,
                    t_transition: curr.t_start,
                    segment_id: curr.segment_id,
                });
            }
        }

        return {
            total_transitions: transitions.length,
            transition_counts,
            transitions,
            segment_id: opts.segment_id ?? null,
        };
    }

    /**
     * Summarize dwell statistics per neighborhood (basin_id).
     *
     * Computes contiguous dwell runs — consecutive frames with the same
     * non-null basin_id. Each run contributes one dwell entry.
     *
     * @param {Object} [opts]
     * @param {string} [opts.segment_id]  — restrict to frames in this segment only
     * @returns {{
     *   by_neighborhood: Object,   // basin_id → { runs, total_frames, total_duration_sec, mean_duration_sec }
     *   segment_id: string|null,
     * }}
     */
    dwellSummary(opts = {}) {
        let frames = this.all();
        if (opts.segment_id) {
            frames = frames.filter(f => f.segment_id === opts.segment_id);
        }

        const by_neighborhood = {};

        let runStart = 0;
        while (runStart < frames.length) {
            const bid = frames[runStart].basin_id;
            if (bid === null) { runStart++; continue; }

            // Find extent of this contiguous run
            let runEnd = runStart;
            while (runEnd + 1 < frames.length && frames[runEnd + 1].basin_id === bid) {
                runEnd++;
            }

            const runFrames = runEnd - runStart + 1;
            const runDuration = frames[runEnd].t_end - frames[runStart].t_start;

            if (!by_neighborhood[bid]) {
                by_neighborhood[bid] = { runs: 0, total_frames: 0, total_duration_sec: 0 };
            }
            by_neighborhood[bid].runs += 1;
            by_neighborhood[bid].total_frames += runFrames;
            by_neighborhood[bid].total_duration_sec += runDuration;

            runStart = runEnd + 1;
        }

        // Derive mean_duration_sec per neighborhood
        for (const bid of Object.keys(by_neighborhood)) {
            const entry = by_neighborhood[bid];
            entry.mean_duration_sec = entry.runs === 0
                ? 0
                : entry.total_duration_sec / entry.runs;
        }

        return { by_neighborhood, segment_id: opts.segment_id ?? null };
    }

    /**
     * Summarize neighborhood re-entry (recurrence) counts.
     *
     * A re-entry occurs when the trajectory returns to a neighborhood after
     * having left it (i.e., the same basin_id appears in more than one
     * discontiguous dwell run).
     *
     *   - re_entry_count for a neighborhood = (number of dwell runs) - 1
     *   - A neighborhood visited exactly once has re_entry_count = 0
     *   - A neighborhood never visited does not appear in the output
     *
     * @param {Object} [opts]
     * @param {string} [opts.segment_id]  — restrict to frames in this segment only
     * @returns {{
     *   by_neighborhood: Object,   // basin_id → { dwell_runs, re_entry_count }
     *   total_re_entries: number,
     *   segment_id: string|null,
     * }}
     */
    recurrenceSummary(opts = {}) {
        const dwell = this.dwellSummary(opts);
        const by_neighborhood = {};
        let total_re_entries = 0;

        for (const [bid, entry] of Object.entries(dwell.by_neighborhood)) {
            const re_entry_count = Math.max(0, entry.runs - 1);
            by_neighborhood[bid] = {
                dwell_runs: entry.runs,
                re_entry_count,
            };
            total_re_entries += re_entry_count;
        }

        return {
            by_neighborhood,
            total_re_entries,
            segment_id: opts.segment_id ?? null,
        };
    }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Reconstruct chronological order from a potentially wrapped circular buffer.
 * When the buffer is not full, the write head equals the frame count and
 * all frames are already in order.
 */
function chronologicalOrder(frames, writeHead, totalAppended, maxFrames) {
    if (frames.length < maxFrames || totalAppended <= maxFrames) {
        // Buffer not yet wrapped — frames are in order
        return frames.map(copyFrame);
    }
    // Buffer has wrapped: writeHead points to oldest entry
    const tail = frames.slice(writeHead);
    const head = frames.slice(0, writeHead);
    return [...tail, ...head].map(copyFrame);
}

/**
 * Return a safe copy of a trajectory frame for read-path consumers.
 * Frames are plain objects mutated in-place by _backfillBasinAssignments;
 * returning live references would expose internal state through read APIs.
 * @param {TrajectoryFrame} frame
 * @returns {TrajectoryFrame}
 */
function copyFrame(frame) {
    return {
        ...frame,
        band_profile_snapshot: frame.band_profile_snapshot
            ? [...frame.band_profile_snapshot]
            : frame.band_profile_snapshot,
    };
}

/** @param {number[]} a @param {number[]} b */
function l1(a, b) {
    const n = Math.max(a.length, b.length);
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    return s;
}

/** @param {number[]} xs */
function mean(xs) {
    if (!xs.length) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Simple OLS slope + intercept */
function linearRegression(xs, ys) {
    const n = xs.length;
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
        const dx = xs[i] - mx;
        num += dx * (ys[i] - my);
        den += dx * dx;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = my - slope * mx;
    return { slope, intercept };
}
