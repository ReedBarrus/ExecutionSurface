// operators/sampler/RmsEnvelopeAdapter.js
//
// RMS / energy-envelope derived trace adapter
//
// Purpose:
//   Derive an RMS energy-envelope trace from a raw sampled signal without
//   altering the raw signal or any downstream pipeline operator.
//
// Layer: Signal Space (pre-ingest derived-trace adapter)
// Authority class: none — this is a pre-ingest derivation helper, not a
//   pipeline operator and not an artifact-producing operator in the canonical
//   sense. Its output normalizes to the lawful Door One raw ingest contract.
//
// Boundary contract:
//   - does NOT modify the parent (raw) signal values or timestamps
//   - does NOT enter the pipeline automatically — caller must route explicitly
//   - derived trace is a SIBLING observation family, not a replacement
//   - output carries explicit provenance linking back to parent source
//   - source_mode: "derived_trace" distinguishes from raw amplitude path
//   - derived_trace_type: "rms_envelope" distinguishes from future trace types
//   - preserve parent_source_id and parent_stream_id for lineage tracing
//   - no canon logic, no prediction logic, no ontology
//
// What it produces:
//   Given raw { values, timestamps } at Fs_raw Hz:
//   - divide into non-overlapping frames of rms_window_N samples
//   - compute RMS energy per frame: sqrt(mean(x^2))
//   - produce envelope { values, timestamps } at Fs_env = Fs_raw / rms_window_N Hz
//   - normalize to the same lawful ingest input shape as raw amplitude path
//
// Usage:
//   import { RmsEnvelopeAdapter } from '../operators/sampler/RmsEnvelopeAdapter.js';
//   const adapter = new RmsEnvelopeAdapter({ rms_window_N: 16, Fs_raw: 256 });
//   const envelopeInput = adapter.derive({ values, timestamps, parentSpec });
//
// References:
//   - README_DoorOneAdapterPolicy.md (pre-ingest adapter posture)
//   - README_MasterConstitution.md §3 (signal layer)
//   - README_DoorOneRuntimeBoundary.md (read-side posture)

/**
 * @typedef {Object} RmsEnvelopeConfig
 * @property {number} rms_window_N        — samples per RMS frame (must divide evenly into signal)
 * @property {number} Fs_raw              — nominal sample rate of the parent raw signal (Hz)
 * @property {string} [clock_policy_id]   — passed through to ingest contract
 * @property {string} [ingest_policy_id]  — passed through to ingest contract
 */

/**
 * @typedef {Object} DeriveInput
 * @property {number[]} values            — raw signal values
 * @property {number[]} timestamps        — raw signal timestamps (seconds)
 * @property {Object}  parentSpec         — cohort or source spec with source_id, label, etc.
 * @property {string}  [parent_stream_id] — optional: stream_id of the parent raw ingest artifact
 */

/**
 * @typedef {Object} EnvelopeIngestInput
 * Normalized to the lawful Door One raw ingest contract.
 * @property {number[]}  timestamps
 * @property {number[]}  values
 * @property {string}    stream_id
 * @property {string}    source_id
 * @property {string}    channel
 * @property {string}    modality
 * @property {string}    clock_policy_id
 * @property {Object}    meta
 * @property {string}    meta.units
 * @property {number}    meta.Fs_nominal
 * @property {string}    meta.source_mode
 * @property {string}    meta.derived_trace_type
 * @property {string}    meta.parent_source_id
 * @property {string|null} meta.parent_stream_id
 * @property {number}    meta.rms_window_N
 * @property {number}    meta.rms_window_duration_sec
 * @property {number}    meta.Fs_raw
 * @property {number}    meta.envelope_frames
 */

export class RmsEnvelopeAdapter {
    /**
     * @param {RmsEnvelopeConfig} cfg
     */
    constructor(cfg = {}) {
        const reasons = [];
        if (!Number.isInteger(cfg.rms_window_N) || cfg.rms_window_N <= 0) {
            reasons.push("rms_window_N must be a positive integer");
        }
        if (!Number.isFinite(cfg.Fs_raw) || cfg.Fs_raw <= 0) {
            reasons.push("Fs_raw must be a positive finite number");
        }
        if (reasons.length > 0) {
            throw new Error(`RmsEnvelopeAdapter config invalid: ${reasons.join("; ")}`);
        }

        this.rms_window_N = cfg.rms_window_N;
        this.Fs_raw = cfg.Fs_raw;
        this.Fs_envelope = cfg.Fs_raw / cfg.rms_window_N;
        this.clock_policy_id = cfg.clock_policy_id ?? "clock.derived_trace.v1";
        this.ingest_policy_id = cfg.ingest_policy_id ?? "ingest.derived_trace.v1";
        this.rms_window_duration_sec = cfg.rms_window_N / cfg.Fs_raw;
    }

