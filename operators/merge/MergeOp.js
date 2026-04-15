// operators/merge/MergeOp.js

/**
 * MergeOp
 *
 * Layer: Runtime Memory Space
 * Authority class: Structural (structure compaction, not canon promotion)
 *
 * Purpose:
 * Compact compatible HarmonicStates (H1[]) into a coarser multi-window
 * MergedState (M1) while preserving declared invariants and provenance.
 * MergeOp reduces windows across time; CompressOp reduces bins within one window.
 *
 * Contract:
 * - accepts H1[] + MergePolicy + post-merge CompressionPolicy
 * - emits M1 MergedState
 * - phase-aligns each H1 into common reference frame via clock-delta rotation
 *   before duration-weighted complex superposition
 * - recomputes invariants and logs phase deltas, weights, energy drift, and
 *   provenance list in merge receipts
 * - two merge modes:
 *     "authoritative" — same stream/segment/policies required; novelty-gated;
 *                       eligible_for_authoritative_merge=true only when
 *                       blocked_reason="none" (strict invariance pass)
 *     "lens"          — cross-segment/cross-policy allowed; explicitly not
 *                       authoritative; eligible_for_authoritative_merge=false always
 * - deterministic given identical inputs + fixed merge order + policies
 *
 * Non-responsibilities:
 * - does NOT promote or activate canon
 * - merge is NOT consensus, NOT prediction, NOT truth promotion
 * - M1 uncertainty.replay fields (recon_mae, recon_rmse, parseval_error) are
 *   null on emission — M1 does not reconstruct at merge time
 * - does NOT invent bins; only superimposes existing H1 bins
 *
 * Artifact IO:
 *   Input:  H1[] + MergePolicy + CompressionPolicy
 *   Output: M1 MergedState
 *
 * References:
 * - README_WorkflowContract.md
 * - README_MasterConstitution.md §3 (runtime memory layer)
 * - OPERATOR_CONTRACTS.md §7
 */

/**
 * @typedef {Object} KeptBin
 * @property {number} k
 * @property {number} freq_hz
 * @property {number} re
 * @property {number} im
 * @property {number} magnitude
 * @property {number} phase 
 */

/**
 * @typedef {Object} HarmonicState
 * @property {string} artifact_type
 * @property {"H1"} artifact_class
 * @property {string} state_id
 * @property {string} stream_id
 * @property {string} segment_id
 * @property {Object} window_span
 * @property {number} window_span.t_start
 * @property {number} window_span.t_end
 * @property {number} window_span.duration_sec
 * @property {number} window_span.window_count
 * @property {Object} grid
 * @property {number} grid.Fs_target
 * @property {number} grid.N
 * @property {number} grid.df
 * @property {number} grid.bin_count_full
 * @property {number} grid.bin_count_kept
 * @property {KeptBin[]} kept_bins
 * @property {Object} invariants
 * @property {number} invariants.energy_raw
 * @property {number} invariants.energy_norm
 * @property {{band_edges:number[], band_energy:number[]}} invariants.band_profile_norm
 * @property {Object} uncertainty
 * @property {Object} confidence
 * @property {number} confidence.overall
 * @property {Object} gates
 * @property {"none"|"low_identity"|"low_energy"|"low_band"|"novelty_boundary"} gates.blocked_reason
 * @property {Object} receipts
 * @property {Object} policies
 * @property {Object} provenance
 */

/**
 * @typedef {Object} CompressionThresholds
 * @property {number} max_recon_rmse
 * @property {number} max_energy_residual
 * @property {number} max_band_divergence
 */

/**
 * @typedef {Object} MergeCompressionPolicy
 * @property {string} policy_id
 * @property {"topK"|"band_quota"} selection_method
 * @property {number} budget_K
 * @property {number} [maxK]
 * @property {"identity"|"energy"|"band_profile"} invariance_lens
 * @property {CompressionThresholds} thresholds
 * @property {{band_edges:number[], min_bins_per_band?:number}} [band_quota]
 * @property {boolean} [include_dc=true]
 * @property {number[]} [band_edges]
 */

