// operators/window/WindowOp.js

/**
 * WindowOp
 *
 * Layer: Structural Space
 * Authority class: Structural
 *
 * Purpose:
 * Partition an aligned stream (A2) into bounded, replayable fixed-width frames
 * (W1) with a declared taper applied. Each W1 is a complete, replayable slice
 * of the aligned signal ready for spectral transform.
 *
 * Contract:
 * - accepts A2 AlignedStreamChunk
 * - emits W1 WindowFrame[]
 * - applies declared window function (hann/hamming/blackman/rectangular)
 *   deterministically; preserves exact aligned slice before taper
 * - records missing_ratio, clipped, padded, and selection_reason per frame
 * - boundary_policy (truncate/pad/mirror_pad) controls partial last window
 * - deterministic given identical A2 + WindowSpec
 *
 * Non-responsibilities:
 * - does NOT transform, compress, detect anomalies, or merge
 * - does NOT re-derive stream identity
 * - mode="adaptive" → UNIMPLEMENTED_MODE in Door One (only "fixed" active)
 * - salience_policy: declared but gate never fires when salience_policy="off"
 *   (Door One default); selection_reason is then "fixed_schedule" or
 *   "boundary_repair" only
 *
 * Artifact IO:
 *   Input:  A2 AlignedStreamChunk
 *   Output: W1 WindowFrame[]
 *
 * References:
 * - README_WorkflowContract.md
 * - README_MasterConstitution.md §3 (structural layer)
 * - OPERATOR_CONTRACTS.md §3
 */

/**
 * @typedef {Object} WindowSpec
 * @property {"fixed"|"adaptive"} mode
 * @property {number} Fs_target
 * @property {number} base_window_N
 * @property {number} hop_N
 * @property {"hann"|"hamming"|"blackman"|"rectangular"} window_function
 * @property {number} [overlap_ratio=0]
 * @property {"strict"|"tolerant"} [stationarity_policy="tolerant"]
 * @property {"off"|"event_driven"|"energy_driven"} [salience_policy="off"]
 * @property {"cut"|"pad_nan"|"hold_last"|"interpolate_small"} [gap_policy="cut"]
 * @property {number} [max_missing_ratio=0.05]
 * @property {"truncate"|"pad"|"mirror_pad"} [boundary_policy="truncate"]
 */

/**
 * @typedef {Object} WindowReceipt
 * @property {number} missing_ratio
 * @property {number} gap_count_within_window
 * @property {number} gap_total_duration
 * @property {boolean} clipped
 * @property {boolean} padded
 * @property {number|null} stationarity_score
 * @property {number|null} salience_score
 * @property {"fixed_schedule"|"salience_trigger"|"boundary_repair"} selection_reason
 * @property {"truncate"|"pad"|"mirror_pad"} boundary_policy
 */

/**
 * @typedef {Object} WindowFrame
 * @property {string} artifact_type
 * @property {"W1"} artifact_class
 * @property {string} stream_id
 * @property {string} window_id
 * @property {Object} grid
 * @property {number} grid.Fs_target
 * @property {number} grid.t0
 * @property {number} grid.N
 * @property {number} grid.hop_N
 * @property {string} grid.window_function
 * @property {number} grid.overlap_ratio
 * @property {Object} samples
 * @property {(number|null)[]} samples.aligned_values_raw
 * @property {(number|null)[]} samples.aligned_values_windowed
 * @property {WindowReceipt} window_receipt
 * @property {Object} policies
 * @property {string} policies.clock_policy_id
 * @property {string} policies.grid_policy_id
 * @property {string} policies.window_policy_id
 * @property {Object} provenance
 * @property {string[]} provenance.input_refs
 * @property {string} provenance.operator_id
 * @property {string} provenance.operator_version
 */

/**
 * @typedef {Object} WindowResult
 * @property {true} ok
 * @property {WindowFrame[]} artifacts
 *
 * @typedef {Object} WindowError
 * @property {false} ok
 * @property {string} error
 * @property {string[]} reasons
 *
 * @typedef {WindowResult|WindowError} WindowOutcome
 */

