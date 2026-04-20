// operators/substrate/MemorySubstrate.js

/**
 * MemorySubstrate
 *
 * Holds all H1/M1 artifacts produced by the pipeline, maintains a basin
 * index updated by BasinOp, and drives TrajectoryBuffer frame commits.
 *
 * This is the "structural memory substrate" described in the architecture:
 * it is the persistent topology that links state-space trajectory frames
 * to structural memory neighborhoods (proto-basin groupings) across time.
 *
 * Contract:
 * - append-only: committed H1/M1 artifacts are never modified after commit
 * - legitimacy-gated commit: rejects states missing clock_policy_id,
 *   provenance.input_refs, complete grid, energy_raw, uncertainty.time,
 *   non-empty kept_bins, finite confidence.overall, or band_energy
 * - basin index rebuilt on demand via rebuildBasins(); not automatic on commit
 * - trajectory updated on every successful commit; basin annotations may be refined later by rebuildBasins()
 * - all data reads return immutable copies (copyState/copyBasin/copyFrame);
 *   the trajectory getter returns the live TrajectoryBuffer handle (documented
 *   exception for dynamics method access)
 * - reports/query surfaces are plain-data observational read models, not authoritative pipeline artifacts;
 *   they are read-only and do not mutate substrate state
 * - this class has no canonical authority; it does not mint pipeline artifacts
 * - this class stores and indexes already-produced H1/M1 artifacts only
 *
 * Non-responsibilities:
 * - does NOT promote canon
 * - does NOT fabricate truth labels
 * - does NOT modify committed artifacts through any read API
 * - basin/trajectory organization is structural, not authoritative
 *
 * Layer: Substrate Space
 * Runtime role: aggregate substrate store/coordinator
 *
 * Artifact IO:
 *   Commits: H1 HarmonicState, M1 MergedState
 *   Reads:   H1[], M1[], BasinState[], TrajectoryFrame[], Q QueryResult
 *
 * References:
 * - README_WorkflowContract.md
 * - README_SubstrateLayer.md §4
 * - README_MasterConstitution.md §3 (substrate layer)
 *
 * Lifecycle:
 *   commit(h1_or_m1)              → appends state, pushes trajectory frame
 *   rebuildBasins(policy)         → runs BasinOp over all states in a segment
 *   nearestBasin(state, seg?)     → nearest-basin lookup for a single new state
 *   queryStates(spec, policy, opts) → read-side QueryOp over committed corpus
 *   getTrajectory(t0, t1)         → slice of trajectory frames
 *
 * References:
 * - README_MasterConstitution.md §7 (artifact authority graph)
 * - README_SubstrateLayer.md (legitimacy prerequisites)
 * - OPERATOR_CONTRACTS.md
 */

import { TrajectoryBuffer } from "../trajectory/TrajectoryBuffer.js";
import { BasinOp } from "../basin/BasinOp.js";
import { QueryOp } from "../query/QueryOp.js";

export class MemorySubstrate {
    /**
     * @param {Object} cfg
     * @param {string} [cfg.substrate_id="memory_substrate"]
     * @param {number} [cfg.trajectory_max_frames=2048]
     */
    constructor(cfg = {}) {
        this.substrate_id = cfg.substrate_id ?? "memory_substrate";

        /** @type {Map<string, Object>} state_id → H1 or M1 artifact */
        this._states = new Map();
        this._memoryObjects = new Map();
        this._memoryObjectIdsByStateId = new Map();

        /** @type {Map<string, import("../basin/BasinOp.js").BasinState>} basin_id → BasinState */
        this._basins = new Map();

        /**
         * segment_id → basin_id[] (ordered by span.t_start)
         * Allows fast lookup of which basins exist in a segment.
         * @type {Map<string, string[]>}
         */
        this._basinsBySegment = new Map();

        /** @type {TrajectoryBuffer} */
        this._trajectory = new TrajectoryBuffer({ max_frames: cfg.trajectory_max_frames ?? 2048 });

        /** @type {BasinOp} */
        this._basinOp = new BasinOp();

        /** @type {QueryOp} */
        this._queryOp = new QueryOp();

        /** Monotonically increasing commit counter */
        this._commit_count = 0;
    }