/**
 * @typedef {Object} MergePolicy
 * @property {string} policy_id
 * @property {"strict_adjacent"|"time_touching"} adjacency_rule
 * @property {"clock_delta_rotation"} phase_alignment_mode
 * @property {"duration"|"duration_quality"} weights_mode
 * @property {"strict"|"off"} novelty_gate
 * @property {"authoritative"|"lens"} merge_mode
 * @property {number} [grid_tolerance=0]
 */

/**
 * @typedef {Object} MergeRecord
 * @property {string[]} inputs
 * @property {number[]} weights
 * @property {string} merge_policy_id
 * @property {string} output_ref
 * @property {{level:number, index:number}|null} merge_tree_position
 */

/**
 * @typedef {Object} MergedState
 * @property {string} artifact_type
 * @property {"M1"} artifact_class
 * @property {string} state_id
 * @property {string} stream_id
 * @property {string} segment_id
 * @property {Object} window_span
 * @property {number} window_span.t_start
 * @property {number} window_span.t_end
 * @property {number} window_span.duration_sec
 * @property {number} window_span.window_count
 * @property {Object} grid
 * @property {number} grid.Fs_target
 * @property {number} grid.N
 * @property {number} grid.df
 * @property {number} grid.bin_count_full
 * @property {number} grid.bin_count_kept
 * @property {KeptBin[]} kept_bins
 * @property {Object} invariants
 * @property {number} invariants.energy_raw
 * @property {number} invariants.energy_norm
 * @property {{band_edges:number[], band_energy:number[]}} invariants.band_profile_norm
 * @property {Object} uncertainty
 * @property {Object} uncertainty.time
 * @property {Object} uncertainty.phase_by_band
 * @property {Object} uncertainty.replay
 * @property {null} uncertainty.replay.recon_mae
 * @property {null} uncertainty.replay.recon_rmse
 * @property {null} uncertainty.replay.parseval_error
 * @property {Object} uncertainty.distortion
 * @property {number} uncertainty.distortion.energy_residual
 * @property {number} uncertainty.distortion.band_profile_divergence
 * @property {number} uncertainty.distortion.phase_align_residual
 * @property {Object} confidence
 * @property {Object} gates
 * @property {boolean} gates.eligible_for_authoritative_merge
 * @property {boolean} gates.eligible_for_archive_tier
 * @property {"none"|"low_identity"|"low_energy"|"low_band"} gates.blocked_reason
 * @property {Object} receipts
 * @property {Object} receipts.merge
 * @property {"authoritative"|"lens"} receipts.merge.merge_mode
 * @property {string} receipts.merge.input_scope_posture
 * @property {string} receipts.merge.adjacency_posture
 * @property {string} receipts.merge.consolidation_support_subset
 * @property {string} receipts.merge.phase_alignment_mode
 * @property {string} receipts.merge.weights_mode
 * @property {string[]} receipts.merge.merged_from
 * @property {number[]} receipts.merge.phase_deltas
 * @property {number|null} receipts.merge.energy_drift_after_merge
 * @property {string} evidence_posture
 * @property {string} merge_basis_posture
 * @property {string[]} explicit_non_claims
 * @property {MergeRecord} merge_record
 * @property {Object} policies
 * @property {Object} provenance
 */

/**
 * @typedef {Object} MergeResult
 * @property {true} ok
 * @property {MergedState} artifact
 *
 * @typedef {Object} MergeError
 * @property {false} ok
 * @property {string} error
 * @property {string[]} reasons
 *
 * @typedef {MergeResult | MergeError} MergeOutcome
 */

export class MergeOp {
    /**
     * @param {Object} cfg
     * @param {string} [cfg.operator_id="MergeOp"]
     * @param {string} [cfg.operator_version="0.1.0"]
     */
    constructor(cfg = {}) {
        this.operator_id = cfg.operator_id ?? "MergeOp";
        this.operator_version = cfg.operator_version ?? "0.1.0";
    }