export class WindowOp {
    /**
     * @param {Object} cfg
     * @param {string} [cfg.operator_id="WindowOp"]
     * @param {string} [cfg.operator_version="0.1.0"]
     */
    constructor(cfg = {}) {
        this.operator_id = cfg.operator_id ?? "WindowOp";
        this.operator_version = cfg.operator_version ?? "0.1.0";
    }

    /**
     * @param {Object} input
     * @param {Object} input.a2
     * @param {string} input.a2.artifact_type
     * @param {"A2"} input.a2.artifact_class
     * @param {string} input.a2.stream_id
     * @param {Object} input.a2.grid
     * @param {number} input.a2.grid.t0
     * @param {number} input.a2.grid.Fs_target
     * @param {number} input.a2.grid.N
     * @param {(number|null)[]} input.a2.aligned_values
     * @param {Object} input.a2.policies
     * @param {WindowSpec} input.window_spec
     * @returns {WindowOutcome}
     */
    run(input) {
        const { a2, window_spec } = input ?? {};
        const reasons = [];

        if (!a2 || a2.artifact_class !== "A2") {
            reasons.push("input.a2 must be a valid A2 AlignedStreamChunk");
        }
        if (!a2.policies?.clock_policy_id || typeof a2.policies.clock_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_A2",
                reasons: ["A2.policies.clock_policy_id must be a valid policy reference"],
            };
        }

