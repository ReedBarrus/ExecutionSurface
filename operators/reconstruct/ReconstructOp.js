// operators/reconstruct/ReconstructOp.js

/**
 * ReconstructOp
 *
 * Layer: Runtime Memory Space (derived / audit operator)
 * Authority class: Derived (non-authoritative replay output)
 *
 * Purpose:
 * Turn stored HarmonicState (H1) or MergedState (M1) artifacts back into a
 * time-domain signal (A3 ReconstructedChunk) for replay, audit, visualization,
 * or downstream conventional analytics. This is the read-side replay gate —
 * it never modifies the artifact lineage.
 *
 * Contract:
 * - accepts H1 or M1
 * - emits A3 ReconstructedChunk (derived, non-authoritative)
 * - inverse spectral transform over kept_bins[]; missing bins handled per
 *   fill_missing_bins policy (ZERO / NOISE_FLOOR / LEAVE_SPARSE)
 * - window_compensation: NONE / HANN_COMPENSATE / OLA (OLA is a Door One stub:
 *   declared but no accumulation performed; receipt note is honest about it)
 * - must not invent, denoise, beautify, or otherwise enhance bins
 * - receipt.expected_energy and receipt.energy_error are null in Door One:
 *   Parseval mapping from spectral→time domain is deferred (wrong comparison
 *   is worse than honest null)
 * - deterministic given identical state + ReconstructPolicy
 *
 * Non-responsibilities:
 * - does NOT modify HarmonicStates or MergedStates
 * - does NOT produce new structural or canonical artifacts
 * - does NOT update runtime memory
 * - A3 exists only for replay/audit/visualization; it is not a pipeline input
 *   to any subsequent operator
 *
 * Artifact IO:
 *   Input:  H1 HarmonicState or M1 MergedState
 *   Output: A3 ReconstructedChunk
 *
 * References:
 * - README_WorkflowContract.md
 * - README_MasterConstitution.md §3 (runtime memory layer)
 * - OPERATOR_CONTRACTS.md §8
 */

/**
 * @typedef {"ZERO"|"NOISE_FLOOR"|"LEAVE_SPARSE"} MissingBinPolicy
 * @typedef {"NONE"|"HANN_COMPENSATE"|"OLA"} WindowCompensation
 * @typedef {"values"|"timestamps_and_values"} OutputFormat
 */

/**
 * @typedef {Object} ReconstructPolicy
 * @property {string} policy_id
 * @property {OutputFormat} output_format
 * @property {number|null} [t0_override=null]
 * @property {MissingBinPolicy} fill_missing_bins
 * @property {boolean} validate_invariants
 * @property {WindowCompensation} window_compensation
 * @property {"strict"|"tolerant"} [numeric_policy="tolerant"]
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
 * @typedef {Object} HarmonicLike
 * @property {"H1"|"M1"} artifact_class
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
 * @property {number} [invariants.energy_raw]
 * @property {Object} [receipts]
 * @property {Object} [policies]
 */

/**
 * @typedef {Object} ReconstructReceipt
 * @property {string} replay_mode
 * @property {string} normalization_mode_applied
 * @property {string[]} source_artifact_ids
 * @property {string|null} source_artifact_class
 * @property {MissingBinPolicy} missing_bin_policy
 * @property {WindowCompensation} window_compensation
 * @property {number|null} expected_energy
 * @property {number} reconstructed_energy
 * @property {number|null} energy_error
 * @property {string[]} notes
 */

/**
 * @typedef {Object} ReconstructedChunk
 * @property {string} artifact_type
 * @property {"A3"} artifact_class
 * @property {string} stream_id
 * @property {number} t0
 * @property {Object} grid
 * @property {number} grid.Fs_target
 * @property {number} grid.N
 * @property {number[]} [timestamps]
 * @property {number[]} values
 * @property {ReconstructReceipt} reconstruct_receipt
 * @property {Object} policies
 * @property {string} policies.reconstruct_policy_id
 * @property {string} [policies.clock_policy_id]
 * @property {string} [policies.grid_policy_id]
 * @property {string} [policies.window_policy_id]
 * @property {string} [policies.transform_policy_id]
 * @property {string} [policies.compression_policy_id]
 * @property {string} [policies.merge_policy_id]
 * @property {Object} provenance
 * @property {string[]} provenance.input_refs
 * @property {string} provenance.operator_id
 * @property {string} provenance.operator_version
 */

