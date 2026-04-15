// operators/sampler/AnalogSamplerOp.js

/**
 * AnalogSamplerOp
 *
 * Purpose:
 * Bridge between raw ADC-style sample streams (phone mic, camera, computer
 * sensors, Web Audio API, Node.js audio capture, file-based batch import)
 * and the IngestOp pipeline entry point.
 *
 * This operator sits BEFORE IngestOp in the physical signal path.
 * It does not transform signal content — it buffers, timestamps, and chunks
 * raw samples into the shape IngestOp expects.
 *
 * It is NOT an artifact-producing operator in the canonical sense.
 * It is a "pre-ingest adapter" — its output is raw IngestOp input structs,
 * not pipeline artifacts.
 *
 * Contract:
 * - appends raw samples to a ring buffer with device timestamps
 * - generates IngestOp-ready input chunks on flush() or trigger
 * - never modifies sample values
 * - never reorders samples
 * - records device clock metadata for downstream ClockAlignOp
 * - supports batch (flush all), chunk (flush fixed N), and
 *   threshold-triggered (flush when condition met) modes
 * - deterministic given identical append sequence + flush parameters
 *
 * Civilian hardware targets (Door One + Door Two):
 *   - Web Audio API (AudioWorklet / ScriptProcessor) → float32 samples
 *   - Node.js audio capture (e.g., node-audiorecorder, sox pipe)
 *   - MediaRecorder API (chunked audio blobs → decoded PCM)
 *   - Camera frame pixel rows (grayscale → float32 projections)
 *   - Computer mic via Web Speech / getUserMedia
 *   - CSV/WAV/raw binary file import (batch mode)
 *
 * References:
 * - README_MasterConstitution.md §3 (signal layer, pre-ingest adapter)
 * - OPERATOR_CONTRACTS.md §1
 * - README_MasterConstitution.md §7 (artifact authority graph)
 */

/**
 * @typedef {Object} SamplerConfig
 * @property {string} source_id              — stable hardware/source identifier
 * @property {string} [channel="ch0"]        — channel label
 * @property {string} modality               — "audio" | "video_projection" | "imu" | "custom"
 * @property {string} [units="arb"]          — physical units of sample values
 * @property {number} Fs_nominal             — declared nominal sample rate (Hz)
 * @property {number} [ring_capacity=65536]  — max samples in ring buffer before overwrite
 * @property {string} [clock_policy_id]      — passed through to IngestOp
 * @property {string} [ingest_policy_id="ingest_v1"]
 * @property {number} [gap_threshold_multiplier=3.0]
 * @property {"reject"|"segment"} [non_monotonic_mode="reject"]
 * @property {boolean} [allow_non_monotonic=false]
 */

/**
 * @typedef {Object} SamplerFlushResult
 * @property {boolean} ok
 * @property {Object|null} ingest_input      — ready for IngestOp.run()
 * @property {number} samples_flushed
 * @property {number} samples_remaining
 * @property {string|null} error
 * @property {string[]} reasons
 */

export class AnalogSamplerOp {
    /**
     * @param {SamplerConfig} cfg
     */
    constructor(cfg) {
        const reasons = [];
        if (!cfg?.source_id || typeof cfg.source_id !== "string") {
            reasons.push("cfg.source_id must be a non-empty string");
        }
        if (!cfg?.modality || typeof cfg.modality !== "string") {
            reasons.push("cfg.modality must be a non-empty string");
        }
        if (!Number.isFinite(cfg?.Fs_nominal) || cfg.Fs_nominal <= 0) {
            reasons.push("cfg.Fs_nominal must be a positive finite number");
        }
        if (reasons.length > 0) {
            throw new Error(`AnalogSamplerOp configuration invalid: ${reasons.join("; ")}`);
        }

        this.source_id = cfg.source_id;
        this.channel = cfg.channel ?? "ch0";
        this.modality = cfg.modality;
        this.units = cfg.units ?? "arb";
        this.Fs_nominal = cfg.Fs_nominal;
        this.ring_capacity = cfg.ring_capacity ?? 65536;
        this.clock_policy_id = cfg.clock_policy_id ?? "clock.device.v1";
        this.ingest_policy_id = cfg.ingest_policy_id ?? "ingest_v1";
        this.gap_threshold_multiplier = cfg.gap_threshold_multiplier ?? 3.0;
        this.non_monotonic_mode = cfg.non_monotonic_mode ?? "reject";
        this.allow_non_monotonic = cfg.allow_non_monotonic ?? false;

        // Ring buffer (parallel arrays for values and timestamps)
        /** @type {Float64Array} */
        this._values = new Float64Array(this.ring_capacity);
        /** @type {Float64Array} */
        this._timestamps = new Float64Array(this.ring_capacity);

        this._write_head = 0;           // next write index
        this._count = 0;                // valid samples in buffer (up to ring_capacity)
        this._total_appended = 0;       // monotonic total appended ever
        this._overflows = 0;            // how many times the ring has overwritten

        // Monotonic device time enforcement
        this._last_t = -Infinity;

        // Chunk counter for stream_id stability
        this._chunk_index = 0;
    }