        if (!a2.policies?.grid_policy_id || typeof a2.policies.grid_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_A2",
                reasons: ["A2.policies.grid_policy_id must be a valid policy reference"],
            };
        }
        if (!window_spec) {
            reasons.push("window_spec is required");
        }

        if (reasons.length > 0) {
            return { ok: false, error: "INVALID_SCHEMA", reasons };
        }

        const values = a2.aligned_values ?? [];
        const FsA2 = a2.grid?.Fs_target;
        const t0A2 = a2.grid?.t0;
        const NA2 = a2.grid?.N;

        if (!Array.isArray(values) || values.length === 0) {
            return {
                ok: false,
                error: "INVALID_A2",
                reasons: ["A2 must contain non-empty aligned_values"],
            };
        }

        if (values.length !== NA2) {
            return {
                ok: false,
                error: "INVALID_A2",
                reasons: ["A2.grid.N must match aligned_values length"],
            };
        }

        if (window_spec.Fs_target !== FsA2) {
            return {
                ok: false,
                error: "FS_MISMATCH",
                reasons: ["WindowSpec.Fs_target must match A2.grid.Fs_target"],
            };
        }

        const mode = window_spec.mode ?? "fixed";
        if (mode !== "fixed") {
            return {
                ok: false,
                error: "UNIMPLEMENTED_MODE",
                reasons: [`Window mode '${mode}' not yet implemented in Door One stub`],
            };
        }

        const Nw = window_spec.base_window_N;
        const hopN = window_spec.hop_N;
        const maxMissingRatio = window_spec.max_missing_ratio ?? 0.05;
        const boundaryPolicy = window_spec.boundary_policy ?? "truncate";
        const windowFunction = window_spec.window_function ?? "hann";
        const overlapRatio = window_spec.overlap_ratio ?? 0;

        if (!Number.isInteger(Nw) || Nw <= 0) {
            return { ok: false, error: "INVALID_WINDOW_SPEC", reasons: ["base_window_N must be positive integer"] };
        }
        if (!Number.isInteger(hopN) || hopN <= 0) {
            return { ok: false, error: "INVALID_WINDOW_SPEC", reasons: ["hop_N must be positive integer"] };
        }

        const artifacts = [];
        const dt = 1 / FsA2;
        let windowIndex = 0;

        for (let start = 0; start < values.length; start += hopN) {
            const endExclusive = start + Nw;
            let rawSlice = values.slice(start, Math.min(endExclusive, values.length));

            let clipped = false;
            let padded = false;

            if (rawSlice.length < Nw) {
                if (boundaryPolicy === "truncate") {
                    clipped = true;
                    if (rawSlice.length === 0) break;
                } else {
                    rawSlice = applyBoundaryRepair(rawSlice, Nw, boundaryPolicy);
                    padded = true;
                }
            }

            const Nactual = rawSlice.length;
            if (Nactual === 0) break;

            const missingCount = rawSlice.filter((x) => x == null || Number.isNaN(x)).length;
            const missingRatio = missingCount / Nactual;

            const gapInfo = measureInternalGaps(rawSlice, dt);

            if (missingRatio > maxMissingRatio) {
                // Deterministic invalid-window skip for Door One
                // Could later emit invalid W1 artifacts instead of skipping.
                continue;
            }

            const repairedRaw = repairMissing(rawSlice, window_spec.gap_policy ?? "cut");
            const taper = makeWindowVector(windowFunction, repairedRaw.length);
            const windowed = repairedRaw.map((x, i) =>
                x == null || Number.isNaN(x) ? null : x * taper[i]
            );

            const stationarityScore = estimateStationarityScore(repairedRaw);
            const salienceScore = estimateSalienceScore(repairedRaw);
            const windowPolicyId = makeWindowPolicyId(window_spec);
            const t0Window = t0A2 + start * dt;

            /** @type {WindowFrame} */
            const artifact = {
                artifact_type: "WindowFrame",
                artifact_class: "W1",
                stream_id: a2.stream_id,
                window_id: makeWindowId(a2.stream_id, t0Window, repairedRaw.length, windowPolicyId),
                grid: {
                    Fs_target: FsA2,
                    t0: t0Window,
                    N: repairedRaw.length,
                    hop_N: hopN,
                    window_function: windowFunction,
                    overlap_ratio: overlapRatio,
                },
                samples: {
                    aligned_values_raw: [...repairedRaw],
                    aligned_values_windowed: [...windowed],
                },
                window_receipt: {
                    missing_ratio: missingRatio,
                    gap_count_within_window: gapInfo.gap_count,
                    gap_total_duration: gapInfo.gap_total_duration,
                    clipped,
                    padded,
                    stationarity_score: stationarityScore,
                    salience_score: salienceScore,
                    selection_reason: clipped || padded ? "boundary_repair" : "fixed_schedule",
                    boundary_policy: boundaryPolicy,
                },
                policies: {
                    clock_policy_id: a2.policies.clock_policy_id,
                    grid_policy_id: a2.policies.grid_policy_id,
                    window_policy_id: makeWindowPolicyId(window_spec),
                },
                provenance: {
                    input_refs: [makeInputRef(a2)],
                    operator_id: this.operator_id,
                    operator_version: this.operator_version,
                },
            };

            artifacts.push(artifact);
            windowIndex += 1;

            if (endExclusive >= values.length && boundaryPolicy === "truncate") {
                break;
            }
        }

        return { ok: true, artifacts };
    }
}

function applyBoundaryRepair(slice, targetN, boundaryPolicy) {
    const out = [...slice];

    if (boundaryPolicy === "pad") {
        while (out.length < targetN) out.push(null);
        return out;
    }

    if (boundaryPolicy === "mirror_pad") {
        if (out.length === 0) return out;
        while (out.length < targetN) {
            for (let i = out.length - 1; i >= 0 && out.length < targetN; i--) {
                out.push(out[i]);
            }
        }
        return out;
    }

    return out;
}

function repairMissing(slice, gapPolicy) {
    if (gapPolicy === "pad_nan" || gapPolicy === "cut") {
        return slice.map((x) => (x == null ? null : x));
    }

    if (gapPolicy === "hold_last") {
        const out = [];
        let last = null;
        for (const x of slice) {
            if (x == null || Number.isNaN(x)) {
                out.push(last);
            } else {
                last = x;
                out.push(x);
            }
        }
        return out;
    }

    if (gapPolicy === "interpolate_small") {
        return linearFill(slice);
    }

    return slice;
}

