// operators/clock/ClockAlignOp.js

/**
 * ClockAlignOp
 *
 * Layer: Structural Space
 * Authority class: Structural
 *
 * Purpose:
 * Reconcile device time with the canonical system clock grid, mapping an A1
 * ClockStreamChunk onto a uniform-rate grid defined by GridSpec. This is the
 * structural alignment step that makes all downstream window/transform/compress
 * operations coordinate-consistent.
 *
 * Contract:
 * - accepts A1 ClockStreamChunk
 * - emits A2 AlignedStreamChunk
 * - interpolates to target sample rate; records gap and non-monotonic handling
 * - optional drift correction via linear_fit: logs drift_ppm, offset_ms,
 *   fit_residual_rms; all null when drift_model="none"
 * - never mutates A1
 * - deterministic given identical A1 + GridSpec
 *
 * Non-responsibilities:
 * - does NOT window, transform, compress, or detect anomalies
 * - does NOT re-derive stream identity (conserves A1.stream_id)
 * - anti_alias_filter: declared in GridSpec but NOT applied in Door One;
 *   anti_alias_filter_applied=false always; anti_alias_filter_declared records
 *   the request so the omission is auditable
 * - non_monotonic_policy="split"|"tolerate" → UNIMPLEMENTED_POLICY in Door One;
 *   only "reject" is active
 *
 * Artifact IO:
 *   Input:  A1 ClockStreamChunk
 *   Output: A2 AlignedStreamChunk
 *
 * References:
 * - README_WorkflowContract.md
 * - README_MasterConstitution.md §3 (structural layer)
 * - OPERATOR_CONTRACTS.md §2
 */

/**
 * @typedef {Object} GridSpec
 * @property {number} Fs_target
 * @property {number} t_ref
 * @property {"strict"|"tolerant"} [grid_policy="strict"]
 * @property {"none"|"linear_fit"} [drift_model="none"]
 * @property {"reject"|"split"|"tolerate"} [non_monotonic_policy="reject"]
 * @property {"linear"|"zoh"} [interp_method="linear"]
 * @property {"cut"|"fill_nan"|"hold_last"|"interpolate_small"} [gap_policy="cut"]
 * @property {number} [small_gap_multiplier=3.0]
 * @property {number|null} [max_gap_seconds=null]
 * @property {boolean} [anti_alias_filter=false]
 */

/**
 * @typedef {Object} AlignmentReceipt
 * @property {"none"|"linear_fit"} drift_model
 * @property {number|null} drift_ppm
 * @property {number|null} offset_ms
 * @property {number|null} fit_residual_rms
 * @property {"linear"|"zoh"} interp_method
 * @property {string} anti_alias_filter
 * @property {number} downsample_ratio
 * @property {"cut"|"fill_nan"|"hold_last"|"interpolate_small"} gap_policy
 * @property {number} gap_count
 * @property {number|null} post_align_jitter
 * @property {"reject"|"split"|"tolerate"} non_monotonic_policy
 */

/**
 * @typedef {Object} AlignedStreamChunk
 * @property {string} artifact_type
 * @property {"A2"} artifact_class
 * @property {string} stream_id
 * @property {Object} grid
 * @property {number} grid.t0
 * @property {number} grid.Fs_target
 * @property {number} grid.N
 * @property {(number|null)[]} aligned_values
 * @property {AlignmentReceipt} alignment_receipt
 * @property {Object} policies
 * @property {string} policies.clock_policy_id
 * @property {string} policies.grid_policy_id
 * @property {Object} provenance
 * @property {string[]} provenance.input_refs
 * @property {string} provenance.operator_id
 * @property {string} provenance.operator_version
 */

/**
 * @typedef {Object} ClockAlignResult
 * @property {true} ok
 * @property {AlignedStreamChunk} artifact
 *
 * @typedef {Object} ClockAlignError
 * @property {false} ok
 * @property {string} error
 * @property {string[]} reasons
 *
 * @typedef {ClockAlignResult | ClockAlignError} ClockAlignOutcome
 */