    /**
     * @param {Object} input
     * @param {HarmonicState[]} input.states
     * @param {MergePolicy} input.merge_policy
     * @param {MergeCompressionPolicy} input.post_merge_compression_policy
     * @param {{level:number,index:number}|null} [input.merge_tree_position=null]
     * @returns {MergeOutcome}
     */
    run(input) {
        const {
            states,
            merge_policy,
            post_merge_compression_policy,
            merge_tree_position = null,
        } = input ?? {};

        const reasons = [];

        if (!Array.isArray(states) || states.length < 2) {
            reasons.push("states must contain at least 2 H1 HarmonicStates");
        }
        if (!merge_policy) reasons.push("merge_policy is required");
        if (!post_merge_compression_policy) reasons.push("post_merge_compression_policy is required");

        if (reasons.length > 0) {
            return { ok: false, error: "INVALID_SCHEMA", reasons };
        }

        for (const s of states) {
            if (!s || s.artifact_class !== "H1") {
                return {
                    ok: false,
                    error: "INVALID_INPUT_STATE",
                    reasons: ["all inputs must be valid H1 HarmonicStates"],
                };
            }
        }
        for (const s of states) {
            if (!s.policies?.clock_policy_id || typeof s.policies.clock_policy_id !== "string") {
                return {
                    ok: false,
                    error: "INVALID_INPUT_STATE",
                    reasons: ["all inputs must have valid policies.clock_policy_id"],
                };
            }
            if (!s.policies?.grid_policy_id || typeof s.policies.grid_policy_id !== "string") {
                return {
                    ok: false,
                    error: "INVALID_INPUT_STATE",
                    reasons: ["all inputs must have valid policies.grid_policy_id"],
                };
            }
            if (!s.policies?.window_policy_id || typeof s.policies.window_policy_id !== "string") {
                return {
                    ok: false,
                    error: "INVALID_INPUT_STATE",
                    reasons: ["all inputs must have valid policies.window_policy_id"],
                };
            }
            if (!s.policies?.transform_policy_id || typeof s.policies.transform_policy_id !== "string") {
                return {
                    ok: false,
                    error: "INVALID_INPUT_STATE",
                    reasons: ["all inputs must have valid policies.transform_policy_id"],
                };
            }
            if (!s.policies?.compression_policy_id || typeof s.policies.compression_policy_id !== "string") {
                return {
                    ok: false,
                    error: "INVALID_INPUT_STATE",
                    reasons: ["all inputs must have valid policies.compression_policy_id"],
                };
            }
            // invariants are required: they drive energy/band scoring and merge eligibility.
            // Missing invariants cannot silently distort merge confidence or gate decisions.
            if (!Number.isFinite(s.invariants?.energy_raw)) {
                return {
                    ok: false,
                    error: "INVALID_INPUT_STATE",
                    reasons: ["all inputs must have finite invariants.energy_raw"],
                };
            }
            if (!Array.isArray(s.invariants?.band_profile_norm?.band_energy) ||
                s.invariants.band_profile_norm.band_energy.length === 0) {
                return {
                    ok: false,
                    error: "INVALID_INPUT_STATE",
                    reasons: ["all inputs must have non-empty invariants.band_profile_norm.band_energy"],
                };
            }
            // duration_sec drives weight computation; ?? 1 fallback is now guarded here.
            if (!Number.isFinite(s.window_span?.duration_sec)) {
                return {
                    ok: false,
                    error: "INVALID_INPUT_STATE",
                    reasons: ["all inputs must have finite window_span.duration_sec (required for weight computation)"],
                };
            }
        }
        const ordered = [...states].sort((a, b) => a.window_span.t_start - b.window_span.t_start);

        // 0) Eligibility gate
        const eligibility = checkEligibility(ordered, merge_policy);
        if (!eligibility.ok) {
            return { ok: false, error: "MERGE_INELIGIBLE", reasons: eligibility.reasons };
        }

        const base = ordered[0];
        const Fs = base.grid.Fs_target;
        const N = base.grid.N;
        const df = base.grid.df;
        const streamId = base.stream_id;
        const segmentId = base.segment_id;
        const scopeStats = inspectMergeScope(ordered);


        // 1) Phase align all states into the first state's reference frame
        const alignedStates = ordered.map((s) => {
            const deltaT = s.window_span.t_start - base.window_span.t_start;
            const rotated = rotateStateBins(s.kept_bins, deltaT, merge_policy.phase_alignment_mode);
            return {
                ref: s,
                delta_t: deltaT,
                phase_delta_summary: meanAbsPhaseDelta(s.kept_bins, rotated),
                bins: rotated,
            };
        });

        // 2) Weighted complex superposition
        const weights = alignedStates.map((s) => computeWeight(s.ref, merge_policy.weights_mode));
        const mergedFull = weightedMergeBins(alignedStates, weights, { Fs, N, df });

        // 3) Recompute invariants on merged full state
        const bandEdges =
            post_merge_compression_policy.band_edges ??
            post_merge_compression_policy.band_quota?.band_edges ??
            defaultBandEdges(Fs);

        const energyRaw = sumEnergy(mergedFull);
        const bandProfileNorm = computeBandProfile(mergedFull, bandEdges);

        const expectedEnergy = weightedAverage(
            ordered.map((s) => s.invariants?.energy_raw ?? sumEnergy(s.kept_bins)),
            weights
        );
        const energyDriftAfterMerge =
            Math.abs(energyRaw - expectedEnergy) / Math.max(Math.abs(expectedEnergy), 1e-12);

        const expectedBand = weightedAverageVectors(
            ordered.map((s) => s.invariants?.band_profile_norm?.band_energy ?? []),
            weights
        );
        const bandProfileDivergence = l1(
            bandProfileNorm.band_energy,
            expectedBand
        );

        // 4) Post-merge compression
        const kept = compressMergedFull({
            fullBins: mergedFull,
            policy: post_merge_compression_policy,
        });

        // 5) Merge confidence/gates
        const identityConfidence = 1.0; // merge identity drift handled later via replay if desired
        const energyConfidence = scoreThreshold(
            energyDriftAfterMerge,
            post_merge_compression_policy.thresholds.max_energy_residual
        );
        const bandConfidence = scoreThreshold(
            bandProfileDivergence,
            post_merge_compression_policy.thresholds.max_band_divergence
        );
        const overallConfidence = Math.max(0, Math.min(identityConfidence, energyConfidence, bandConfidence));

        const blockedReason =
            overallConfidence < 1
                ? lowestInvariant(identityConfidence, energyConfidence, bandConfidence)
                : "none";

        const tStart = ordered[0].window_span.t_start;
        const tEnd = ordered[ordered.length - 1].window_span.t_end;
        const durationSec = tEnd - tStart;

        const stateId = `M1:${streamId}:${segmentId}:${tStart}:${tEnd}`;

        /** @type {MergedState} */
        const artifact = {
            artifact_type: "MergedState",
            artifact_class: "M1",
            state_id: stateId,
            stream_id: streamId,
            segment_id: segmentId,
            window_span: {
                t_start: tStart,
                t_end: tEnd,
                duration_sec: durationSec,
                window_count: ordered.reduce((a, s) => a + (s.window_span.window_count ?? 1), 0),
            },
            grid: {
                Fs_target: Fs,
                N,
                df,
                bin_count_full: mergedFull.length,
                bin_count_kept: kept.length,
            },
            kept_bins: kept,
            invariants: {
                energy_raw: energyRaw,
                // energy_norm = fraction of merged energy retained after post-merge compression.
                // Uses same convention as CompressOp: sumEnergy(kept) / sumEnergy(mergedFull).
                energy_norm: energyRaw === 0 ? 0 : sumEnergy(kept) / energyRaw,
                band_profile_norm: bandProfileNorm,
            },
            uncertainty: {
                time: {
                    dt_nominal: null,
                    jitter_rms: null,
                    gap_total_duration: 0,
                    monotonicity_violations: 0,
                    drift_ppm: null,
                    fit_residual_rms: null,
                    post_align_jitter: null,
                },
                phase_by_band: {
                    band_edges: [...bandEdges],
                    sigma_phi: estimatePhaseSigmaByBand(kept, bandEdges),
                    source: "measured_from_merge",
                },
                replay: {
                    recon_mae: null,
                    recon_rmse: null,
                    parseval_error: null,
                },
                distortion: {
                    energy_residual: energyDriftAfterMerge,
                    band_profile_divergence: bandProfileDivergence,
                    phase_align_residual: mean(alignedStates.map((s) => s.phase_delta_summary)),
                },
            },
            confidence: {
                by_invariant: {
                    identity: identityConfidence,
                    energy: energyConfidence,
                    band_profile: bandConfidence,
                },
                overall: overallConfidence,
                method: "thresholded_receipts_v1",
            },
            evidence_posture: "structural_consolidation_evidence",
            merge_basis_posture: deriveMergeBasisPosture({
                mergeMode: merge_policy.merge_mode,
                blockedReason,
                scopeStats,
            }),
            explicit_non_claims: [
                "not truth",
                "not canon",
                "not a same-object verdict",
                "not a memory claim",
                "not an identity claim",
                "not a review verdict",
            ],
            gates: {
                // eligible_for_authoritative_merge: true means this M1 satisfies merge-policy
                // and invariance-bound requirements. It does NOT signal readiness for canon
                // promotion is outside this runtime layer.
                eligible_for_authoritative_merge:
                    merge_policy.merge_mode === "authoritative" && blockedReason === "none",
                eligible_for_archive_tier: overallConfidence >= 0.75,
                blocked_reason: blockedReason,
            },
            receipts: {
                merge: {
                    merge_mode: merge_policy.merge_mode,
                    input_scope_posture: deriveInputScopePosture({
                        mergeMode: merge_policy.merge_mode,
                        scopeStats,
                    }),
                    adjacency_posture: deriveAdjacencyPosture({
                        adjacencyRule: merge_policy.adjacency_rule,
                        scopeStats,
                    }),
                    consolidation_support_subset: "structural consolidation, adjacency gating, and support compaction only; same-object, memory, identity, and review meaning deferred at this seam",
                    phase_alignment_mode: merge_policy.phase_alignment_mode,
                    weights_mode: merge_policy.weights_mode,
                    merged_from: ordered.map((s) => s.state_id),
                    phase_deltas: alignedStates.map((s) => s.delta_t),
                    energy_drift_after_merge: energyDriftAfterMerge,
                },
            },
            merge_record: {
                inputs: ordered.map((s) => s.state_id),
                weights,
                merge_policy_id: makeMergePolicyId(merge_policy),
                output_ref: stateId,
                merge_tree_position,
            },
            policies: {
                clock_policy_id: base.policies.clock_policy_id,
                grid_policy_id: base.policies.grid_policy_id,
                window_policy_id: base.policies.window_policy_id,
                transform_policy_id: base.policies.transform_policy_id,
                compression_policy_id: makeMergeCompressionPolicyId(post_merge_compression_policy),
                merge_policy_id: makeMergePolicyId(merge_policy),
            },
            provenance: {
                input_refs: ordered.map(makeInputRef),
                operator_id: this.operator_id,
                operator_version: this.operator_version,
            },
        };

        return { ok: true, artifact };
    }
}