    // ─── Write ────────────────────────────────────────────────────────────────

    /**
     * Append a batch of samples with device timestamps.
     *
     * Timestamps must be in seconds (floating point). They should be
     * device-local time — ClockAlignOp will reconcile with system grid later.
     *
     * If timestamps are omitted, they are generated from Fs_nominal
     * starting from the last known timestamp (synthetic clock mode for
     * sources that do not provide per-sample timestamps, e.g. Web Audio).
     *
     * @param {Object} args
     * @param {number[]|Float32Array|Float64Array} args.values
     * @param {number[]|Float32Array|Float64Array|null} [args.timestamps]
     * @param {number|null} [args.t0]   — base time for synthetic clock (defaults to last_t + dt)
     * @returns {{ ok: boolean, appended: number, overflow: boolean, reasons?: string[] }}
     */
    ingest({ values, timestamps = null, t0 = null }) {
        if (!values || values.length === 0) {
            return { ok: false, appended: 0, overflow: false, reasons: ["values must be non-empty"] };
        }

        const n = values.length;
        const dt = 1 / this.Fs_nominal;

        // Synthesize timestamps if not provided
        let ts;
        if (timestamps === null || timestamps.length === 0) {
            const base = t0 !== null ? t0
                : this._last_t === -Infinity ? 0
                : this._last_t + dt;
            ts = new Float64Array(n);
            for (let i = 0; i < n; i++) ts[i] = base + i * dt;
        } else {
            if (timestamps.length !== n) {
                return {
                    ok: false,
                    appended: 0,
                    overflow: false,
                    reasons: [`timestamps.length (${timestamps.length}) !== values.length (${n})`],
                };
            }
            ts = timestamps;
        }

        let overflow = false;

        for (let i = 0; i < n; i++) {
            const t = ts[i];
            const v = values[i];

            // Validate finite
            if (!Number.isFinite(v) || !Number.isFinite(t)) continue;

            // Non-monotonic check (light — IngestOp does the authoritative check)
            if (t <= this._last_t && !this.allow_non_monotonic) {
                // Skip non-monotonic samples in sampler; IngestOp will enforce policy
                continue;
            }

            // Write to ring
            const idx = this._write_head % this.ring_capacity;
            this._values[idx] = v;
            this._timestamps[idx] = t;

            this._write_head++;
            if (this._count < this.ring_capacity) {
                this._count++;
            } else {
                overflow = true;
                this._overflows++;
            }

            this._last_t = t;
            this._total_appended++;
        }

        return { ok: true, appended: n, overflow };
    }

    // ─── Flush ────────────────────────────────────────────────────────────────

    /**
     * Flush all buffered samples as an IngestOp-ready input struct.
     * Drains the ring buffer completely.
     *
     * @param {Object} [opts]
     * @param {string} [opts.stream_id]   — if provided, passed to IngestOp directly
     * @returns {SamplerFlushResult}
     */
    flushAll(opts = {}) {
        if (this._count === 0) {
            return {
                ok: false,
                ingest_input: null,
                samples_flushed: 0,
                samples_remaining: 0,
                error: "BUFFER_EMPTY",
                reasons: ["no samples in buffer to flush"],
            };
        }

        const { values, timestamps } = this._drainAll();
        const result = this._buildIngestInput({ values, timestamps, ...opts });
        this._count = 0;
        this._write_head = 0;
        this._chunk_index++;

        return {
            ok: true,
            ingest_input: result,
            samples_flushed: values.length,
            samples_remaining: 0,
            error: null,
            reasons: [],
        };
    }

