// operators/basin/BasinOp.js

/**
 * BasinOp
 *
 * Purpose:
 * Organize structural memory neighborhoods (proto-basin groupings) over a set
 * of H1/M1 HarmonicStates by clustering them in band-profile L1 space.
 *
 * Each produced cluster is a structural neighborhood candidate — a set of
 * states whose band profiles fall within the declared similarity threshold.
 * The centroid is the duration-weighted mean band profile of all members.
 * The radius is the max L1 distance from any member to the centroid.
 *
 * These groupings are proto-basins: structural memory neighborhoods that may
 * correspond to dynamical attractor basins, but are not proven to be such.
 * True dynamical basin detection is deferred to future trajectory-convergence,
 * dwell, and transition analysis.
 *
 * Contract:
 * - accepts H1[] or M1[] (or mixed) within a single segment
 * - emits BasinSet containing one BasinState per discovered cluster
 * - deterministic given identical inputs + BasinPolicy
 * - never mutates input states
 * - clustering is single-link by default (deterministic, no random init)
 * - basin_id is derived from stream_id + segment_id + centroid hash
 *
 * Authority class: Derived (tooling-adjacent — does not promote canonical memory)
 *
 * BasinOp outputs are consumed by:
 *   - MemorySubstrate (assigns structural neighborhood ID to new frames)
 *   - TrajectoryBuffer (stores distance_to_basin_centroid per frame)
 *   - no promotion layer is activated here
 *
 * Non-responsibilities:
 * - does NOT classify states or decide what is "normal"
 * - does NOT predict future states or trajectory evolution
 * - does NOT promote canon or assert truth about attractor membership
 * - assignToBasin() records proximity to a neighborhood centroid; it does NOT
 *   prove dynamical basin membership
 *
 * Layer: Substrate Space
 * Authority class: Derived (geometric index, not authoritative pipeline operator)
 *
 * Artifact IO:
 *   Input:  H1[] or M1[] (single segment by default)
 *   Output: BN BasinSet
 *
 * References:
 * - README_WorkflowContract.md
 * - README_SubstrateLayer.md §3
 * - README_MasterConstitution.md §3 (substrate layer)
 */

/**
 * @typedef {Object} BasinPolicy
 * @property {string} policy_id
 * @property {number} similarity_threshold     — L1 band-profile distance below which two states are in the same basin
 * @property {number} min_member_count         — minimum states to form a valid basin (reject singletons if > 1)
 * @property {"duration"|"uniform"} weight_mode — how to weight members when computing centroid
 * @property {boolean} [cross_segment=false]   — allow states from different segments in one basin
 * @property {"single_link"|"complete_link"} [linkage="single_link"]
 */

/**
 * @typedef {Object} BasinState
 * @property {string} basin_id
 * @property {string} stream_id
 * @property {string} segment_id              — segment of the founding member
 * @property {string[]} member_state_ids      — all H1/M1 state_ids in this basin
 * @property {number} member_count
 * @property {number[]} centroid_band_profile — duration-weighted mean band profile
 * @property {number} centroid_energy_raw     — duration-weighted mean energy
 * @property {number} radius                  — max L1 distance from any member to centroid
 * @property {number} mean_distance           — mean L1 distance from members to centroid
 * @property {number} total_duration_sec      — sum of all member window durations
 * @property {{ t_start: number, t_end: number }} span — earliest t_start to latest t_end
 * @property {Object} receipts
 * @property {string} receipts.policy_id
 * @property {string} receipts.linkage
 * @property {string} receipts.weight_mode
 * @property {number} receipts.similarity_threshold
 */

/**
 * @typedef {Object} BasinSet
 * @property {string} artifact_type
 * @property {"BN"} artifact_class
 * @property {string} stream_id
 * @property {string} segment_id
 * @property {BasinState[]} basins
 * @property {string[]} unassigned_state_ids   — states not meeting min_member_count
 * @property {Object} receipts
 * @property {number} receipts.states_considered
 * @property {number} receipts.basins_formed
 * @property {number} receipts.states_unassigned
 * @property {string} receipts.policy_id
 * @property {Object} provenance
 * @property {string} provenance.operator_id
 * @property {string} provenance.operator_version
 * @property {string[]} provenance.input_refs
 */