    // ─── Write path ───────────────────────────────────────────────────────────

    /**
     * Commit an H1 or M1 artifact to the substrate.
     *
     * Steps:
     * 1. Validate the artifact meets minimum legitimacy requirements
     * 2. Check for duplicate state_id (idempotent if same artifact)
     * 3. Store immutable copy
     * 4. Attempt basin assignment from existing basins (nearest-neighbor)
     * 5. Append trajectory frame
     *
     * @param {Object} state   — H1 or M1 artifact
     * @param {Object} [opts]
     * @param {boolean} [opts.novelty_gate_triggered=false]
     * @returns {{ ok: true, state_id: string, basin_assignment: Object|null }
     *          | { ok: false, error: string, reasons: string[] }}
     */
    commit(state, opts = {}) {
        const reasons = [];

        // ── Legitimacy check (mirrors SystemLegitimacy §1) ──
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
        if (!state?.invariants?.band_profile_norm?.band_energy) {
            reasons.push("state.invariants.band_profile_norm.band_energy required for basin indexing");
        }
        if (!state?.policies?.compression_policy_id && !state?.policies?.merge_policy_id) {
            reasons.push("state.policies must contain compression_policy_id or merge_policy_id (legitimacy anchor)");
        }
        if (!state?.policies?.clock_policy_id || typeof state.policies.clock_policy_id !== "string") {
            reasons.push("state.policies.clock_policy_id is required (traceable to ingest)");
        }
        if (!Array.isArray(state?.provenance?.input_refs) || state.provenance.input_refs.length === 0) {
            reasons.push("state.provenance.input_refs must be a non-empty array (lineage must not be broken)");
        }
        if (!Number.isFinite(state?.grid?.Fs_target) ||
            !Number.isFinite(state?.grid?.N) ||
            !Number.isFinite(state?.grid?.df)) {
            reasons.push("state.grid must have finite Fs_target, N, and df (coordinate frame required)");
        }
        if (!Number.isFinite(state?.invariants?.energy_raw)) {
            reasons.push("state.invariants.energy_raw must be finite");
        }
        if (!state?.uncertainty?.time || typeof state.uncertainty.time !== "object") {
            reasons.push("state.uncertainty.time must be present as an object");
        }
        if (!Array.isArray(state?.kept_bins) || state.kept_bins.length === 0) {
            reasons.push("state.kept_bins must be a non-empty array (state must be replayable)");
        }
        if (!Number.isFinite(state?.confidence?.overall)) {
            reasons.push("state.confidence.overall must be a finite number");
        }

        if (reasons.length > 0) {
            return { ok: false, error: "LEGITIMACY_FAILURE", reasons };
        }

        // ── Idempotency: same state_id already committed ──
        if (this._states.has(state.state_id)) {
            const memoryObjectId = this._memoryObjectIdsByStateId.get(state.state_id) ?? null;
            return {
                ok: true,
                state_id: state.state_id,
                memory_object_id: memoryObjectId,
                basin_assignment: null,
                duplicate: true,
            };
        }

        // ── Store immutable copy ──
        const storedState = Object.freeze(deepCopy(state));
        const memoryObject = Object.freeze(this._buildMemoryObject(storedState));
        this._states.set(state.state_id, storedState);
        this._memoryObjects.set(memoryObject.memory_object_id, memoryObject);
        this._memoryObjectIdsByStateId.set(state.state_id, memoryObject.memory_object_id);
        this._commit_count += 1;

        // ── Basin assignment (nearest neighbor from existing basins) ──
        const segmentBasinIds = this._basinsBySegment.get(state.segment_id) ?? [];
        const segmentBasins = segmentBasinIds
            .map(id => this._basins.get(id))
            .filter(Boolean);

        let basinAssignment = null;
        // Use a permissive threshold for assignment — tighter than formation threshold
        // is handled by BasinPolicy; here we use whatever the current centroid distance gives.
        if (segmentBasins.length > 0) {
            // Find nearest basin without threshold (let caller decide)
            let best = null;
            let bestDist = Infinity;
            for (const basin of segmentBasins) {
                const d = l1(
                    state.invariants.band_profile_norm.band_energy,
                    basin.centroid_band_profile
                );
                if (d < bestDist) {
                    bestDist = d;
                    best = basin;
                }
            }
            if (best !== null) {
                basinAssignment = { basin_id: best.basin_id, distance: bestDist };
            }
        }

        // ── Trajectory frame ──
        this._trajectory.push({
            state: storedState,
            memory_object_id: memoryObject.memory_object_id,
            basin_id: basinAssignment?.basin_id ?? null,
            distance_to_basin_centroid: basinAssignment?.distance ?? null,
            novelty_gate_triggered: opts.novelty_gate_triggered ?? false,
        });

        return {
            ok: true,
            state_id: state.state_id,
            memory_object_id: memoryObject.memory_object_id,
            basin_assignment: basinAssignment,
            duplicate: false,
        };
    }