/**
 * @typedef {Object} ReconstructSuccess
 * @property {true} ok
 * @property {ReconstructedChunk} artifact
 *
 * @typedef {Object} ReconstructError
 * @property {false} ok
 * @property {string} error
 * @property {string[]} reasons
 *
 * @typedef {ReconstructSuccess | ReconstructError} ReconstructOutcome
 */

export class ReconstructOp {
    /**
     * @param {Object} cfg
     * @param {string} [cfg.operator_id="ReconstructOp"]
     * @param {string} [cfg.operator_version="0.1.0"]
     */
    constructor(cfg = {}) {
        this.operator_id = cfg.operator_id ?? "ReconstructOp";
        this.operator_version = cfg.operator_version ?? "0.1.0";
    }

    /**
     * @param {Object} input
     * @param {HarmonicLike} input.state
     * @param {ReconstructPolicy} input.reconstruct_policy
     * @returns {ReconstructOutcome}
     */
    run(input) {
        const { state, reconstruct_policy } = input ?? {};
        const reasons = [];

        if (!state || (state.artifact_class !== "H1" && state.artifact_class !== "M1")) {
            reasons.push("input.state must be a valid H1 or M1 artifact");
        }
        if (!reconstruct_policy) {
            reasons.push("reconstruct_policy is required");
        }

        if (reasons.length > 0) {
            return { ok: false, error: "INVALID_SCHEMA", reasons };
        }

        const Fs = state.grid?.Fs_target;
        const N = state.grid?.N;
        // kept_bins must be validated before use: an empty array silently produces
        // an all-zero waveform with no error, fabricating a "successful" reconstruction.
        if (!Array.isArray(state.kept_bins) || state.kept_bins.length === 0) {
            return {
                ok: false,
                error: "INVALID_STATE",
                reasons: ["state.kept_bins must be a non-empty array"],
            };
        }
        const keptBins = state.kept_bins;

        if (!Number.isFinite(Fs) || Fs <= 0) {
            return {
                ok: false,
                error: "INVALID_STATE",
                reasons: ["state.grid.Fs_target must be a positive finite number"],
            };
        }

        if (!Number.isInteger(N) || N <= 0) {
            return {
                ok: false,
                error: "INVALID_STATE",
                reasons: ["state.grid.N must be a positive integer"],
            };
        }

        const t0 = reconstruct_policy.t0_override ?? state.window_span?.t_start;
        if (!Number.isFinite(t0)) {
            return {
                ok: false,
                error: "INVALID_STATE",
                reasons: ["state must provide window_span.t_start or policy.t0_override"],
            };
        }

        if (!state.policies?.compression_policy_id || typeof state.policies.compression_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_STATE",
                reasons: ["state.policies.compression_policy_id must be a valid policy reference"],
            };
        }
        if (!state.policies?.clock_policy_id || typeof state.policies.clock_policy_id !== "string") {
            return { ok: false, error: "INVALID_STATE", reasons: ["state.policies.clock_policy_id must be a valid policy reference"] };
        }
        if (!state.policies?.grid_policy_id || typeof state.policies.grid_policy_id !== "string") {
            return { ok: false, error: "INVALID_STATE", reasons: ["state.policies.grid_policy_id must be a valid policy reference"] };
        }
        if (!state.policies?.window_policy_id || typeof state.policies.window_policy_id !== "string") {
            return { ok: false, error: "INVALID_STATE", reasons: ["state.policies.window_policy_id must be a valid policy reference"] };
        }
        if (!state.policies?.transform_policy_id || typeof state.policies.transform_policy_id !== "string") {
            return { ok: false, error: "INVALID_STATE", reasons: ["state.policies.transform_policy_id must be a valid policy reference"] };
        }
        if (state.artifact_class === "M1" && (!state.policies?.merge_policy_id || typeof state.policies.merge_policy_id !== "string")) {
            return { ok: false, error: "INVALID_STATE", reasons: ["M1 replay requires state.policies.merge_policy_id"] };
        }
        const missingPolicy = reconstruct_policy.fill_missing_bins;
        const windowCompensation = reconstruct_policy.window_compensation;
        const outputFormat = reconstruct_policy.output_format;