export class ClockAlignOp {
    /**
     * @param {Object} cfg
     * @param {string} [cfg.operator_id="ClockAlignOp"]
     * @param {string} [cfg.operator_version="0.1.0"]
     */
    constructor(cfg = {}) {
        this.operator_id = cfg.operator_id ?? "ClockAlignOp";
        this.operator_version = cfg.operator_version ?? "0.1.0";
    }

    /**
     * @param {Object} input
     * @param {Object} input.a1
     * @param {string} input.a1.artifact_type
     * @param {"A1"} input.a1.artifact_class
     * @param {string} input.a1.stream_id
     * @param {number[]} input.a1.timestamps
     * @param {number[]} input.a1.values
     * @param {Object} input.a1.policies
     * @param {Object} [input.a1.provenance]
     * @param {GridSpec} input.grid_spec
     * @returns {ClockAlignOutcome}
     */
    run(input) {
        const { a1, grid_spec } = input ?? {};
        const reasons = [];

        if (!a1 || a1.artifact_class !== "A1") {
            reasons.push("input.a1 must be a valid A1 ClockStreamChunk");
        }
        if (!grid_spec || !Number.isFinite(grid_spec.Fs_target) || grid_spec.Fs_target <= 0) {
            reasons.push("grid_spec.Fs_target must be a positive finite number");
        }
        if (!grid_spec || !Number.isFinite(grid_spec.t_ref)) {
            reasons.push("grid_spec.t_ref must be a finite number");
        }
        if (!a1.policies?.clock_policy_id || typeof a1.policies.clock_policy_id !== "string") {
            reasons.push("input.a1.policies.clock_policy_id must be a valid policy reference");
        }
        if (reasons.length > 0) {
            return { ok: false, error: "INVALID_SCHEMA", reasons };
        }

        const timestamps = a1.timestamps ?? [];
        const values = a1.values ?? [];

        if (timestamps.length !== values.length || timestamps.length === 0) {
            return {
                ok: false,
                error: "INVALID_A1",
                reasons: ["A1 timestamps/values must be same length and non-empty"],
            };
        }

        // 1) Timestamp normalization / monotonicity handling
        const monoCheck = checkMonotonic(timestamps);
        const nonMonotonicPolicy = grid_spec.non_monotonic_policy ?? "reject";

        if (!monoCheck.monotonic && nonMonotonicPolicy === "reject") {
            return {
                ok: false,
                error: "NON_MONOTONIC_TIME",
                reasons: ["A1 timestamps are non-monotonic and policy is reject"],
            };
        }

        // Door One stub: split/tolerate are declared but not fully implemented
        if (!monoCheck.monotonic && nonMonotonicPolicy !== "reject") {
            return {
                ok: false,
                error: "UNIMPLEMENTED_POLICY",
                reasons: [`non_monotonic_policy=${nonMonotonicPolicy} not yet implemented`],
            };
        }

        // 2) Drift estimation
        const driftModel = grid_spec.drift_model ?? "none";
        let tNorm = [...timestamps];
        let driftPpm = null;
        let offsetMs = null;
        let fitResidualRms = null;

        if (driftModel === "linear_fit") {
            const fit = fitLinearClockModel(timestamps, grid_spec.Fs_target, grid_spec.t_ref);
            tNorm = fit.corrected_timestamps;
            driftPpm = fit.drift_ppm;
            offsetMs = fit.offset_ms;
            fitResidualRms = fit.fit_residual_rms;
        }

        // 3) Build canonical grid
        const Fs = grid_spec.Fs_target;
        const dt = 1 / Fs;
        const tStart = alignStartTime(tNorm[0], grid_spec.t_ref, Fs);
        const tEnd = tNorm[tNorm.length - 1];
        const N = Math.max(1, Math.floor((tEnd - tStart) * Fs) + 1);

        if (!Number.isFinite(N) || N <= 0) {
            return {
                ok: false,
                error: "INVALID_GRID",
                reasons: ["failed to construct canonical grid"],
            };
        }

        // 4) Gap handling + resampling
        const interpMethod = grid_spec.interp_method ?? "linear";
        const gapPolicy = grid_spec.gap_policy ?? "cut";
        const smallGapMultiplier = grid_spec.small_gap_multiplier ?? 3.0;

        const dtNominalGuess = a1.ingest_receipt?.dt_nominal_guess ?? robustMedianPositive(diff(tNorm));
        const smallGapThreshold =
            dtNominalGuess && Number.isFinite(dtNominalGuess)
                ? dtNominalGuess * smallGapMultiplier
                : Infinity;

        const gaps = detectGaps(tNorm, dtNominalGuess, smallGapThreshold);
        const alignedValues = new Array(N);

        for (let i = 0; i < N; i++) {
            const tq = tStart + i * dt;
            alignedValues[i] = sampleAtTime({
                tq,
                timestamps: tNorm,
                values,
                interpMethod,
                gapPolicy,
                smallGapThreshold,
            });
        }

        const postAlignJitter = estimatePostAlignJitter(tNorm, tStart, Fs);

        /** @type {AlignedStreamChunk} */
        const artifact = {
            artifact_type: "AlignedStreamChunk",
            artifact_class: "A2",
            stream_id: a1.stream_id,
            grid: {
                t0: tStart,
                Fs_target: Fs,
                N,
            },
            aligned_values: alignedValues,
            alignment_receipt: {
                drift_model: driftModel,
                drift_ppm: driftPpm,
                offset_ms: offsetMs,
                fit_residual_rms: fitResidualRms,
                interp_method: interpMethod,
                // anti_alias_filter is declared in policy but not applied in Door One stub.
                // anti_alias_filter_applied is always false here.
                // anti_alias_filter_declared preserves what the policy requested for audit.
                anti_alias_filter_applied: false,
                anti_alias_filter_declared: grid_spec.anti_alias_filter ?? false,
                downsample_ratio: inferDownsampleRatio(dtNominalGuess, Fs),
                gap_policy: gapPolicy,
                gap_count: gaps.length,
                post_align_jitter: postAlignJitter,
                non_monotonic_policy: nonMonotonicPolicy,
            },
            policies: {
                clock_policy_id: a1.policies.clock_policy_id,
                grid_policy_id: makeGridPolicyId({
                    Fs_target: grid_spec.Fs_target,
                    t_ref: grid_spec.t_ref,
                    grid_policy: grid_spec.grid_policy ?? "strict",
                    drift_model: driftModel,
                    non_monotonic_policy: nonMonotonicPolicy,
                    interp_method: interpMethod,
                    gap_policy: gapPolicy,
                    small_gap_multiplier: grid_spec.small_gap_multiplier ?? 3.0,
                    max_gap_seconds: grid_spec.max_gap_seconds ?? null,
                    anti_alias_filter: grid_spec.anti_alias_filter ?? false,
                }),
            },
            provenance: {
                input_refs: [makeInputRef(a1)],
                operator_id: this.operator_id,
                operator_version: this.operator_version,
            },
        };

        return { ok: true, artifact };
    }
}