    /**
     * Flush exactly `chunk_size` samples from the oldest end of the buffer.
     * If fewer than `chunk_size` samples are available, flushes what exists.
     *
     * Useful for fixed-size pipeline ingestion (e.g. flush 256 samples at a time
     * to match WindowOp's base_window_N).
     *
     * @param {number} chunk_size
     * @param {Object} [opts]
     * @returns {SamplerFlushResult}
     */
    flushChunk(chunk_size, opts = {}) {
        if (this._count === 0) {
            return {
                ok: false,
                ingest_input: null,
                samples_flushed: 0,
                samples_remaining: 0,
                error: "BUFFER_EMPTY",
                reasons: ["no samples in buffer to flush"],
            };
        }

        const actual = Math.min(chunk_size, this._count);
        const { values, timestamps } = this._drainN(actual);
        const result = this._buildIngestInput({ values, timestamps, ...opts });
        this._chunk_index++;

        return {
            ok: true,
            ingest_input: result,
            samples_flushed: actual,
            samples_remaining: this._count,
            error: null,
            reasons: [],
        };
    }

    /**
     * Flush if a threshold condition is met. Returns null flush if condition not met.
     *
     * Supported conditions:
     *   "min_samples"  — flush when buffer has >= threshold_value samples
     *   "rms_above"    — flush when RMS of buffered samples >= threshold_value
     *   "rms_below"    — flush when RMS of buffered samples < threshold_value (silence gate)
     *
     * @param {Object} args
     * @param {"min_samples"|"rms_above"|"rms_below"} args.condition
     * @param {number} args.threshold_value
     * @param {Object} [args.flush_opts]
     * @returns {SamplerFlushResult & { condition_met: boolean }}
     */
    flushOnThreshold({ condition, threshold_value, flush_opts = {} }) {
        const conditionMet = this._evaluateThreshold(condition, threshold_value);

        if (!conditionMet) {
            return {
                ok: true,
                condition_met: false,
                ingest_input: null,
                samples_flushed: 0,
                samples_remaining: this._count,
                error: null,
                reasons: [],
            };
        }

        const result = this.flushAll(flush_opts);
        return { ...result, condition_met: true };
    }

    // ─── Batch import (offline / file mode) ───────────────────────────────────

    /**
     * Import a complete pre-recorded signal as a single flush.
     *
     * This is the batch/offline path for WAV files, CSV imports, and
     * synthetic test signals. It bypasses the ring buffer entirely.
     *
     * @param {Object} args
     * @param {number[]|Float32Array|Float64Array} args.values
     * @param {number[]|Float32Array|Float64Array|null} [args.timestamps]
     * @param {number} [args.Fs_actual]   — if different from Fs_nominal (e.g. file's actual rate)
     * @param {string} [args.stream_id]
     * @returns {SamplerFlushResult}
     */
    importBatch({ values, timestamps = null, Fs_actual = null, stream_id = null }) {
        const n = values.length;
        if (n === 0) {
            return {
                ok: false,
                ingest_input: null,
                samples_flushed: 0,
                samples_remaining: 0,
                error: "EMPTY_IMPORT",
                reasons: ["values array is empty"],
            };
        }

        const Fs = Fs_actual ?? this.Fs_nominal;
        const dt = 1 / Fs;

        let ts;
        if (timestamps === null || timestamps.length === 0) {
            ts = Float64Array.from({ length: n }, (_, i) => i * dt);
        } else {
            ts = timestamps;
        }

        const result = this._buildIngestInput({
            values: Array.from(values),
            timestamps: Array.from(ts),
            stream_id,
            Fs_override: Fs,
        });

        this._chunk_index++;

        return {
            ok: true,
            ingest_input: result,
            samples_flushed: n,
            samples_remaining: 0,
            error: null,
            reasons: [],
        };
    }

    // ─── Status ───────────────────────────────────────────────────────────────