function inspectMergeScope(states) {
    const first = states[0];
    const crossSegment = states.some((s) => s.segment_id !== first.segment_id);
    const crossPolicy = states.some(
        (s) =>
            s.policies?.clock_policy_id !== first.policies?.clock_policy_id ||
            s.policies?.grid_policy_id !== first.policies?.grid_policy_id ||
            s.policies?.window_policy_id !== first.policies?.window_policy_id ||
            s.policies?.transform_policy_id !== first.policies?.transform_policy_id ||
            s.policies?.compression_policy_id !== first.policies?.compression_policy_id
    );
    return { crossSegment, crossPolicy };
}

function deriveMergeBasisPosture({ mergeMode, blockedReason, scopeStats }) {
    if (mergeMode === "lens") {
        if (scopeStats.crossSegment || scopeStats.crossPolicy) {
            return "lens_basis | cross-boundary structural consolidation only | same-object closure deferred";
        }
        return "lens_basis | structural consolidation only | same-object closure deferred";
    }
    if (blockedReason === "none") {
        return "authoritative_basis | strict consolidation bounds satisfied | same-object closure still deferred";
    }
    return `authoritative_basis_narrowed | consolidation produced with ${blockedReason} stress | same-object closure deferred`;
}

function deriveInputScopePosture({ mergeMode, scopeStats }) {
    if (mergeMode === "lens") {
        if (scopeStats.crossSegment || scopeStats.crossPolicy) {
            return "cross_boundary_lens_scope";
        }
        return "same_boundary_lens_scope";
    }
    return "same_stream_same_segment_same_policy_scope";
}