/**
 * @typedef {{ ok: true, artifact: BasinSet } | { ok: false, error: string, reasons: string[] }} BasinOutcome
 */

export class BasinOp {
    /**
     * @param {Object} cfg
     * @param {string} [cfg.operator_id="BasinOp"]
     * @param {string} [cfg.operator_version="0.1.0"]
     */
    constructor(cfg = {}) {
        this.operator_id = cfg.operator_id ?? "BasinOp";
        this.operator_version = cfg.operator_version ?? "0.1.0";
    }

    /**
     * @param {Object} input
     * @param {Array<Object>} input.states    — H1[] or M1[] artifacts
     * @param {BasinPolicy} input.basin_policy
     * @returns {BasinOutcome}
     */
    run(input) {
        const { states, basin_policy } = input ?? {};
        const reasons = [];

        if (!Array.isArray(states) || states.length === 0) {
            reasons.push("states must be a non-empty array of H1 or M1 artifacts");
        }
        if (!basin_policy) {
            reasons.push("basin_policy is required");
        }
        if (!basin_policy?.policy_id || typeof basin_policy.policy_id !== "string") {
            reasons.push("basin_policy.policy_id must be a non-empty string");
        }
        if (!Number.isFinite(basin_policy?.similarity_threshold) || basin_policy.similarity_threshold <= 0) {
            reasons.push("basin_policy.similarity_threshold must be a positive finite number");
        }
        if (reasons.length > 0) {
            return { ok: false, error: "INVALID_SCHEMA", reasons };
        }

        // Validate individual states
        for (const s of states) {
            if (!s || (s.artifact_class !== "H1" && s.artifact_class !== "M1")) {
                return { ok: false, error: "INVALID_STATE", reasons: ["all states must be H1 or M1 artifacts"] };
            }
            if (!s.state_id || !s.stream_id || !s.segment_id) {
                return { ok: false, error: "INVALID_STATE", reasons: ["all states must have state_id, stream_id, segment_id"] };
            }
            if (!Array.isArray(s.invariants?.band_profile_norm?.band_energy) ||
                s.invariants.band_profile_norm.band_energy.length === 0) {
                return {
                    ok: false,
                    error: "INVALID_STATE",
                    reasons: [`state ${s.state_id} is missing invariants.band_profile_norm.band_energy`],
                };
            }
        }

        // Enforce single-segment constraint unless cross_segment enabled
        const crossSegment = basin_policy.cross_segment ?? false;
        if (!crossSegment) {
            const segs = new Set(states.map(s => s.segment_id));
            if (segs.size > 1) {
                return {
                    ok: false,
                    error: "CROSS_SEGMENT_VIOLATION",
                    reasons: [
                        "states span multiple segments; set basin_policy.cross_segment=true to allow",
                        `segments found: ${[...segs].join(", ")}`,
                    ],
                };
            }
        }

        const streamId = states[0].stream_id;
        const segmentId = states[0].segment_id;
        const threshold = basin_policy.similarity_threshold;
        const linkage = basin_policy.linkage ?? "single_link";
        const weightMode = basin_policy.weight_mode ?? "duration";
        const minMembers = basin_policy.min_member_count ?? 1;

        // ── Step 1: Build pairwise L1 distance matrix in band-profile space ──
        const n = states.length;
        const profiles = states.map(s => s.invariants.band_profile_norm.band_energy);
        const dist = buildDistanceMatrix(profiles);

        // ── Step 2: Cluster by threshold (deterministic agglomerative) ────────
        const clusterAssignments = agglomerativeCluster(dist, threshold, linkage, n);

        // ── Step 3: Group states by cluster ID ────────────────────────────────
        const clusterMap = new Map();
        for (let i = 0; i < n; i++) {
            const cid = clusterAssignments[i];
            if (!clusterMap.has(cid)) clusterMap.set(cid, []);
            clusterMap.get(cid).push(states[i]);
        }

        // ── Step 4: Build BasinState for each cluster meeting min_member_count ─
        const basins = [];
        const unassigned = [];

        // Sort cluster IDs for determinism
        const sortedClusterIds = [...clusterMap.keys()].sort((a, b) => a - b);

        for (const cid of sortedClusterIds) {
            const members = clusterMap.get(cid);

            if (members.length < minMembers) {
                for (const m of members) unassigned.push(m.state_id);
                continue;
            }

            const weights = members.map(s => computeWeight(s, weightMode));
            const centroidProfile = weightedMeanVector(
                members.map(s => s.invariants.band_profile_norm.band_energy),
                weights
            );
            const centroidEnergy = weightedMean(
                members.map(s => s.invariants?.energy_raw ?? 0),
                weights
            );

            const distances = members.map(s =>
                l1(s.invariants.band_profile_norm.band_energy, centroidProfile)
            );
            const radius = Math.max(...distances);
            const meanDist = distances.reduce((a, b) => a + b, 0) / distances.length;

            const totalDuration = members.reduce((acc, s) => {
                const dur = (s.window_span?.t_end ?? 0) - (s.window_span?.t_start ?? 0);
                return acc + dur;
            }, 0);

            const tStart = Math.min(...members.map(s => s.window_span?.t_start ?? Infinity));
            const tEnd = Math.max(...members.map(s => s.window_span?.t_end ?? -Infinity));

            const memberIds = members.map(s => s.state_id).sort(); // stable ordering
            const basinId = makeBasinId(streamId, segmentId, centroidProfile, cid);

            /** @type {BasinState} */
            const basin = {
                basin_id: basinId,
                stream_id: streamId,
                segment_id: members[0].segment_id,
                member_state_ids: memberIds,
                member_count: members.length,
                centroid_band_profile: centroidProfile,
                centroid_energy_raw: centroidEnergy,
                radius,
                mean_distance: meanDist,
                total_duration_sec: totalDuration,
                span: { t_start: tStart, t_end: tEnd },
                receipts: {
                    policy_id: basin_policy.policy_id,
                    linkage,
                    weight_mode: weightMode,
                    similarity_threshold: threshold,
                },
            };

            basins.push(basin);
        }

        // Sort basins by t_start for deterministic output
        basins.sort((a, b) => a.span.t_start - b.span.t_start);

        /** @type {BasinSet} */
        const artifact = {
            artifact_type: "BasinSet",
            artifact_class: "BN",
            stream_id: streamId,
            segment_id: segmentId,
            basins,
            unassigned_state_ids: unassigned.sort(),
            receipts: {
                states_considered: states.length,
                basins_formed: basins.length,
                states_unassigned: unassigned.length,
                policy_id: basin_policy.policy_id,
            },
            provenance: {
                operator_id: this.operator_id,
                operator_version: this.operator_version,
                input_refs: states.map(s => s.state_id),
            },
        };

        return { ok: true, artifact };
    }