    /**
     * Rebuild the basin index for a given segment by running BasinOp over
     * all committed states in that segment.
     *
     * Call this after a batch of commits to the same segment, or after
     * loading archived states. Not called automatically on every commit
     * to avoid O(n²) clustering at write time.
     *
     * @param {Object} args
     * @param {string} args.segment_id
     * @param {import("../basin/BasinOp.js").BasinPolicy} args.basin_policy
     * @returns {import("../basin/BasinOp.js").BasinOutcome}
     */
    rebuildBasins({ segment_id, basin_policy }) {
        const segmentStates = this.statesForSegment(segment_id);

        if (segmentStates.length === 0) {
            return {
                ok: false,
                error: "NO_STATES",
                reasons: [`no committed states found for segment_id=${segment_id}`],
            };
        }

        const result = this._basinOp.run({ states: segmentStates, basin_policy });
        if (!result.ok) return result;

        // Replace all basins for this segment
        // First, remove stale basin entries for this segment
        const staleIds = this._basinsBySegment.get(segment_id) ?? [];
        for (const id of staleIds) this._basins.delete(id);

        // Insert new basins
        const newIds = [];
        for (const basin of result.artifact.basins) {
            this._basins.set(basin.basin_id, Object.freeze(basin));
            newIds.push(basin.basin_id);
        }
        this._basinsBySegment.set(segment_id, newIds);

        // Back-fill trajectory frames for this segment with updated basin assignments
        this._backfillBasinAssignments(segment_id, result.artifact.basins, basin_policy.similarity_threshold);

        return result;
    }

    // ─── Read path ────────────────────────────────────────────────────────────

    /**
     * Retrieve a stored artifact by state_id.
     * Returns null if not found.
     * @param {string} state_id
     * @returns {Object|null}
     */
    get(state_id) {
        const s = this._states.get(state_id);
        return s ? copyState(s) : null;
    }

    /**
     * Retrieve a stored MemoryObject by memory_object_id or payload state_id.
     * Returns null if not found.
     * @param {string} ref
     * @returns {Object|null}
     */
    getMemoryObject(ref) {
        const memoryObjectId = this._resolveMemoryObjectId(ref);
        if (!memoryObjectId) return null;
        const memoryObject = this._memoryObjects.get(memoryObjectId);
        return memoryObject ? copyMemoryObject(memoryObject) : null;
    }

    /**
     * All committed states in chronological order (t_start ascending).
     * @returns {Object[]}
     */
    allStates() {
        return [...this._states.values()]
            .sort((a, b) => (a.window_span?.t_start ?? 0) - (b.window_span?.t_start ?? 0))
            .map(copyState);
    }

    /**
     * All committed MemoryObjects in chronological order (t_start ascending).
     * @returns {Object[]}
     */
    allMemoryObjects() {
        return [...this._memoryObjects.values()]
            .sort((a, b) =>
                (a.admission_extent?.t_start ?? 0) - (b.admission_extent?.t_start ?? 0)
            )
            .map(copyMemoryObject);
    }

