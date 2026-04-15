// operators/ingest/IngestOp.js

/**
 * IngestOp
 *
 * Layer: Signal Space
 * Authority class: Authoritative (provenance root)
 *
 * Purpose:
 * Convert raw telemetry into an authoritative append-only ClockStreamChunk (A1)
 * without altering signal content. IngestOp is the provenance root: it resolves
 * and anchors stream identity exactly once, and all downstream operators must
 * conserve that lineage.
 *
 * Contract:
 * - accepts raw timestamps[], values[], source descriptors, and clock_policy_id
 * - emits A1 ClockStreamChunk
 * - preserves raw timestamps and values exactly — no reordering, interpolation,
 *   resampling, filtering, alignment, compression, or merging
 * - records ingest and sequence receipts with sampling statistics
 * - stream_id: use caller-supplied value unchanged; if absent, derive
 *   deterministically from stable source descriptors; reject if unresolvable
 * - deterministic: identical input → identical A1 content, stream_id, receipts
 *
 * Non-responsibilities:
 * - does NOT align to any clock grid (ClockAlignOp does that)
 * - does NOT window, transform, compress, or merge
 * - does NOT interpret signal meaning
 * - provenance.input_refs intentionally absent on A1 (IngestOp is the source
 *   artifact producer; downstream operators carry input_refs from A2 onward)
 * - provenance.stream_id_resolution records how stream identity was established
 *
 * Artifact IO:
 *   Input:  raw signal + descriptors
 *   Output: A1 ClockStreamChunk
 *
 * References:
 * - README_WorkflowContract.md (authority and layer boundaries)
 * - README_MasterConstitution.md §6 (naming law, stream_id contract)
 * - OPERATOR_CONTRACTS.md §1
 */

/**
 * @typedef {Object} IngestPolicy
 * @property {string} policy_id
 * @property {number} [gap_threshold_multiplier=3.0] - gap if dt > multiplier * dt_nominal_guess
 * @property {boolean} [allow_non_monotonic=false]
 * @property {boolean} [allow_empty=false]
 * @property {"reject"|"segment"} [non_monotonic_mode="reject"]
 */

/**
 * @typedef {Object} SequenceReceipt
 * @property {number} total_samples
 * @property {number} duplicate_timestamps
 * @property {number} missing_estimated_samples
 * @property {number} segment_count
 */

/**
 * @typedef {Object} IngestReceipt
 * @property {number|null} dt_nominal_guess
 * @property {number|null} dt_p50
 * @property {number|null} dt_p95
 * @property {number|null} dt_p99
 * @property {number|null} jitter_rms
 * @property {number} gap_count
 * @property {number} gap_total_duration
 * @property {number} monotonicity_violations
 * @property {number|null} value_min
 * @property {number|null} value_max
 * @property {number|null} value_mean
 * @property {number|null} value_rms
 * @property {number} ingest_confidence
 */

/**
 * @typedef {Object} ClockStreamChunk
 * @property {string} artifact_type
 * @property {"A1"} artifact_class
 * @property {string} stream_id
 * @property {string|null} source_id
 * @property {string|null} channel
 * @property {string|null} modality
 * @property {number|null} t_first
 * @property {number|null} t_last
 * @property {number[]} timestamps
 * @property {number[]} values
 * @property {Object} meta
 * @property {Object} policies
 * @property {string} policies.clock_policy_id
 * @property {string} policies.ingest_policy_id
 * @property {IngestReceipt} ingest_receipt
 * @property {SequenceReceipt} sequence_receipt
 * @property {Object} provenance
 * @property {string} provenance.operator_id
 * @property {string} provenance.operator_version
 * @property {"derived"|"provided"} provenance.stream_id_resolution
 *
 * Note: provenance.input_refs is intentionally absent on A1.
 * IngestOp is the provenance root: it has no upstream runtime artifact lineage to reference.
 * All downstream operators (ClockAlignOp onward) carry provenance.input_refs.
 * provenance.stream_id_resolution is the source-side provenance field for A1.
 */

/**
 * @typedef {Object} IngestResult
 * @property {true} ok
 * @property {ClockStreamChunk} artifact
 *
 * @typedef {Object} IngestError
 * @property {false} ok
 * @property {string} error
 * @property {string[]} reasons
 *
 * @typedef {IngestResult | IngestError} IngestOutcome
 */

export class IngestOp {
    constructor(cfg = {}) {
        this.operator_id = cfg.operator_id ?? "IngestOp";
        this.operator_version = cfg.operator_version ?? "0.1.0";
    }