    /**
     * Current buffer status.
     * @returns {Object}
     */
    status() {
        return {
            source_id: this.source_id,
            channel: this.channel,
            modality: this.modality,
            Fs_nominal: this.Fs_nominal,
            ring_capacity: this.ring_capacity,
            buffered_samples: this._count,
            total_appended: this._total_appended,
            overflows: this._overflows,
            chunk_index: this._chunk_index,
            last_t: this._last_t === -Infinity ? null : this._last_t,
            fill_ratio: this._count / this.ring_capacity,
        };
    }

    /**
     * Reset the ring buffer without changing configuration.
     * Use between pipeline runs or on stream restart.
     */
    reset() {
        this._write_head = 0;
        this._count = 0;
        this._last_t = -Infinity;
        // Don't reset _total_appended or _chunk_index — those are lifetime counters
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /**
     * Drain all buffered samples, returning chronological arrays.
     * @returns {{ values: number[], timestamps: number[] }}
     */
    _drainAll() {
        const count = this._count;
        const capacity = this.ring_capacity;

        const values = [];
        const timestamps = [];

        // The oldest sample is at (write_head - count) mod capacity
        const oldestIdx = (this._write_head - count + capacity * 2) % capacity;

        for (let i = 0; i < count; i++) {
            const idx = (oldestIdx + i) % capacity;
            values.push(this._values[idx]);
            timestamps.push(this._timestamps[idx]);
        }

        this._count = 0;
        return { values, timestamps };
    }

    /**
     * Drain exactly n samples from the oldest end.
     * @param {number} n
     * @returns {{ values: number[], timestamps: number[] }}
     */
    _drainN(n) {
        const count = Math.min(n, this._count);
        const capacity = this.ring_capacity;
        const oldestIdx = (this._write_head - this._count + capacity * 2) % capacity;

        const values = [];
        const timestamps = [];

        for (let i = 0; i < count; i++) {
            const idx = (oldestIdx + i) % capacity;
            values.push(this._values[idx]);
            timestamps.push(this._timestamps[idx]);
        }

        this._count -= count;
        return { values, timestamps };
    }

    /**
     * @private
     */
    _evaluateThreshold(condition, thresholdValue) {
        if (condition === "min_samples") {
            return this._count >= thresholdValue;
        }

        if (this._count === 0) return false;

        if (condition === "rms_above" || condition === "rms_below") {
            const { values } = this._peekAll();
            const rms = Math.sqrt(values.reduce((a, v) => a + v * v, 0) / values.length);
            return condition === "rms_above" ? rms >= thresholdValue : rms < thresholdValue;
        }

        return false;
    }

    /**
     * Peek at all buffered samples without draining.
     * @private
     */
    _peekAll() {
        const count = this._count;
        const capacity = this.ring_capacity;
        const oldestIdx = (this._write_head - count + capacity * 2) % capacity;
        const values = [];
        for (let i = 0; i < count; i++) {
            values.push(this._values[(oldestIdx + i) % capacity]);
        }
        return { values };
    }

    /**
     * Build the IngestOp-ready input struct.
     * @private
     */
    _buildIngestInput({ values, timestamps, stream_id = null, Fs_override = null }) {
        return {
            // stream_id: if provided by caller, pass through (IngestOp will preserve it)
            // if absent, IngestOp derives from source descriptors below
            ...(stream_id ? { stream_id } : {}),

            // Stable source descriptors for IngestOp stream_id derivation
            source_id: this.source_id,
            channel: this.channel,
            modality: this.modality,

            timestamps,
            values,

            meta: {
                units: this.units,
                Fs_nominal: Fs_override ?? this.Fs_nominal,
                source_id: this.source_id,
                channel: this.channel,
                modality: this.modality,
                sampler_chunk_index: this._chunk_index,
                sampler_total_appended: this._total_appended,
                sampler_overflows: this._overflows,
            },

            clock_policy_id: this.clock_policy_id,

            ingest_policy: {
                policy_id: this.ingest_policy_id,
                gap_threshold_multiplier: this.gap_threshold_multiplier,
                allow_non_monotonic: this.allow_non_monotonic,
                allow_empty: false,
                non_monotonic_mode: this.non_monotonic_mode,
            },
        };
    }
}