function linearFill(slice) {
    const out = [...slice];
    for (let i = 0; i < out.length; i++) {
        if (out[i] == null || Number.isNaN(out[i])) {
            let left = i - 1;
            let right = i + 1;
            while (left >= 0 && (out[left] == null || Number.isNaN(out[left]))) left--;
            while (right < out.length && (out[right] == null || Number.isNaN(out[right]))) right++;

            if (left >= 0 && right < out.length) {
                const alpha = (i - left) / (right - left);
                out[i] = out[left] + alpha * (out[right] - out[left]);
            } else {
                out[i] = null;
            }
        }
    }
    return out;
}

function makeWindowVector(name, N) {
    if (name === "rectangular") return Array.from({ length: N }, () => 1);

    if (name === "hann") {
        return Array.from({ length: N }, (_, n) =>
            N === 1 ? 1 : 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)))
        );
    }

    if (name === "hamming") {
        return Array.from({ length: N }, (_, n) =>
            N === 1 ? 1 : 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1))
        );
    }

    if (name === "blackman") {
        return Array.from({ length: N }, (_, n) =>
            N === 1
                ? 1
                : 0.42
                - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1))
                + 0.08 * Math.cos((4 * Math.PI * n) / (N - 1))
        );
    }

    // default hann
    return Array.from({ length: N }, (_, n) =>
        N === 1 ? 1 : 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)))
    );
}

function measureInternalGaps(slice, dt) {
    let gapCount = 0;
    let missing = 0;
    let inGap = false;

    for (const x of slice) {
        const isMissing = x == null || Number.isNaN(x);
        if (isMissing) {
            missing += 1;
            if (!inGap) {
                gapCount += 1;
                inGap = true;
            }
        } else {
            inGap = false;
        }
    }

    return {
        gap_count: gapCount,
        gap_total_duration: missing * dt,
    };
}

function estimateStationarityScore(values) {
    const xs = values.filter((x) => x != null && !Number.isNaN(x));
    if (xs.length < 4) return null;

    const firstHalf = xs.slice(0, Math.floor(xs.length / 2));
    const secondHalf = xs.slice(Math.floor(xs.length / 2));

    const m1 = mean(firstHalf);
    const m2 = mean(secondHalf);
    const v1 = variance(firstHalf, m1);
    const v2 = variance(secondHalf, m2);

    const meanDrift = Math.abs(m2 - m1);
    const varDrift = Math.abs(v2 - v1);
    const denom = Math.abs(m1) + Math.abs(m2) + v1 + v2 + 1e-9;

    const raw = 1 - Math.min(1, (meanDrift + varDrift) / denom);
    return Math.max(0, Math.min(1, raw));
}

function estimateSalienceScore(values) {
    const xs = values.filter((x) => x != null && !Number.isNaN(x));
    if (xs.length === 0) return null;
    return rms(xs);
}

function mean(xs) {
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function variance(xs, m) {
    if (xs.length === 0) return 0;
    return xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length;
}

function rms(xs) {
    if (xs.length === 0) return null;
    return Math.sqrt(xs.reduce((a, x) => a + x * x, 0) / xs.length);
}

function makeWindowId(streamId, t0, N, windowPolicyId) {
    return `W1:${streamId}:${t0}:${N}:${windowPolicyId}`;
}

function makeInputRef(a2) {
    return `A2:${a2.stream_id}:${a2.grid?.t0}:${a2.grid?.N}`;
}

function makeWindowPolicyId(spec) {
    return [
        "WIN",
        `mode=${spec.mode ?? "fixed"}`,
        `Fs=${spec.Fs_target}`,
        `N=${spec.base_window_N}`,
        `hop=${spec.hop_N}`,
        `fn=${spec.window_function ?? "hann"}`,
        `overlap=${spec.overlap_ratio ?? 0}`,
        `stationarity=${spec.stationarity_policy ?? "tolerant"}`,
        `salience=${spec.salience_policy ?? "off"}`,
        `gap=${spec.gap_policy ?? "cut"}`,
        `maxmiss=${spec.max_missing_ratio ?? 0.05}`,
        `boundary=${spec.boundary_policy ?? "truncate"}`,
    ].join(":");
}