function deriveAdjacencyPosture({ adjacencyRule, scopeStats }) {
    if (adjacencyRule === "time_touching") {
        return scopeStats.crossSegment
            ? "time_touching | boundary-crossing adjacency accepted only under lens posture"
            : "time_touching | local contiguous consolidation";
    }
    if (adjacencyRule === "strict_adjacent") {
        return scopeStats.crossSegment
            ? "strict_adjacent | boundary-crossing adjacency accepted only under lens posture"
            : "strict_adjacent | local non-overlap consolidation";
    }
    return `${adjacencyRule ?? "unspecified"} | adjacency posture recorded without stronger continuity claim`;
}

function checkEligibility(states, mergePolicy) {
    const reasons = [];
    const first = states[0];
    if (mergePolicy.merge_mode === "authoritative") {
        for (let i = 1; i < states.length; i++) {
            const prev = states[0];
            const cur = states[i];

            if (cur.policies?.clock_policy_id !== prev.policies?.clock_policy_id) {
                reasons.push("authoritative merge requires identical clock_policy_id");
            }
            if (cur.policies?.grid_policy_id !== prev.policies?.grid_policy_id) {
                reasons.push("authoritative merge requires identical grid_policy_id");
            }
            if (cur.policies?.window_policy_id !== prev.policies?.window_policy_id) {
                reasons.push("authoritative merge requires identical window_policy_id");
            }
            if (cur.policies?.transform_policy_id !== prev.policies?.transform_policy_id) {
                reasons.push("authoritative merge requires identical transform_policy_id");
            }
            if (cur.policies?.compression_policy_id !== prev.policies?.compression_policy_id) {
                reasons.push("authoritative merge requires identical compression_policy_id");
            }
        }
    }
    for (let i = 0; i < states.length; i++) {
        const s = states[i];

        if (s.stream_id !== first.stream_id && mergePolicy.merge_mode === "authoritative") {
            reasons.push("authoritative merge requires same stream_id");
        }
        if (s.segment_id !== first.segment_id && mergePolicy.merge_mode === "authoritative") {
            reasons.push("authoritative merge requires same segment_id");
        }
        if (s.grid?.Fs_target !== first.grid?.Fs_target) reasons.push("Fs_target mismatch");
        if (s.grid?.N !== first.grid?.N) reasons.push("N mismatch");
        if (s.grid?.df !== first.grid?.df) reasons.push("df mismatch");
    }

    if (mergePolicy.adjacency_rule === "strict_adjacent") {
        for (let i = 1; i < states.length; i++) {
            const prev = states[i - 1];
            const cur = states[i];
            if (cur.window_span.t_start < prev.window_span.t_end) {
                reasons.push("strict_adjacent merge does not allow overlap in Door One stub");
            }
        }
    } else if (mergePolicy.adjacency_rule === "time_touching") {
        // time_touching: windows must be contiguous. Gap larger than grid_tolerance fails.
        const dt_tolerance = mergePolicy.grid_tolerance ?? 0;
        for (let i = 1; i < states.length; i++) {
            const prev = states[i - 1];
            const cur = states[i];
            if (cur.window_span.t_start > prev.window_span.t_end + dt_tolerance) {
                reasons.push(
                    `time_touching merge requires contiguous windows; gap detected between ` +
                    `t=${prev.window_span.t_end} and t=${cur.window_span.t_start}`
                );
            }
        }
    } else if (mergePolicy.adjacency_rule) {
        reasons.push(`adjacency_rule="${mergePolicy.adjacency_rule}" is not implemented in Door One stub`);
    }

    if (mergePolicy.novelty_gate === "strict") {
        for (const s of states) {
            if (s.gates?.blocked_reason === "novelty_boundary") {
                reasons.push("novelty boundary blocks merge");
            }
        }
    }

    return { ok: reasons.length === 0, reasons };
}