    /**
     * Derive an RMS energy-envelope trace from raw signal values.
     *
     * Does NOT mutate the input values or timestamps.
     * Returns a lawful ingest-contract input object for the envelope trace.
     *
     * @param {DeriveInput} input
     * @returns {{ ok: true, ingest_input: EnvelopeIngestInput, envelope_frames: number }
     *          | { ok: false, error: string, reasons: string[] }}
     */
    derive({ values, timestamps, parentSpec, parent_stream_id = null }) {
        const reasons = [];

        if (!Array.isArray(values) || values.length === 0) {
            reasons.push("values must be a non-empty array");
        }
        if (!Array.isArray(timestamps) || timestamps.length === 0) {
            reasons.push("timestamps must be a non-empty array");
        }
        if (!parentSpec?.source_id || typeof parentSpec.source_id !== "string") {
            reasons.push("parentSpec.source_id must be a non-empty string");
        }
        if (reasons.length > 0) {
            return { ok: false, error: "INVALID_INPUT", reasons };
        }

        if (values.length !== timestamps.length) {
            return {
                ok: false,
                error: "LENGTH_MISMATCH",
                reasons: [`values.length (${values.length}) !== timestamps.length (${timestamps.length})`],
            };
        }

        const n = values.length;
        const W = this.rms_window_N;

        // Number of complete frames — truncate trailing samples
        const frameCount = Math.floor(n / W);
        if (frameCount === 0) {
            return {
                ok: false,
                error: "SIGNAL_TOO_SHORT",
                reasons: [`Signal length ${n} is shorter than rms_window_N=${W}; no complete frames`],
            };
        }

        // Derive envelope: RMS per frame
        const envValues = new Array(frameCount);
        const envTimestamps = new Array(frameCount);

        for (let f = 0; f < frameCount; f++) {
            const start = f * W;
            let sumSq = 0;
            for (let i = 0; i < W; i++) {
                const v = values[start + i];
                sumSq += v * v;
            }
            envValues[f] = Math.sqrt(sumSq / W);
            // Timestamp = center of the RMS frame
            envTimestamps[f] = timestamps[start] + (W / 2 - 0.5) / this.Fs_raw;
        }

        // Build stream_id for derived trace — never collides with raw amplitude stream
        const parentSourceId = parentSpec.source_id;
        const envStreamId = `STR:${parentSourceId}:ch0:rms_envelope:v1:${this.Fs_envelope}`;
        const envSourceId = `${parentSourceId}.rms_env_W${W}`;

        const ingestInput = {
            // Ingest contract fields
            timestamps: envTimestamps,
            values: envValues,
            stream_id: envStreamId,
            source_id: envSourceId,
            channel: "ch0",
            modality: "rms_amplitude",

            clock_policy_id: this.clock_policy_id,

            ingest_policy: {
                policy_id: this.ingest_policy_id,
                gap_threshold_multiplier: 3.0,
                allow_non_monotonic: false,
                allow_empty: false,
                non_monotonic_mode: "reject",
            },

            // Explicit provenance metadata — distinguishes from raw amplitude path
            meta: {
                units: "rms_amplitude",
                Fs_nominal: this.Fs_envelope,
                source_mode: "derived_trace",
                derived_trace_type: "rms_envelope",
                parent_source_id: parentSourceId,
                parent_stream_id: parent_stream_id ?? null,
                rms_window_N: W,
                rms_window_duration_sec: this.rms_window_duration_sec,
                Fs_raw: this.Fs_raw,
                envelope_frames: frameCount,
                raw_sample_count: n,
                samples_truncated: n - frameCount * W,
            },
        };

        return {
            ok: true,
            ingest_input: ingestInput,
            envelope_frames: frameCount,
            Fs_envelope: this.Fs_envelope,
        };
    }

    /**
     * Current adapter configuration summary.
     * @returns {Object}
     */
    status() {
        return {
            rms_window_N: this.rms_window_N,
            Fs_raw: this.Fs_raw,
            Fs_envelope: this.Fs_envelope,
            rms_window_duration_sec: this.rms_window_duration_sec,
            clock_policy_id: this.clock_policy_id,
            ingest_policy_id: this.ingest_policy_id,
        };
    }
}