/** @param {number[]} xs */
function diff(xs) {
    const out = [];
    for (let i = 1; i < xs.length; i++) out.push(xs[i] - xs[i - 1]);
    return out;
}

/** @param {number[]} xs */
function robustMedianPositive(xs) {
    const ys = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
    if (!ys.length) return null;
    const mid = Math.floor(ys.length / 2);
    return ys.length % 2 === 0 ? (ys[mid - 1] + ys[mid]) / 2 : ys[mid];
}

/** @param {number[]} timestamps */
function checkMonotonic(timestamps) {
    for (let i = 1; i < timestamps.length; i++) {
        if (!(timestamps[i] > timestamps[i - 1])) {
            return { monotonic: false };
        }
    }
    return { monotonic: true };
}

/**
 * Fit t_device ≈ a * t_grid + b, then invert to corrected timestamps.
 * Door One pragmatic linear model.
 */
function fitLinearClockModel(timestamps, Fs, tRef) {
    const n = timestamps.length;
    const gridTimes = new Array(n);
    const dtGuess = robustMedianPositive(diff(timestamps)) ?? 1 / Fs;

    for (let i = 0; i < n; i++) {
        gridTimes[i] = tRef + i * dtGuess;
    }

    const { a, b } = linearRegression(gridTimes, timestamps);
    const corrected = timestamps.map((td) => (td - b) / a);

    const residuals = timestamps.map((td, i) => td - (a * gridTimes[i] + b));
    const fitResidualRms = rms(residuals);

    return {
        corrected_timestamps: corrected,
        drift_ppm: (a - 1) * 1e6,
        offset_ms: b * 1000,
        fit_residual_rms: fitResidualRms,
    };
}