function rotateStateBins(bins, deltaT, mode) {
    if (mode !== "clock_delta_rotation") return bins.map((b) => ({ ...b }));

    return bins.map((b) => {
        const theta = -2 * Math.PI * b.freq_hz * deltaT;
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        const re = b.re * c - b.im * s;
        const im = b.re * s + b.im * c;
        return {
            ...b,
            re,
            im,
            magnitude: Math.hypot(re, im),
            phase: Math.atan2(im, re),
        };
    });
}

function meanAbsPhaseDelta(before, after) {
    const n = Math.min(before.length, after.length);
    if (n === 0) return 0;
    let s = 0;
    for (let i = 0; i < n; i++) {
        s += Math.abs(wrappedPhaseDelta(after[i].phase, before[i].phase));
    }
    return s / n;
}

function computeWeight(state, mode) {
    const duration = state.window_span?.duration_sec ?? 1;
    if (mode === "duration_quality") {
        // confidence.overall ?? 1: H1 always carries confidence from CompressOp.
        // Fallback 1 (full weight) is defensive for any future path without confidence.
        const q = state.confidence?.overall ?? 1;
        return duration * q;
    }
    return duration;
}

function weightedMergeBins(alignedStates, weights, { Fs, N, df }) {
    const byK = new Map();

    for (let i = 0; i < alignedStates.length; i++) {
        const bins = alignedStates[i].bins;
        const w = weights[i];
        for (const b of bins) {
            const cur = byK.get(b.k) ?? {
                k: b.k,
                freq_hz: b.freq_hz,
                re_num: 0,
                im_num: 0,
                w_sum: 0,
            };
            cur.re_num += w * b.re;
            cur.im_num += w * b.im;
            cur.w_sum += w;
            byK.set(b.k, cur);
        }
    }

    const out = [];
    for (const [, v] of [...byK.entries()].sort((a, b) => a[0] - b[0])) {
        const re = v.w_sum === 0 ? 0 : v.re_num / v.w_sum;
        const im = v.w_sum === 0 ? 0 : v.im_num / v.w_sum;
        out.push({
            k: v.k,
            freq_hz: v.freq_hz,
            re,
            im,
            magnitude: Math.hypot(re, im),
            phase: Math.atan2(im, re),
        });
    }

    return out;
}