        if (!missingPolicy) {
            return {
                ok: false,
                error: "INVALID_POLICY",
                reasons: ["reconstruct_policy.fill_missing_bins must be specified"],
            };
        }

        if (!windowCompensation) {
            return {
                ok: false,
                error: "INVALID_POLICY",
                reasons: ["reconstruct_policy.window_compensation must be specified"],
            };
        }

        if (!outputFormat) {
            return {
                ok: false,
                error: "INVALID_POLICY",
                reasons: ["reconstruct_policy.output_format must be specified"],
            };
        }

        // Build full complex spectrum from sparse kept bins.
        const X = buildFullSpectrum({
            keptBins,
            N,
            missingPolicy,
        });

        // Inverse transform and normalization.
        const normalizationMode = state.policies?.transform_policy_id?.includes("norm=forward_1_over_N")
            ? "forward_1_over_N"
            : state.policies?.transform_policy_id?.includes("norm=unitary")
                ? "unitary"
                : "forward_raw";

        let values = inverseFromComplex(X, normalizationMode);
        // Optional reconstruction-side window compensation.
        const notes = [];
        if (windowCompensation === "HANN_COMPENSATE") {
            values = compensateHann(values);
            notes.push("Applied approximate Hann compensation");
        } else if (windowCompensation === "OLA") {
            // Single-window Door One stub: declare but do not fake full range overlap-add.
            notes.push("OLA declared; single-window stub performed no overlap-add accumulation");
        }

        const timestamps = Array.from({ length: N }, (_, i) => t0 + i / Fs);

        const replayMode = inferReplayMode(state);
        const reconstructedEnergy = sumSquares(values);

        // expected_energy and energy_error are null for all replay modes in Door One.
        // Reason: state.invariants.energy_raw is spectral-domain energy; reconstructed_energy
        // is time-domain energy. These are not comparable without a Parseval mapping that
        // accounts for normalization, missing bins, and window compensation. Setting
        // expected_energy = reconstructedEnergy and energy_error = 0 would imply a
        // comparison was made when none was -- a dishonest sentinel.
        // Honest representation: null = not measured / not computable in this layer.
        const expectedEnergy = null;
        const energyError = null;

        if (replayMode === "window_direct") {
            notes.push(
                "H1 direct replay: reconstructed_energy is measured; expected_energy is null " +
                "because spectral-to-time Parseval mapping is not yet defined for this normalization."
            );
        } else if (replayMode === "merged_lens") {
            notes.push(
                "M1 merged-lens replay: energy comparison disabled. " +
                "Merged-state replay is interpretive across multiple windows."
            );
        } else {
            notes.push("Energy comparison unavailable for this artifact class.");
        }

        // normalizationMode is derived from transform_policy_id string.
        // Emitted in receipt so callers can audit which inverse normalization was applied.
        const sourceArtifactClass = state?.artifact_class ?? null;
        const reconstruct_receipt = {
            replay_mode: replayMode,
            normalization_mode_applied: normalizationMode,
            // state_id is required and validated upstream; no fallback to "UNKNOWN"
            // because a fabricated source ID in a replay receipt is dishonest.
            source_artifact_ids: [state.state_id],
            missing_bin_policy: reconstruct_policy.fill_missing_bins,
            window_compensation: reconstruct_policy.window_compensation,
            expected_energy: expectedEnergy,
            reconstructed_energy: reconstructedEnergy,
            energy_error: energyError,
            source_artifact_class: sourceArtifactClass,
            notes
        };
        /** @type {ReconstructedChunk} */
        const artifact = {
            artifact_type: "ReconstructedChunk",
            artifact_class: "A3",
            stream_id: state.stream_id,
            t0,
            grid: {
                Fs_target: Fs,
                N,
            },
            ...(outputFormat === "timestamps_and_values"
                ? { timestamps, values }
                : { values }),
            reconstruct_receipt,
            policies: {
                reconstruct_policy_id: makeReconstructPolicyId(reconstruct_policy),
                clock_policy_id: state.policies?.clock_policy_id,
                grid_policy_id: state.policies?.grid_policy_id,
                window_policy_id: state.policies?.window_policy_id,
                transform_policy_id: state.policies?.transform_policy_id,
                compression_policy_id: state.policies?.compression_policy_id,
                merge_policy_id: state.policies?.merge_policy_id,
            },
            provenance: {
                input_refs: [makeInputRef(state)],
                operator_id: this.operator_id,
                operator_version: this.operator_version,
            },
        };