    /**
     * Assign a single new state to the nearest structural neighborhood centroid,
     * if within the declared similarity threshold.
     * Returns basin_id (neighborhood ID) and distance, or null if none is close enough.
     *
     * This is the hot-path method for real-time trajectory frame assignment.
     * The assignment records proximity to a structural neighborhood centroid;
     * it does not prove dynamical basin membership.
     *
     * @param {Object} args
     * @param {Object} args.state          — H1 or M1 artifact
     * @param {BasinState[]} args.basins
     * @param {number} args.threshold
     * @returns {{ basin_id: string, distance: number } | null}
     */
    assignToBasin({ state, basins, threshold }) {
        if (!Array.isArray(basins) || basins.length === 0) return null;
        const profile = state.invariants?.band_profile_norm?.band_energy;
        if (!Array.isArray(profile) || profile.length === 0) return null;

        let best = null;
        let bestDist = Infinity;

        for (const basin of basins) {
            const d = l1(profile, basin.centroid_band_profile);
            if (d < bestDist) {
                bestDist = d;
                best = basin;
            }
        }

        if (best !== null && bestDist <= threshold) {
            return { basin_id: best.basin_id, distance: bestDist };
        }
        return null;
    }
}

// ─── Clustering ───────────────────────────────────────────────────────────────

/**
 * Build symmetric pairwise L1 distance matrix.
 * @param {number[][]} profiles
 * @returns {number[][]}
 */