function compressMergedFull({ fullBins, policy }) {
    const includeDC = policy.include_dc ?? true;
    const dc = fullBins.find((b) => b.k === 0);
    const nonDC = fullBins.filter((b) => b.k !== 0).sort(compareBins);
    const kept = includeDC && dc
        ? [dc, ...nonDC.slice(0, Math.max(0, policy.budget_K - 1))]
        : nonDC.slice(0, policy.budget_K);
    return stableDedup(kept);
}

function compareBins(a, b) {
    if (b.magnitude !== a.magnitude) return b.magnitude - a.magnitude;
    return a.k - b.k;
}

function stableDedup(bins) {
    const seen = new Set();
    const out = [];
    for (const b of bins) {
        if (!seen.has(b.k)) {
            seen.add(b.k);
            out.push(b);
        }
    }
    return out;
}

function computeBandProfile(bins, bandEdges) {
    const bandEnergy = new Array(bandEdges.length - 1).fill(0);
    for (const b of bins) {
        const idx = findBand(b.freq_hz, bandEdges);
        if (idx >= 0) bandEnergy[idx] += b.re * b.re + b.im * b.im;
    }
    const total = bandEnergy.reduce((a, b) => a + b, 0);
    return {
        band_edges: [...bandEdges],
        band_energy: total === 0 ? bandEnergy.map(() => 0) : bandEnergy.map((x) => x / total),
    };
}

function findBand(freq, bandEdges) {
    for (let i = 0; i < bandEdges.length - 1; i++) {
        if (freq >= bandEdges[i] && freq < bandEdges[i + 1]) return i;
    }
    if (freq === bandEdges[bandEdges.length - 1]) return bandEdges.length - 2;
    return -1;
}