    /**
     * All committed states for a given segment_id, chronological.
     * @param {string} segment_id
     * @returns {Object[]}
     */
    statesForSegment(segment_id) {
        return this.allStates().filter(s => s.segment_id === segment_id);
    }

    /**
     * All committed MemoryObjects for a given segment_id, chronological.
     * @param {string} segment_id
     * @returns {Object[]}
     */
    memoryObjectsForSegment(segment_id) {
        return this.allMemoryObjects().filter(
            (memoryObject) => memoryObject.admission_extent?.segment_id === segment_id
        );
    }

    /**
     * All committed states within a time range [t_start, t_end], chronological.
     * @param {number} t_start
     * @param {number} t_end
     * @returns {Object[]}
     */
    statesInRange(t_start, t_end) {
        return this.allStates().filter(
            s => s.window_span?.t_start >= t_start && s.window_span?.t_end <= t_end
        );
    }

    /**
     * All basins for a segment.
     * @param {string} segment_id
     * @returns {import("../basin/BasinOp.js").BasinState[]}
     */
    basinsForSegment(segment_id) {
        const ids = this._basinsBySegment.get(segment_id) ?? [];
        return ids.map(id => this._basins.get(id)).filter(Boolean).map(copyBasin);
    }

    /**
     * Nearest basin to a query state. Returns null if no basins exist.
     * @param {Object} state    — H1 or M1
     * @param {string} [segment_id]  — restrict to segment; defaults to state.segment_id
     * @returns {{ basin: import("../basin/BasinOp.js").BasinState, distance: number }|null}
     */
    nearestBasin(state, segment_id) {
        const segId = segment_id ?? state.segment_id;
        const basins = this.basinsForSegment(segId);
        if (basins.length === 0) return null;

        const profile = state.invariants?.band_profile_norm?.band_energy ?? [];
        let best = null;
        let bestDist = Infinity;
        for (const basin of basins) {
            const d = l1(profile, basin.centroid_band_profile);
            if (d < bestDist) {
                bestDist = d;
                best = basin;
            }
        }
        return best ? { basin: copyBasin(best), distance: bestDist } : null;
    }

    /**
     * Trajectory slice over signal time.
     * @param {number} t_start
     * @param {number} t_end
     * @returns {import("../trajectory/TrajectoryBuffer.js").TrajectoryFrame[]}
     */
    getTrajectory(t_start, t_end) {
        return this._trajectory.slice(t_start, t_end);
    }

    /**
     * Full trajectory buffer (read-only reference to buffer instance).
     * Caller should not mutate.
     * @returns {TrajectoryBuffer}
     */
    get trajectory() {
        return this._trajectory;
    }

    // ─── Perception / query ─────────────────────────────────────────────────────

    /**
     * Read-side perception query over committed H1 / M1 corpus.
     *
     * Builds a snapshot corpus from committed states (via allStates(),
     * which returns safe copies), optionally filtered by segment_id,
     * stream_id, or artifact_class, then delegates to QueryOp.
     *
     * Boundary contract:
     *   - read-only: does not mutate committed states, basins, or trajectory
     *   - no canon promotion, no truth fabrication
     *   - corpus is built from safe copies (allStates()), so QueryOp cannot
     *     corrupt internal substrate state through the corpus handle
     *   - returns a QueryResult (Q artifact) or an error object
     *
     * @param {Object} query_spec   — QuerySpec (query_id, kind, mode, scope, query)
     * @param {Object} query_policy — QueryPolicy (policy_id, scoring, normalization, topK)
     * @param {Object} [opts]
     * @param {string} [opts.segment_id]     — restrict corpus to this segment
     * @param {string} [opts.stream_id]      — restrict corpus to this stream
     * @param {"H1"|"M1"|null} [opts.artifact_class] — restrict corpus to H1 or M1 only
     * @returns {import("../../QueryOp.js").QueryOutcome}
     */
    queryStates(query_spec, query_policy, opts = {}) {
        // Build corpus from safe copies — allStates() returns copyState() per element
        let corpus = this.allStates();

        // Apply optional corpus filters before handing to QueryOp
        if (opts.segment_id) {
            corpus = corpus.filter(s => s.segment_id === opts.segment_id);
        }
        if (opts.stream_id) {
            corpus = corpus.filter(s => s.stream_id === opts.stream_id);
        }
        if (opts.artifact_class) {
            corpus = corpus.filter(s => s.artifact_class === opts.artifact_class);
        }

        if (corpus.length === 0) {
            return {
                ok: false,
                error: "EMPTY_CORPUS",
                reasons: ["no committed states match the query opts filters"],
            };
        }

        return this._queryOp.run({ query_spec, query_policy, corpus });
    }