function buildDistanceMatrix(profiles) {
    const n = profiles.length;
    const dist = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const d = l1(profiles[i], profiles[j]);
            dist[i][j] = d;
            dist[j][i] = d;
        }
    }
    return dist;
}

/**
 * Deterministic agglomerative clustering.
 * Returns an array of cluster IDs (integers) of length n.
 * Lower IDs appear for clusters formed from lower-indexed states.
 *
 * Single-link: two clusters merge if ANY pair is within threshold.
 * Complete-link: two clusters merge only if ALL pairs are within threshold.
 *
 * @param {number[][]} dist
 * @param {number} threshold
 * @param {"single_link"|"complete_link"} linkage
 * @param {number} n
 * @returns {number[]}
 */
function agglomerativeCluster(dist, threshold, linkage, n) {
    // Start: each state is its own cluster
    const assignment = Array.from({ length: n }, (_, i) => i);

    // Repeatedly merge closest pair below threshold
    let changed = true;
    while (changed) {
        changed = false;
        let bestI = -1, bestJ = -1, bestDist = Infinity;

        const clusters = new Set(assignment);
        const clusterArr = [...clusters].sort((a, b) => a - b);

        for (let ci = 0; ci < clusterArr.length; ci++) {
            for (let cj = ci + 1; cj < clusterArr.length; cj++) {
                const a = clusterArr[ci];
                const b = clusterArr[cj];

                const membersA = indices(assignment, a);
                const membersB = indices(assignment, b);

                const d = clusterDistance(dist, membersA, membersB, linkage);
                if (d < threshold && d < bestDist) {
                    bestDist = d;
                    bestI = a;
                    bestJ = b;
                }
            }
        }

        if (bestI !== -1) {
            // Merge bestJ into bestI (lower ID survives for determinism)
            const target = Math.min(bestI, bestJ);
            const src = Math.max(bestI, bestJ);
            for (let i = 0; i < n; i++) {
                if (assignment[i] === src) assignment[i] = target;
            }
            changed = true;
        }
    }

    return assignment;
}

function indices(assignment, cid) {
    const out = [];
    for (let i = 0; i < assignment.length; i++) {
        if (assignment[i] === cid) out.push(i);
    }
    return out;
}

function clusterDistance(dist, membersA, membersB, linkage) {
    let result = linkage === "complete_link" ? -Infinity : Infinity;
    for (const i of membersA) {
        for (const j of membersB) {
            const d = dist[i][j];
            if (linkage === "single_link") {
                if (d < result) result = d;
            } else {
                if (d > result) result = d;
            }
        }
    }
    return result;
}

// ─── Weighting + math ─────────────────────────────────────────────────────────

function computeWeight(state, mode) {
    if (mode === "duration") {
        return Math.max(0, (state.window_span?.t_end ?? 0) - (state.window_span?.t_start ?? 0));
    }
    return 1;
}

function weightedMeanVector(vectors, weights) {
    if (vectors.length === 0) return [];
    const n = Math.max(...vectors.map(v => v.length));
    const out = new Array(n).fill(0);
    let wSum = 0;
    for (let i = 0; i < vectors.length; i++) {
        const w = weights[i] ?? 1;
        wSum += w;
        for (let j = 0; j < vectors[i].length; j++) {
            out[j] += w * (vectors[i][j] ?? 0);
        }
    }
    if (wSum === 0) return out;
    return out.map(x => x / wSum);
}

function weightedMean(xs, weights) {
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) {
        num += (weights[i] ?? 1) * xs[i];
        den += weights[i] ?? 1;
    }
    return den === 0 ? 0 : num / den;
}

function l1(a, b) {
    const n = Math.max(a.length, b.length);
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    return s;
}

/**
 * Derive a stable basin_id from stream/segment context and a profile fingerprint.
 * Uses a simple deterministic FNV-1a-style hash over the centroid vector.
 */
function makeBasinId(streamId, segmentId, centroid, clusterIndex) {
    const fingerprint = centroid
        .map(x => Math.round(x * 1e4))
        .join(",");
    const hash = fnv32a(fingerprint);
    return `BN:${streamId}:${segmentId}:c${clusterIndex}:${hash}`;
}

function fnv32a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
}