function estimatePhaseSigmaByBand(bins, bandEdges) {
    const grouped = Array.from({ length: bandEdges.length - 1 }, () => []);
    for (const b of bins) {
        const idx = findBand(b.freq_hz, bandEdges);
        if (idx >= 0) grouped[idx].push(b.phase);
    }
    return grouped.map((phases) => circularStd(phases));
}

function circularStd(phases) {
    if (!phases.length) return 0;
    let c = 0, s = 0;
    for (const p of phases) {
        c += Math.cos(p);
        s += Math.sin(p);
    }
    c /= phases.length;
    s /= phases.length;
    const R = Math.sqrt(c * c + s * s);
    if (R <= 1e-12) return Math.PI;
    return Math.sqrt(-2 * Math.log(R));
}

function sumEnergy(bins) {
    let e = 0;
    for (const b of bins) e += b.re * b.re + b.im * b.im;
    return e;
}

function weightedAverage(xs, ws) {
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) {
        num += ws[i] * xs[i];
        den += ws[i];
    }
    return den === 0 ? 0 : num / den;
}

function weightedAverageVectors(vectors, ws) {
    const n = Math.max(...vectors.map((v) => v.length), 0);
    const out = new Array(n).fill(0);
    let den = 0;

    for (let i = 0; i < vectors.length; i++) {
        const v = vectors[i];
        const w = ws[i];
        den += w;
        for (let j = 0; j < v.length; j++) out[j] += w * v[j];
    }

    if (den === 0) return out;
    return out.map((x) => x / den);
}

function l1(a, b) {
    const n = Math.max(a.length, b.length);
    let s = 0;
    for (let i = 0; i < n; i++) {
        s += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    }
    return s;
}

function scoreThreshold(value, maxAllowed) {
    if (maxAllowed <= 0) return value <= 0 ? 1 : 0;
    const ratio = value / maxAllowed;
    return Math.max(0, Math.min(1, 1 - ratio));
}

function lowestInvariant(identity, energy, band) {
    const minVal = Math.min(identity, energy, band);
    if (minVal === identity) return "low_identity";
    if (minVal === energy) return "low_energy";
    return "low_band";
}

function wrappedPhaseDelta(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
}

function makeMergePolicyId(policy) {
    return [
        "MERGE",
        `pid=${policy.policy_id ?? "unspecified"}`,
        `adj=${policy.adjacency_rule ?? "unspecified"}`,
        `phase=${policy.phase_alignment_mode ?? "unspecified"}`,
        `weights=${policy.weights_mode ?? "unspecified"}`,
        `novelty=${policy.novelty_gate ?? "unspecified"}`,
        `mode=${policy.merge_mode ?? "unspecified"}`,
        `gridtol=${policy.grid_tolerance ?? 0}`,
    ].join(":");
}

function makeMergeCompressionPolicyId(policy) {
    return [
        "MERGECOMP",
        `pid=${policy.policy_id ?? "unspecified"}`,
        `select=${policy.selection_method ?? "topK"}`,
        `budget=${policy.budget_K}`,
        `maxK=${policy.maxK ?? policy.budget_K}`,
        `lens=${policy.invariance_lens ?? "unspecified"}`,
        `recon=${policy.thresholds?.max_recon_rmse}`,
        `energy=${policy.thresholds?.max_energy_residual}`,
        `band=${policy.thresholds?.max_band_divergence}`,
        `dc=${policy.include_dc ?? true}`,
    ].join(":");
}

function mean(xs) {
    if (!xs.length) return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function defaultBandEdges(Fs) {
    const nyquist = Fs / 2;
    const edges = [0, 1, 4, 8, 16, 32, 64, 128, 256, 512, 1024, nyquist];
    const uniq = [...new Set(edges.filter((x) => x >= 0 && x <= nyquist))].sort((a, b) => a - b);
    if (uniq[uniq.length - 1] !== nyquist) uniq.push(nyquist);
    if (uniq[0] !== 0) uniq.unshift(0);
    return uniq;
}

function makeInputRef(h) {
    return h.state_id;
}