    resolveStreamId(input) {
        if (typeof input?.stream_id === "string" && input.stream_id.trim() !== "") {
            return { ok: true, stream_id: input.stream_id.trim(), derived: false };
        }

        const source_id = normalizeToken(input?.source_id);
        const channel = normalizeToken(input?.channel ?? "ch0");
        const modality = normalizeToken(input?.modality);
        const units = normalizeToken(input?.meta?.units);
        const fs_nominal = normalizeFsNominal(input?.meta?.Fs_nominal ?? input?.meta?.fs_nominal);

        const missing = [];
        if (!source_id) missing.push("source_id");
        if (!modality) missing.push("modality");

        if (missing.length > 0) {
            return {
                ok: false,
                error: "UNRESOLVABLE_STREAM_ID",
                reasons: [
                    "stream_id not provided and deterministic stream identity could not be derived",
                    `missing stable source descriptors: ${missing.join(", ")}`
                ],
            };
        }

        return {
            ok: true,
            stream_id: makeStreamId({
                source_id,
                channel: channel ?? "ch0",
                modality,
                units: units ?? "unknown",
                fs_nominal: fs_nominal ?? "na",
            }),
            derived: true,
        };
    }

    run(input) {
        const {
            timestamps,
            values,
            meta = {},
            clock_policy_id,
            ingest_policy,
        } = input ?? {};

        const streamResolution = this.resolveStreamId(input);
        if (!streamResolution.ok) {
            return {
                ok: false,
                error: streamResolution.error,
                reasons: streamResolution.reasons,
            };
        }

        const stream_id = streamResolution.stream_id;
        const reasons = [];

        if (!stream_id || typeof stream_id !== "string") {
            reasons.push("stream_id must be a non-empty string");
        }
        if (!Array.isArray(timestamps)) {
            reasons.push("timestamps must be an array");
        }
        if (!Array.isArray(values)) {
            reasons.push("values must be an array");
        }

        if (reasons.length > 0) {
            return { ok: false, error: "INVALID_SCHEMA", reasons };
        }

        if (timestamps.length !== values.length) {
            reasons.push("timestamps and values length mismatch");
        }

        const allowEmpty = ingest_policy?.allow_empty ?? false;
        if (!allowEmpty && timestamps.length === 0) {
            reasons.push("timestamps empty");
        }

        const timestampsNumeric = timestamps.every((x) => Number.isFinite(x));
        const valuesNumeric = values.every((x) => Number.isFinite(x));

        if (!timestampsNumeric) reasons.push("timestamps contain non-numeric values");
        if (!valuesNumeric) reasons.push("values contain non-numeric values");

        if (reasons.length > 0) {
            return { ok: false, error: "VALIDATION_FAILED", reasons };
        }

        const dts = [];
        let duplicateTimestamps = 0;
        let monotonicityViolations = 0;

        for (let i = 1; i < timestamps.length; i++) {
            const dt = timestamps[i] - timestamps[i - 1];
            dts.push(dt);
            if (dt === 0) duplicateTimestamps += 1;
            if (dt <= 0) monotonicityViolations += 1;
        }

        const allowNonMonotonic = ingest_policy?.allow_non_monotonic ?? false;
        if (!allowNonMonotonic && monotonicityViolations > 0) {
            return {
                ok: false,
                error: "NON_MONOTONIC_TIME",
                reasons: [
                    `monotonicity violations detected: ${monotonicityViolations}`,
                    "IngestOp preserves source ordering and rejects non-monotonic input by default",
                ],
            };
        }

        const dtNominalGuess = robustMedianPositive(dts);
        const dtP50 = percentile(dts, 0.50);
        const dtP95 = percentile(dts, 0.95);
        const dtP99 = percentile(dts, 0.99);
        const jitterRms = rms(dts.map((dt) => (dtNominalGuess == null ? 0 : dt - dtNominalGuess)));

        const gapThresholdMultiplier = ingest_policy?.gap_threshold_multiplier ?? 3.0;
        const gapThreshold =
            dtNominalGuess == null ? Number.POSITIVE_INFINITY : dtNominalGuess * gapThresholdMultiplier;

        let gapCount = 0;
        let gapTotalDuration = 0;
        let missingEstimatedSamples = 0;

        for (const dt of dts) {
            if (dt > gapThreshold) {
                gapCount += 1;
                gapTotalDuration += dt - dtNominalGuess;
                if (dtNominalGuess && dtNominalGuess > 0) {
                    missingEstimatedSamples += Math.max(0, Math.round(dt / dtNominalGuess) - 1);
                }
            }
        }

        const { min: valueMin, max: valueMax } = values.length
            ? finiteMinMax(values)
            : { min: null, max: null };
        const valueMean = values.length ? mean(values) : null;
        const valueRms = values.length ? rms(values) : null;

        const segmentCount = monotonicityViolations > 0 ? monotonicityViolations + 1 : 1;

        const ingestConfidence = computeIngestConfidence({
            monotonicityViolations,
            gapCount,
            jitterRms,
            dtNominalGuess,
            duplicateTimestamps,
            n: timestamps.length,
        });

        /** @type {ClockStreamChunk} */
        const artifact = {
            artifact_type: "ClockStreamChunk",
            artifact_class: "A1",
            stream_id,
            source_id: input?.source_id ?? null,
            channel: input?.channel ?? null,
            modality: input?.modality ?? null,
            t_first: timestamps.length ? timestamps[0] : null,
            t_last: timestamps.length ? timestamps[timestamps.length - 1] : null,
            timestamps: [...timestamps], // preserve exact source order
            values: [...values],         // preserve exact source values
            meta: { ...meta },
            policies: {
                clock_policy_id,
                ingest_policy_id: ingest_policy?.policy_id ?? "ingest_policy_unversioned",
            },
            ingest_receipt: {
                dt_nominal_guess: dtNominalGuess,
                dt_p50: dtP50,
                dt_p95: dtP95,
                dt_p99: dtP99,
                jitter_rms: jitterRms,
                gap_count: gapCount,
                gap_total_duration: gapTotalDuration,
                monotonicity_violations: monotonicityViolations,
                value_min: valueMin,
                value_max: valueMax,
                value_mean: valueMean,
                value_rms: valueRms,
                ingest_confidence: ingestConfidence,
            },
            sequence_receipt: {
                total_samples: timestamps.length,
                duplicate_timestamps: duplicateTimestamps,
                missing_estimated_samples: missingEstimatedSamples,
                segment_count: segmentCount,
            },
            provenance: {
                operator_id: this.operator_id,
                operator_version: this.operator_version,
                stream_id_resolution: streamResolution.derived ? "derived" : "provided",
            },
        };

        return { ok: true, artifact };
    }
}