    // ─── Summary ──────────────────────────────────────────────────────────────

    // ─── Observational reporting ──────────────────────────────────────────────

    /**
     * Produce a deterministic Neighborhood Transition Report from the committed
     * trajectory's observational instrumentation.
     *
     * Boundary contract:
     *   - Derived / observational only. Not prediction, not canon, not truth.
     *   - Does not mutate committed states, basin index, or trajectory frames.
     *   - Null-neighborhood semantics match TrajectoryBuffer conventions:
     *       null→BN and BN→null are NOT transitions; null frames are transparent.
     *   - All arrays are sorted deterministically (lexicographic by basin_id / key).
     *   - generated_from field makes the data lineage explicit.
     *
     * @param {Object} [opts]
     * @param {string} [opts.segment_id]  — restrict to one segment
     * @param {string} [opts.stream_id]   — restrict to frames from one stream
     * @returns {Object} NeighborhoodTransitionReport (plain data, non-canonical)
     */
    neighborhoodTransitionReport(opts = {}) {
        const tb = this._trajectory;

        // Build filter opts for trajectory methods
        const tbOpts = {};
        if (opts.segment_id) tbOpts.segment_id = opts.segment_id;

        // Apply stream_id filter at frame level if requested
        // (trajectory buffer doesn't have a built-in stream filter)
        let frames = tb.all();
        if (opts.segment_id) frames = frames.filter(f => f.segment_id === opts.segment_id);
        if (opts.stream_id) frames = frames.filter(f => f.stream_id === opts.stream_id);

        const totalFrames = frames.length;

        // Collect all non-null neighborhood IDs seen
        const neighborhoodsSeen = [...new Set(
            frames.map(f => f.basin_id).filter(id => id !== null)
        )].sort();

        // Transition summary — re-derive from filtered frames to respect stream filter
        const transitionCountsMap = {};
        for (let i = 1; i < frames.length; i++) {
            const prev = frames[i - 1];
            const curr = frames[i];
            if (prev.basin_id !== null && curr.basin_id !== null &&
                prev.basin_id !== curr.basin_id) {
                const key = `${prev.basin_id}->${curr.basin_id}`;
                transitionCountsMap[key] = (transitionCountsMap[key] ?? 0) + 1;
            }
        }

        // Sorted transitions array (unique pairs, sorted by key)
        const transitions = Object.entries(transitionCountsMap)
            .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
            .map(([key, count]) => {
                const [from, to] = key.split('->');
                return { from, to, count };
            });

        const totalTransitions = transitions.reduce((s, t) => s + t.count, 0);

        // Dwell summary — re-derive from filtered frames
        const dwellByNeighborhood = {};
        let runStart = 0;
        while (runStart < frames.length) {
            const bid = frames[runStart].basin_id;
            if (bid === null) { runStart++; continue; }
            let runEnd = runStart;
            while (runEnd + 1 < frames.length && frames[runEnd + 1].basin_id === bid) {
                runEnd++;
            }
            const runFrames = runEnd - runStart + 1;
            const runDuration = frames[runEnd].t_end - frames[runStart].t_start;
            if (!dwellByNeighborhood[bid]) {
                dwellByNeighborhood[bid] = { runs: 0, total_frames: 0, total_duration_sec: 0 };
            }
            dwellByNeighborhood[bid].runs += 1;
            dwellByNeighborhood[bid].total_frames += runFrames;
            dwellByNeighborhood[bid].total_duration_sec += runDuration;
            runStart = runEnd + 1;
        }

        // Dwell array — sorted by basin_id lexicographically
        const dwell = Object.entries(dwellByNeighborhood)
            .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
            .map(([basin_id, entry]) => ({
                basin_id,
                dwell_runs: entry.runs,
                total_frames: entry.total_frames,
                total_duration_sec: entry.total_duration_sec,
                mean_duration_sec: entry.runs === 0 ? 0
                    : entry.total_duration_sec / entry.runs,
            }));

        // Recurrence array — sorted by basin_id
        const totalReEntries = dwell.reduce((s, d) => s + Math.max(0, d.dwell_runs - 1), 0);
        const recurrence = dwell
            .map(d => ({
                basin_id: d.basin_id,
                re_entry_count: Math.max(0, d.dwell_runs - 1),
            }))
            .sort((a, b) => a.basin_id < b.basin_id ? -1 : a.basin_id > b.basin_id ? 1 : 0);

        // Current dwell state (from the live buffer, always over full trajectory
        // unless segment-filtered — use unfiltered for current state if no filter)
        const currentNeighborhoodId = (() => {
            if (frames.length === 0) return null;
            return frames[frames.length - 1].basin_id ?? null;
        })();
        const currentDwellCount = (() => {
            if (currentNeighborhoodId === null) return 0;
            let count = 0;
            for (let i = frames.length - 1; i >= 0; i--) {
                if (frames[i].basin_id === currentNeighborhoodId) count++;
                else break;
            }
            return count;
        })();
        const currentDwellDurationSec = (() => {
            if (currentNeighborhoodId === null) return 0;
            let dur = 0;
            for (let i = frames.length - 1; i >= 0; i--) {
                if (frames[i].basin_id === currentNeighborhoodId)
                    dur += frames[i].t_end - frames[i].t_start;
                else break;
            }
            return dur;
        })();

        return {
            report_type: "substrate:observational_report",
            // Scope
            scope: {
                segment_id: opts.segment_id ?? null,
                stream_id: opts.stream_id ?? null,
            },
            // Aggregate counts
            total_frames_considered: totalFrames,
            total_neighborhoods_observed: neighborhoodsSeen.length,
            total_transitions: totalTransitions,
            total_re_entries: totalReEntries,
            // Current state
            current_neighborhood_id: currentNeighborhoodId,
            current_dwell_count: currentDwellCount,
            current_dwell_duration_sec: currentDwellDurationSec,
            // Detail tables (all sorted deterministically)
            neighborhoods_seen: neighborhoodsSeen,
            transition_counts: transitionCountsMap,
            transitions,
            dwell,
            recurrence,
            // Provenance note
            segment_boundary_behavior:
                "transitions within scope only; cross-segment adjacency " +
                "counted when no segment_id filter is applied",
            generated_from:
                "TrajectoryBuffer observational summaries — " +
                "structural neighborhood observations only, not prediction or canon",
        };
    }