        return { ok: true, artifact };
    }
}

function makeReconstructPolicyId(policy) {
    return [
        "RECON",
        `pid=${policy.policy_id ?? "unspecified"}`,
        `format=${policy.output_format ?? "values"}`,
        `t0=${policy.t0_override ?? "state"}`,
        `missing=${policy.fill_missing_bins ?? "ZERO"}`,
        `validate=${policy.validate_invariants ?? false}`,
        `window=${policy.window_compensation ?? "NONE"}`,
        `numeric=${policy.numeric_policy ?? "tolerant"}`,
    ].join(":");
}

function inferReplayMode(state) {
    const cls = state?.artifact_class ?? null;

    if (cls === "H1") {
        return "window_direct";
    }

    if (cls === "M1") {
        return "merged_lens";
    }

    return "generic";
}

/**
 * @param {Object} args
 * @param {KeptBin[]} args.keptBins
 * @param {number} args.N
 * @param {MissingBinPolicy} args.missingPolicy
 * @returns {{re:number, im:number}[]}
 */
function buildFullSpectrum({ keptBins, N, missingPolicy }) {
    const X = new Array(N).fill(null).map(() => ({ re: 0, im: 0 }));
    const byK = new Map((keptBins ?? []).map((b) => [b.k, b]));
    const kMax = Math.floor(N / 2);

    const noiseFloor = estimateNoiseFloor(keptBins);

    for (let k = 0; k <= kMax; k++) {
        const b = byK.get(k);

        if (b) {
            X[k] = { re: b.re, im: b.im };
        } else if (missingPolicy === "NOISE_FLOOR") {
            X[k] = { re: noiseFloor, im: 0 };
        } else if (missingPolicy === "LEAVE_SPARSE") {
            X[k] = { re: 0, im: 0 };
        } else {
            // ZERO
            X[k] = { re: 0, im: 0 };
        }

        // Mirror conjugate for real-input signal, excluding DC and Nyquist.
        if (k > 0 && k < N - k) {
            X[N - k] = { re: X[k].re, im: -X[k].im };
        }
    }

    return X;
}

/**
 * Deterministic inverse transform for Door One.
 * @param {{re:number, im:number}[]} X
 * @returns {number[]}
 */
function inverseFromComplex(X, normalizationMode = "forward_1_over_N") {
    const N = X.length;
    const x = new Array(N).fill(0);

    for (let n = 0; n < N; n++) {
        let sum = 0;
        for (let k = 0; k < N; k++) {
            const theta = (2 * Math.PI * k * n) / N;
            sum += X[k].re * Math.cos(theta) - X[k].im * Math.sin(theta);
        }

        if (normalizationMode === "forward_raw") {
            x[n] = sum / N;
        } else if (normalizationMode === "forward_1_over_N") {
            x[n] = sum;
        } else if (normalizationMode === "unitary") {
            x[n] = sum / Math.sqrt(N);
        } else {
            x[n] = sum / N;
        }
    }

    return x;
}

/**
 * Approximate inverse Hann compensation.
 * Clamped for numerical safety.
 * @param {number[]} values
 * @returns {number[]}
 */
function compensateHann(values) {
    const N = values.length;
    const eps = 1e-6;
    return values.map((v, n) => {
        const w =
            N === 1 ? 1 : 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
        const denom = Math.max(w, eps);
        return v / denom;
    });
}

/**
 * @param {KeptBin[]} bins
 * @returns {number}
 */
function estimateNoiseFloor(bins) {
    if (!bins || bins.length === 0) return 0;
    const mags = bins.map((b) => Math.abs(b.magnitude)).sort((a, b) => a - b);
    const idx = Math.floor(0.1 * (mags.length - 1));
    return mags[idx] ?? 0;
}

/**
 * @param {number[]} xs
 * @returns {number}
 */
function sumSquares(xs) {
    let s = 0;
    for (const x of xs) s += x * x;
    return s;
}

/**
 * @param {HarmonicLike} state
 * @returns {string}
 */
function makeInputRef(state) {
    return state.state_id;
}