function makeGridPolicyId(spec) {
    return [
        "GRID",
        `Fs=${spec.Fs_target}`,
        `tref=${spec.t_ref}`,
        `grid=${spec.grid_policy}`,
        `drift=${spec.drift_model}`,
        `nonmono=${spec.non_monotonic_policy}`,
        `interp=${spec.interp_method}`,
        `gap=${spec.gap_policy}`,
        `smallgap=${spec.small_gap_multiplier}`,
        `maxgap=${spec.max_gap_seconds ?? "null"}`,
        `aa=${spec.anti_alias_filter}`,
    ].join(":");
}

function linearRegression(xs, ys) {
    const n = xs.length;
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let den = 0;

    for (let i = 0; i < n; i++) {
        const dx = xs[i] - mx;
        num += dx * (ys[i] - my);
        den += dx * dx;
    }

    const a = den === 0 ? 1 : num / den;
    const b = my - a * mx;
    return { a, b };
}

function mean(xs) {
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function rms(xs) {
    if (!xs.length) return null;
    const m2 = xs.reduce((a, x) => a + x * x, 0) / xs.length;
    return Math.sqrt(m2);
}

function alignStartTime(tFirst, tRef, Fs) {
    const dt = 1 / Fs;
    const n0 = Math.ceil((tFirst - tRef) / dt);
    return tRef + n0 * dt;
}

function detectGaps(timestamps, dtNominalGuess, gapThreshold) {
    if (!dtNominalGuess || !Number.isFinite(dtNominalGuess)) return [];
    const gaps = [];
    for (let i = 1; i < timestamps.length; i++) {
        const dt = timestamps[i] - timestamps[i - 1];
        if (dt > gapThreshold) {
            gaps.push({
                i0: i - 1,
                i1: i,
                dt,
            });
        }
    }
    return gaps;
}

function sampleAtTime({ tq, timestamps, values, interpMethod, gapPolicy, smallGapThreshold }) {
    if (tq < timestamps[0] || tq > timestamps[timestamps.length - 1]) {
        return null;
    }

    let i = binarySearchLeft(timestamps, tq);
    if (i <= 0) i = 1;
    if (i >= timestamps.length) i = timestamps.length - 1;

    const t0 = timestamps[i - 1];
    const t1 = timestamps[i];
    const v0 = values[i - 1];
    const v1 = values[i];
    const localGap = t1 - t0;

    if (localGap > smallGapThreshold) {
        if (gapPolicy === "fill_nan" || gapPolicy === "cut") return null;
        if (gapPolicy === "hold_last") return v0;
        if (gapPolicy === "interpolate_small") return null;
    }

    if (interpMethod === "zoh") {
        return v0;
    }

    // default linear
    if (t1 === t0) return v0;
    const alpha = (tq - t0) / (t1 - t0);
    return v0 + alpha * (v1 - v0);
}

function binarySearchLeft(xs, x) {
    let lo = 0;
    let hi = xs.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (xs[mid] < x) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

function estimatePostAlignJitter(timestamps, t0, Fs) {
    const dt = 1 / Fs;
    const residuals = timestamps.map((t) => {
        const n = Math.round((t - t0) / dt);
        const tg = t0 + n * dt;
        return t - tg;
    });
    return rms(residuals);
}

function inferDownsampleRatio(dtNominalGuess, FsTarget) {
    if (!dtNominalGuess || !Number.isFinite(dtNominalGuess)) return 1;
    const FsIn = 1 / dtNominalGuess;
    return FsIn / FsTarget;
}

function makeInputRef(a1) {
    const start = a1.t_first ?? "na";
    const end = a1.t_last ?? "na";
    return `A1:${a1.stream_id}:${start}:${end}`;
}