    /**
     * Substrate-level summary.
     *
     * Authority class: Operational Summary (non-artifact).
     * Returns counts and spans over current substrate state.
     * Does not make structural claims; does not imply canon or prediction.
     * report_type field identifies this as a non-artifact output.
     *
     * @returns {Object}
     */
    summary() {
        const allStates = this.allStates();
        const segments = new Set(allStates.map(s => s.segment_id));
        const streamIds = new Set(allStates.map(s => s.stream_id));
        const trajSummary = this._trajectory.summary();

        return {
            report_type: "substrate:operational_summary",
            substrate_id: this.substrate_id,
            state_count: this._states.size,
            memory_object_count: this._memoryObjects.size,
            commit_count: this._commit_count,
            basin_count: this._basins.size,
            segment_count: segments.size,
            stream_count: streamIds.size,
            trajectory: trajSummary,
            t_span: allStates.length > 0 ? {
                t_start: allStates[0].window_span?.t_start,
                t_end: allStates[allStates.length - 1].window_span?.t_end,
            } : null,
        };
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /**
     * Build the admitted MemoryObject envelope for one lawful H1/M1 payload.
     * @private
     */
    _buildMemoryObject(state) {
        const payloadKind = state.artifact_class === "M1" ? "m1_support" : "h1_support";
        const mergedFrom = asArray(state?.merge_record?.inputs);
        const receiptMergedFrom = asArray(state?.receipts?.merge?.merged_from);
        const lineageInputs = [...new Set([...mergedFrom, ...receiptMergedFrom])];
        const structuralRefs = asArray(state?.provenance?.input_refs);
        const supportRefs = [
            {
                ref_type: "support_payload",
                artifact_class: state.artifact_class,
                state_id: state.state_id,
            },
        ];
        const comparisonBasisRefs = [
            {
                basis_type: "band_profile_norm",
                path: "invariants.band_profile_norm.band_energy",
            },
            {
                basis_type: "kept_bins",
                path: "kept_bins",
            },
        ];
        const memoryObject = {
            memory_object_type: "MemoryObject",
            memory_object_id: buildMemoryObjectId(state),
            source_family: "analog_signal",
            payload_kind: payloadKind,
            payload_ref: {
                ref_type: "support_state",
                artifact_class: state.artifact_class,
                state_id: state.state_id,
            },
            payload: state,
            admission_extent: {
                extent_type: "temporal_span",
                stream_id: state.stream_id,
                segment_id: state.segment_id,
                t_start: state.window_span?.t_start ?? null,
                t_end: state.window_span?.t_end ?? null,
                duration_sec: state.window_span?.duration_sec ?? null,
                window_count: state.window_span?.window_count ?? null,
            },
            provenance_edges: {
                source_refs: structuralRefs,
                operator_id: state?.provenance?.operator_id ?? null,
                operator_version: state?.provenance?.operator_version ?? null,
                payload_state_id: state.state_id,
            },
            policy_refs: {
                ...deepCopy(state.policies ?? {}),
            },
            continuity_constraints: {
                uncertainty_time: deepCopy(state?.uncertainty?.time ?? {}),
                bounded_identity_posture: "support continuity only",
                non_closure_constraint: "does not assert same-object closure",
                replay_limit: "bounded to preserved support payload",
                promotion_separation: "receipts and read-side projections remain subordinate",
            },
            relation_slots: {
                provenance: structuralRefs.map((ref) => ({
                    relation_type: "derived_from",
                    ref,
                })),
                temporal_adjacency: [],
                support_composition: supportRefs.map((ref) => ({
                    relation_type: "payload_support",
                    ref,
                })),
                merge_lineage: lineageInputs.map((ref) => ({
                    relation_type: "merge_input",
                    ref,
                })),
                neighborhood_membership: [],
                comparison_basis: comparisonBasisRefs.map((ref) => ({
                    relation_type: "comparison_basis",
                    ref,
                })),
                reconstruction_source: [
                    {
                        relation_type: "reconstructable_from_payload",
                        ref: state.state_id,
                    },
                ],
                retrieval_consult: [
                    {
                        relation_type: "payload_ref",
                        ref: state.state_id,
                    },
                ],
            },
            explicit_non_claims: [
                "not_descriptor",
                "not_receipt",
                "not_object_card",
                "not_semantic_wrapper",
                "not_same_object_closure",
                "not_semantic_identity",
                "not_canon",
                "not_truth_closure",
                "not_raw_restoration",
                "not_hidden_write_authority",
            ],
            structural_refs: structuralRefs,
            support_refs: supportRefs,
            comparison_basis_refs: comparisonBasisRefs,
            reconstruction_lenses: [
                {
                    lens_type: "kept_bin_support",
                    path: "kept_bins",
                },
                {
                    lens_type: "band_profile_support",
                    path: "invariants.band_profile_norm.band_energy",
                },
            ],
            family_contract_ref: "analog_signal.memory_object_admission.v1",
            admission_mode: state.artifact_class === "M1" ? "derived_merge" : "temporal_stream",
        };

        if (lineageInputs.length > 0) {
            memoryObject.lineage_refs = lineageInputs.map((ref) => ({
                lineage_type: "merge_input",
                ref,
            }));
        }

        return memoryObject;
    }

    _resolveMemoryObjectId(ref) {
        if (!ref || typeof ref !== "string") return null;
        if (this._memoryObjects.has(ref)) return ref;
        return this._memoryObjectIdsByStateId.get(ref) ?? null;
    }

    /**
     * After BasinOp rebuilds basins for a segment, update any existing
     * trajectory frames for that segment with corrected basin assignments.
     * @private
     */
    _backfillBasinAssignments(segment_id, basins, threshold) {
        // Access internal frames directly — _backfill is a private write operation
        // and must not go through the public read API (which now returns copies).
        const all = this._trajectory._frames;
        for (const frame of all) {
            if (frame.segment_id !== segment_id) continue;

            let best = null;
            let bestDist = Infinity;
            for (const basin of basins) {
                const d = l1(frame.band_profile_snapshot, basin.centroid_band_profile);
                if (d < bestDist) {
                    bestDist = d;
                    best = basin;
                }
            }

            // Mutate frame in-place (trajectory frames are internal — not exposed as immutable)
            if (best && bestDist <= threshold) {
                frame.basin_id = best.basin_id;
                frame.distance_to_basin_centroid = bestDist;
            } else {
                frame.basin_id = null;
                frame.distance_to_basin_centroid = null;
            }
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return a safe copy of a stored state for read-path consumers.
 * The stored object is shallow-frozen; nested arrays are not frozen.
 * Spread the top level and the contract-critical nested structures so
 * callers cannot mutate stored state through a returned reference.
 * @param {Object} state
 * @returns {Object}
 */
function copyState(state) {
    return {
        ...state,
        kept_bins: state.kept_bins ? state.kept_bins.map(b => ({ ...b })) : state.kept_bins,
        invariants: state.invariants ? {
            ...state.invariants,
            band_profile_norm: state.invariants.band_profile_norm ? {
                ...state.invariants.band_profile_norm,
                band_energy: state.invariants.band_profile_norm.band_energy
                    ? [...state.invariants.band_profile_norm.band_energy]
                    : state.invariants.band_profile_norm.band_energy,
            } : state.invariants.band_profile_norm,
        } : state.invariants,
        provenance: state.provenance ? {
            ...state.provenance,
            input_refs: state.provenance.input_refs
                ? [...state.provenance.input_refs]
                : state.provenance.input_refs,
        } : state.provenance,
    };
}

/**
 * Return a safe copy of a stored basin for read-path consumers.
 * @param {Object} basin
 * @returns {Object}
 */
function copyBasin(basin) {
    return {
        ...basin,
        centroid_band_profile: basin.centroid_band_profile
            ? [...basin.centroid_band_profile]
            : basin.centroid_band_profile,
        member_state_ids: basin.member_state_ids
            ? [...basin.member_state_ids]
            : basin.member_state_ids,
        span: basin.span ? { ...basin.span } : basin.span,
        receipts: basin.receipts ? { ...basin.receipts } : basin.receipts,
    };
}

function copyMemoryObject(memoryObject) {
    return deepCopy(memoryObject);
}

function l1(a, b) {
    const n = Math.max(a.length, b.length);
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    return s;
}

function deepCopy(obj) {
    // JSON round-trip is sufficient for plain artifact objects (no functions/symbols)
    return JSON.parse(JSON.stringify(obj));
}

function buildMemoryObjectId(state) {
    return `MO:${state.state_id}`;
}

function asArray(value) {
    return Array.isArray(value) ? [...value] : [];
}