/**
 * @param {Object} args
 * @param {string} args.source_id
 * @param {string} [args.channel="ch0"]
 * @param {string} [args.modality="unknown"]
 * @param {string} [args.units="unknown"]
 * @param {string|number} [args.fs_nominal="na"]
 */

function makeStreamId({
    source_id,
    channel = "ch0",
    modality = "unknown",
    units = "unknown",
    fs_nominal = "na",
}) {
    return `STR:${source_id}:${channel}:${modality}:${units}:${fs_nominal}`;
}

function normalizeToken(x) {
    if (typeof x !== "string") return null;
    const y = x.trim();
    if (!y) return null;
    return y.replace(/\s+/g, "_");
}

function normalizeFsNominal(x) {
    if (Number.isFinite(x) && x > 0) return String(x);
    if (typeof x === "string" && x.trim() !== "") return x.trim();
    return null;
}

/**
 * Compute extrema without spreading large arrays into Math.min/Math.max,
 * which can overflow the JS call stack on long staged traces.
 *
 * @param {number[]} xs
 * @returns {{ min: number|null, max: number|null }}
 */
function finiteMinMax(xs) {
    if (!Array.isArray(xs) || xs.length === 0) {
        return { min: null, max: null };
    }

    let min = xs[0];
    let max = xs[0];
    for (let i = 1; i < xs.length; i++) {
        const x = xs[i];
        if (x < min) min = x;
        if (x > max) max = x;
    }
    return { min, max };
}

/** @param {number[]} xs */
function mean(xs) {
    if (!xs.length) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** @param {number[]} xs */
function rms(xs) {
    if (!xs.length) return null;
    const m2 = xs.reduce((a, x) => a + x * x, 0) / xs.length;
    return Math.sqrt(m2);
}

/** @param {number[]} xs */
function robustMedianPositive(xs) {
    const ys = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
    if (!ys.length) return null;
    const mid = Math.floor(ys.length / 2);
    return ys.length % 2 === 0 ? (ys[mid - 1] + ys[mid]) / 2 : ys[mid];
}

/**
 * @param {number[]} xs
 * @param {number} p
 */
function percentile(xs, p) {
    const ys = xs.filter(Number.isFinite).sort((a, b) => a - b);
    if (!ys.length) return null;
    const idx = Math.min(ys.length - 1, Math.max(0, Math.floor(p * (ys.length - 1))));
    return ys[idx];
}

/**
 * Heuristic confidence for Door One.
 * Later this can be replaced by your explicit legitimacy vector logic.
 */
function computeIngestConfidence({
    monotonicityViolations,
    gapCount,
    jitterRms,
    dtNominalGuess,
    duplicateTimestamps,
    n,
}) {
    if (!n || n <= 1) return 0.0;
    let score = 1.0;

    if (monotonicityViolations > 0) score -= 0.5;
    if (duplicateTimestamps > 0) score -= Math.min(0.2, duplicateTimestamps / n);
    if (gapCount > 0) score -= Math.min(0.2, gapCount / n);

    if (dtNominalGuess && jitterRms != null) {
        const relJitter = Math.abs(jitterRms / dtNominalGuess);
        score -= Math.min(0.2, relJitter);
    }

    return Math.max(0, Math.min(1, score));
}
