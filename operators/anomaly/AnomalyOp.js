// operators/anomaly/AnomalyOp.js

/**
 * AnomalyOp
 *
 * Layer: Runtime Memory Space
 * Authority class: Structural (guard operator)
 *
 * Purpose:
 * Detect structural novelty in a current HarmonicState (H1) relative to a
 * declared baseline H1, and emit a deterministic guard artifact (AnomalyReport)
 * that protects merge integrity and segmentation honesty. This is the
 * "don't merge across reality rupture" gate.
 *
 * Contract:
 * - accepts H1 h_current + H1 h_base + AnomalyPolicy
 * - emits AnomalyReport (An)
 * - three invariance lenses (invariance_mode):
 *     "structural"  — full complex bin divergence (identity lens)
 *     "energy"      — total/band energy shift (probability lens)
 *     "band_profile"— normalized magnitude distribution (scale-invariant lens)
 * - novelty_gate_triggered when divergence_score > threshold AND
 *   h_current.window_span.duration_sec >= novelty_min_duration
 * - when triggered: MergeOp must not merge across this boundary; SegmentTracker
 *   advances segment_id
 * - deterministic given identical inputs + policy
 * - does not mutate any artifact
 *
 * Non-responsibilities:
 * - does NOT predict, classify, or infer cause of divergence
 * - does NOT rewrite memory or produce new structural artifacts
 * - does NOT decide what is "normal" — only measures against declared baseline
 * - detected_events are structural observations (new_frequency, vanished_frequency,
 *   drift, energy_shift), NOT semantic labels or predictions
 *
 * Artifact IO:
 *   Input:  H1 (current) + H1 (baseline) + AnomalyPolicy
 *   Output: AnomalyReport (An)
 *
 * References:
 * - README_WorkflowContract.md
 * - README_MasterConstitution.md §3 (runtime memory layer)
 * - OPERATOR_CONTRACTS.md §6
 * - README_SubstrateLayer.md §1 (SegmentTracker consumes An)
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
 * @property {Object} policies
 * @property {string} policies.clock_policy_id
 * @property {string} policies.grid_policy_id
 * @property {string} policies.window_policy_id
 * @property {string} policies.transform_policy_id
 * @property {string} policies.compression_policy_id
 * @property {Object} provenance
 * @property {string[]} provenance.input_refs
 * @property {string} provenance.operator_id
 * @property {string} provenance.operator_version
 */

/**
 * @typedef {Object} DetectedEvent
 * @property {"new_frequency"|"vanished_frequency"|"drift"|"energy_shift"} type
 * @property {number|null} freq_hz
 * @property {number|null} magnitude_delta
 * @property {number|null} phase_delta
 * @property {number|null} band_id
 */

/**
 * @typedef {Object} AnomalyPolicy
 * @property {string} policy_id
 * @property {"structural"|"energy"|"band_profile"} invariance_mode
 * @property {"l2_complex"|"energy_delta"|"band_l1"} divergence_metric
 * @property {number} threshold_value
 * @property {number} frequency_tolerance_hz
 * @property {"strict"|"dominant_only"|"off"} phase_sensitivity_mode
 * @property {number} novelty_min_duration
 * @property {"strict"|"tolerant"} segmentation_mode
 * @property {number} [dominant_bin_threshold=0.0]
 * @property {number} [new_frequency_threshold=0.0]
 * @property {number} [vanished_frequency_threshold=0.0]
 * @property {number} [energy_shift_threshold=0.0]
 */

/**
 * @typedef {Object} AnomalyReceipt
 * @property {string} metric_used
 * @property {number} threshold
 * @property {number} divergence_value
 * Receipt mirror of the artifact-level divergence_score field.
 * Kept in receipt for self-contained audit without top-level field lookup.
 * @property {"above_threshold"|"below_or_equal_threshold"} threshold_relation
 * @property {number} bins_compared
 * @property {"strict"|"dominant_only"|"off"} phase_sensitivity_mode
 * @property {number} sustained_duration_sec
 * @property {boolean} novelty_gate_triggered
 * @property {string} event_label_posture
 * @property {string} evidence_support_subset
 */

/**
 * @typedef {Object} AnomalyReport
 * @property {string} artifact_type
 * @property {"An"} artifact_class
 * @property {string} stream_id
 * @property {string} window_ref
 * @property {string} baseline_id
 * @property {Object} baseline_scope
 * @property {string} baseline_scope.baseline_stream_id
 * @property {string} baseline_scope.baseline_segment_id
 * @property {string} baseline_scope.current_segment_id
 * @property {"structural"|"energy"|"band_profile"} invariance_mode
 * @property {number} divergence_score
 * @property {DetectedEvent[]} detected_events
 * @property {string} evidence_posture
 * @property {string} threshold_posture
 * @property {string[]} explicit_non_claims
 * @property {boolean} novelty_gate_triggered
 * @property {"new_segment"|"continue_segment"} segmentation_recommendation
 * @property {AnomalyReceipt} anomaly_receipt
 * @property {Object} policies
 * @property {string} policies.anomaly_policy_id
 * @property {string} policies.clock_policy_id
 * @property {string} policies.grid_policy_id
 * @property {string} policies.window_policy_id
 * @property {string} policies.transform_policy_id
 * @property {string} policies.compression_policy_id
 * @property {Object} provenance
 * @property {string[]} provenance.input_refs
 * @property {string} provenance.operator_id
 * @property {string} provenance.operator_version
 */

/**
 * @typedef {Object} AnomalyResult
 * @property {true} ok
 * @property {AnomalyReport} artifact
 *
 * @typedef {Object} AnomalyError
 * @property {false} ok
 * @property {string} error
 * @property {string[]} reasons
 *
 * @typedef {AnomalyResult | AnomalyError} AnomalyOutcome
 */

export class AnomalyOp {
    /**
     * @param {Object} cfg
     * @param {string} [cfg.operator_id="AnomalyOp"]
     * @param {string} [cfg.operator_version="0.1.0"]
     */
    constructor(cfg = {}) {
        this.operator_id = cfg.operator_id ?? "AnomalyOp";
        this.operator_version = cfg.operator_version ?? "0.1.0";
    }

    /**
     * @param {Object} input
     * @param {HarmonicState} input.h_current
     * @param {HarmonicState} input.h_base
     * @param {AnomalyPolicy} input.anomaly_policy
     * @returns {AnomalyOutcome}
     */
    run(input) {
        const { h_current, h_base, anomaly_policy } = input ?? {};
        const reasons = [];

        if (!h_current || h_current.artifact_class !== "H1") {
            reasons.push("input.h_current must be a valid H1 HarmonicState");
        }
        if (!h_base || h_base.artifact_class !== "H1") {
            reasons.push("input.h_base must be a valid H1 HarmonicState baseline");
        }
        if (!anomaly_policy) {
            reasons.push("anomaly_policy is required");
        }

        if (reasons.length > 0) {
            return { ok: false, error: "INVALID_SCHEMA", reasons };
        }

        if (h_current.stream_id !== h_base.stream_id) {
            return {
                ok: false,
                error: "BASELINE_SCOPE_MISMATCH",
                reasons: ["Door One baseline must refer to the same stream_id"],
            };
        }

        const gridCheck = sameGrid(h_current, h_base);
        if (!gridCheck.ok) {
            return {
                ok: false,
                error: "GRID_MISMATCH",
                reasons: gridCheck.reasons,
            };
        }
        if (!h_current.policies?.clock_policy_id || typeof h_current.policies.clock_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_H_CURRENT",
                reasons: ["H_current.policies.clock_policy_id must be a valid policy reference"],
            };
        }

        if (!h_current.policies?.grid_policy_id || typeof h_current.policies.grid_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_H_CURRENT",
                reasons: ["H_current.policies.grid_policy_id must be a valid policy reference"],
            };
        }

        if (!h_current.policies?.window_policy_id || typeof h_current.policies.window_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_H_CURRENT",
                reasons: ["H_current.policies.window_policy_id must be a valid policy reference"],
            };
        }

        if (!h_current.policies?.transform_policy_id || typeof h_current.policies.transform_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_H_CURRENT",
                reasons: ["H_current.policies.transform_policy_id must be a valid policy reference"],
            };
        }
        if (!h_base.policies?.clock_policy_id || typeof h_base.policies.clock_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_H_BASE",
                reasons: ["H_base.policies.clock_policy_id must be a valid policy reference"],
            };
        }

        if (!h_base.policies?.grid_policy_id || typeof h_base.policies.grid_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_H_BASE",
                reasons: ["H_base.policies.grid_policy_id must be a valid policy reference"],
            };
        }

        if (!h_base.policies?.window_policy_id || typeof h_base.policies.window_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_H_BASE",
                reasons: ["H_base.policies.window_policy_id must be a valid policy reference"],
            };
        }

        if (!h_base.policies?.transform_policy_id || typeof h_base.policies.transform_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_H_BASE",
                reasons: ["H_base.policies.transform_policy_id must be a valid policy reference"],
            };
        }

        if (!h_base.policies?.compression_policy_id || typeof h_base.policies.compression_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_H_BASE",
                reasons: ["H_base.policies.compression_policy_id must be a valid policy reference"],
            };
        }
        if (!h_current.policies?.compression_policy_id || typeof h_current.policies.compression_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_H_CURRENT",
                reasons: ["H_current.policies.compression_policy_id must be a valid policy reference"],
            };
        }
        // window_span.duration_sec feeds directly into novelty_gate_triggered via
        // sustainedDurationSec >= novelty_min_duration. A missing or non-finite value
        // would silently under-trigger the gate (treating 0 as duration), corrupting
        // segmentation recommendations. Guard explicitly.
        if (!Number.isFinite(h_current.window_span?.duration_sec)) {
            return {
                ok: false,
                error: "INVALID_H_CURRENT",
                reasons: ["h_current.window_span.duration_sec must be a finite number (required for novelty gate)"],
            };
        }
        const invarianceMode = anomaly_policy.invariance_mode;
        const metric = anomaly_policy.divergence_metric;
        const phaseMode = anomaly_policy.phase_sensitivity_mode ?? "strict";
        const freqTol = anomaly_policy.frequency_tolerance_hz ?? 0;
        const threshold = anomaly_policy.threshold_value;

        // Guard: invariant fields that feed divergence computation must be present
        // for the declared invariance_mode. Missing fields cannot silently suppress
        // novelty detection by collapsing divergence to zero.
        if ((invarianceMode === "energy" || metric === "energy_delta") &&
            !Number.isFinite(h_current.invariants?.energy_raw) &&
            (!Array.isArray(h_current.kept_bins) || h_current.kept_bins.length === 0)) {
            return {
                ok: false,
                error: "INVALID_H_CURRENT",
                reasons: ["energy mode requires h_current.invariants.energy_raw or non-empty kept_bins"],
            };
        }
        if ((invarianceMode === "energy" || metric === "energy_delta") &&
            !Number.isFinite(h_base.invariants?.energy_raw) &&
            (!Array.isArray(h_base.kept_bins) || h_base.kept_bins.length === 0)) {
            return {
                ok: false,
                error: "INVALID_H_BASE",
                reasons: ["energy mode requires h_base.invariants.energy_raw or non-empty kept_bins"],
            };
        }
        if ((invarianceMode === "band_profile" || metric === "band_l1") &&
            (!Array.isArray(h_current.invariants?.band_profile_norm?.band_energy) ||
             h_current.invariants.band_profile_norm.band_energy.length === 0)) {
            return {
                ok: false,
                error: "INVALID_H_CURRENT",
                reasons: ["band_profile mode requires h_current.invariants.band_profile_norm.band_energy (non-empty)"],
            };
        }
        if ((invarianceMode === "band_profile" || metric === "band_l1") &&
            (!Array.isArray(h_base.invariants?.band_profile_norm?.band_energy) ||
             h_base.invariants.band_profile_norm.band_energy.length === 0)) {
            return {
                ok: false,
                error: "INVALID_H_BASE",
                reasons: ["band_profile mode requires h_base.invariants.band_profile_norm.band_energy (non-empty)"],
            };
        }

        if (!Number.isFinite(threshold)) {
            return {
                ok: false,
                error: "INVALID_POLICY",
                reasons: ["anomaly_policy.threshold_value must be finite"],
            };
        }

        const currentBins = [...(h_current.kept_bins ?? [])].sort((a, b) => a.k - b.k);
        const baseBins = [...(h_base.kept_bins ?? [])].sort((a, b) => a.k - b.k);

        const match = alignBins(currentBins, baseBins, freqTol);
        const divergenceScore = computeDivergence({
            invarianceMode,
            metric,
            matchedPairs: match.matchedPairs,
            h_current,
            h_base,
        });

        const detectedEvents = detectEvents({
            matchedPairs: match.matchedPairs,
            currentOnly: match.currentOnly,
            baseOnly: match.baseOnly,
            policy: anomaly_policy,
            h_current,
            h_base,
        });

        const sustainedDurationSec = h_current.window_span?.duration_sec ?? 0;
        const noveltyGateTriggered =
            divergenceScore > threshold &&
            sustainedDurationSec >= anomaly_policy.novelty_min_duration;
        const thresholdRelation = divergenceScore > threshold
            ? "above_threshold"
            : "below_or_equal_threshold";

        const segmentationRecommendation =
            noveltyGateTriggered && anomaly_policy.segmentation_mode === "strict"
                ? "new_segment"
                : "continue_segment";

        /** @type {AnomalyReport} */
        const artifact = {
            artifact_type: "AnomalyReport",
            artifact_class: "An",
            stream_id: h_current.stream_id,
            window_ref: currentWindowRef(h_current),
            baseline_id: h_base.state_id,
            baseline_scope: {
                baseline_stream_id: h_base.stream_id,
                baseline_segment_id: h_base.segment_id,
                current_segment_id: h_current.segment_id,
            },
            invariance_mode: invarianceMode,
            divergence_score: divergenceScore,
            detected_events: detectedEvents,
            evidence_posture: "structural_deviation_evidence",
            threshold_posture: deriveThresholdPosture({
                thresholdRelation,
                noveltyGateTriggered,
                sustainedDurationSec,
                noveltyMinDuration: anomaly_policy.novelty_min_duration,
                detectedEvents,
                divergenceScore,
            }),
            explicit_non_claims: [
                "not truth",
                "not canon",
                "not a continuity verdict",
                "not a memory claim",
                "not an identity claim",
                "not a review verdict",
            ],
            novelty_gate_triggered: noveltyGateTriggered,
            segmentation_recommendation: segmentationRecommendation,
            anomaly_receipt: {
                metric_used: metric,
                threshold,
                divergence_value: divergenceScore,
                threshold_relation: thresholdRelation,
                bins_compared: match.matchedPairs.length,
                phase_sensitivity_mode: phaseMode,
                sustained_duration_sec: sustainedDurationSec,
                novelty_gate_triggered: noveltyGateTriggered,
                event_label_posture: "bounded_evidence_labels_only",
                evidence_support_subset: "deviation evidence and segmentation-gate posture only; continuity, memory, identity, and review meaning deferred at this seam",
            },
            policies: {
                anomaly_policy_id: makeAnomalyPolicyId(anomaly_policy),
                clock_policy_id: h_current.policies.clock_policy_id,
                grid_policy_id: h_current.policies.grid_policy_id,
                window_policy_id: h_current.policies.window_policy_id,
                transform_policy_id: h_current.policies.transform_policy_id,
                compression_policy_id: h_current.policies.compression_policy_id,
            },
            provenance: {
                input_refs: [
                    makeInputRef(h_current),
                    makeInputRef(h_base),
                ],
                operator_id: this.operator_id,
                operator_version: this.operator_version,
            },
        };

        return { ok: true, artifact };
    }
}

function deriveThresholdPosture({
    thresholdRelation,
    noveltyGateTriggered,
    sustainedDurationSec,
    noveltyMinDuration,
    detectedEvents,
    divergenceScore,
}) {
    if (noveltyGateTriggered) {
        return "above_threshold | segmentation pressure registered";
    }
    if (
        thresholdRelation === "above_threshold" &&
        Number.isFinite(sustainedDurationSec) &&
        Number.isFinite(noveltyMinDuration) &&
        sustainedDurationSec < noveltyMinDuration
    ) {
        return "above_threshold | duration_insufficient_for_novelty_gate";
    }
    if ((Array.isArray(detectedEvents) && detectedEvents.length > 0) || divergenceScore > 0) {
        return "below_or_equal_threshold | deviation observed without novelty closure";
    }
    return "below_or_equal_threshold | no material deviation closure";
}

/**
 * @param {HarmonicState} a
 * @param {HarmonicState} b
 */
function sameGrid(a, b) {
    const reasons = [];
    if (a.grid?.Fs_target !== b.grid?.Fs_target) reasons.push("Fs_target mismatch");
    if (a.grid?.N !== b.grid?.N) reasons.push("N mismatch");
    if (a.grid?.df !== b.grid?.df) reasons.push("df mismatch");
    return { ok: reasons.length === 0, reasons };
}

/**
 * Deterministic bin alignment by k first, then freq tolerance fallback.
 * @param {KeptBin[]} currentBins
 * @param {KeptBin[]} baseBins
 * @param {number} freqTol
 */
function alignBins(currentBins, baseBins, freqTol) {
    const baseByK = new Map(baseBins.map((b) => [b.k, b]));
    const usedBase = new Set();

    /** @type {{current:KeptBin, base:KeptBin}[]} */
    const matchedPairs = [];
    /** @type {KeptBin[]} */
    const currentOnly = [];
    /** @type {KeptBin[]} */
    const baseOnly = [];

    for (const cb of currentBins) {
        const exact = baseByK.get(cb.k);
        if (exact) {
            matchedPairs.push({ current: cb, base: exact });
            usedBase.add(exact.k);
            continue;
        }

        const near = baseBins.find(
            (bb) => !usedBase.has(bb.k) && Math.abs(bb.freq_hz - cb.freq_hz) <= freqTol
        );

        if (near) {
            matchedPairs.push({ current: cb, base: near });
            usedBase.add(near.k);
        } else {
            currentOnly.push(cb);
        }
    }

    for (const bb of baseBins) {
        if (!usedBase.has(bb.k)) baseOnly.push(bb);
    }

    matchedPairs.sort((a, b) => a.current.k - b.current.k);
    currentOnly.sort((a, b) => a.k - b.k);
    baseOnly.sort((a, b) => a.k - b.k);

    return { matchedPairs, currentOnly, baseOnly };
}

/**
 * @param {Object} args
 * @param {"structural"|"energy"|"band_profile"} args.invarianceMode
 * @param {"l2_complex"|"energy_delta"|"band_l1"} args.metric
 * @param {{current:KeptBin, base:KeptBin}[]} args.matchedPairs
 * @param {HarmonicState} args.h_current
 * @param {HarmonicState} args.h_base
 */
function computeDivergence({ invarianceMode, metric, matchedPairs, h_current, h_base }) {
    if (invarianceMode === "structural" || metric === "l2_complex") {
        if (matchedPairs.length === 0) return 1;
        let sum = 0;
        let denom = 0;
        for (const { current, base } of matchedPairs) {
            const dre = current.re - base.re;
            const dim = current.im - base.im;
            sum += dre * dre + dim * dim;
            denom += base.re * base.re + base.im * base.im;
        }
        return Math.sqrt(sum / Math.max(denom, 1e-12));
    }

    if (invarianceMode === "energy" || metric === "energy_delta") {
        const eCur = h_current.invariants?.energy_raw ?? sumEnergy(h_current.kept_bins ?? []);
        const eBase = h_base.invariants?.energy_raw ?? sumEnergy(h_base.kept_bins ?? []);
        return Math.abs(eCur - eBase) / Math.max(Math.abs(eBase), 1e-12);
    }

    // band_profile / band_l1
    const pCur = h_current.invariants?.band_profile_norm?.band_energy ?? [];
    const pBase = h_base.invariants?.band_profile_norm?.band_energy ?? [];
    return l1(pCur, pBase);
}

/**
 * @param {Object} args
 * @param {{current:KeptBin, base:KeptBin}[]} args.matchedPairs
 * @param {KeptBin[]} args.currentOnly
 * @param {KeptBin[]} args.baseOnly
 * @param {AnomalyPolicy} args.policy
 * @param {HarmonicState} args.h_current
 * @param {HarmonicState} args.h_base
 * @returns {DetectedEvent[]}
 */
function detectEvents({ matchedPairs, currentOnly, baseOnly, policy, h_current, h_base }) {
    /** @type {DetectedEvent[]} */
    const out = [];

    const dominantThreshold = policy.dominant_bin_threshold ?? 0;
    const newFreqThresh = policy.new_frequency_threshold ?? 0;
    const vanishedThresh = policy.vanished_frequency_threshold ?? 0;
    const energyShiftThresh = policy.energy_shift_threshold ?? 0;
    const phaseMode = policy.phase_sensitivity_mode ?? "strict";

    for (const b of currentOnly) {
        if (b.magnitude >= newFreqThresh) {
            out.push({
                type: "new_frequency",
                freq_hz: b.freq_hz,
                magnitude_delta: b.magnitude,
                phase_delta: null,
                band_id: null,
            });
        }
    }

    for (const b of baseOnly) {
        if (b.magnitude >= vanishedThresh) {
            out.push({
                type: "vanished_frequency",
                freq_hz: b.freq_hz,
                magnitude_delta: -b.magnitude,
                phase_delta: null,
                band_id: null,
            });
        }
    }

    for (const { current, base } of matchedPairs) {
        if (Math.max(current.magnitude, base.magnitude) < dominantThreshold) continue;

        const magDelta = current.magnitude - base.magnitude;
        const phaseDelta = wrappedPhaseDelta(current.phase, base.phase);

        if (phaseMode !== "off" && Math.abs(phaseDelta) > 0) {
            out.push({
                type: "drift",
                freq_hz: current.freq_hz,
                magnitude_delta: magDelta,
                phase_delta: phaseDelta,
                band_id: null,
            });
        }
    }

    const curBands = h_current.invariants?.band_profile_norm?.band_energy ?? [];
    const baseBands = h_base.invariants?.band_profile_norm?.band_energy ?? [];
    const bandCount = Math.min(curBands.length, baseBands.length);

    for (let i = 0; i < bandCount; i++) {
        const delta = curBands[i] - baseBands[i];
        if (Math.abs(delta) >= energyShiftThresh) {
            out.push({
                type: "energy_shift",
                freq_hz: null,
                magnitude_delta: delta,
                phase_delta: null,
                band_id: i,
            });
        }
    }

    return out;
}

function makeAnomalyPolicyId(policy) {
    return [
        "ANOM",
        `pid=${policy.policy_id ?? "unspecified"}`,
        `mode=${policy.invariance_mode ?? "unspecified"}`,
        `metric=${policy.divergence_metric ?? "unspecified"}`,
        `thresh=${policy.threshold_value}`,
        `freqtol=${policy.frequency_tolerance_hz ?? 0}`,
        `phase=${policy.phase_sensitivity_mode ?? "strict"}`,
        `mindur=${policy.novelty_min_duration ?? 0}`,
        `seg=${policy.segmentation_mode ?? "strict"}`,
        `dominant=${policy.dominant_bin_threshold ?? 0}`,
        `new=${policy.new_frequency_threshold ?? 0}`,
        `vanish=${policy.vanished_frequency_threshold ?? 0}`,
        `eshift=${policy.energy_shift_threshold ?? 0}`,
    ].join(":");
}

function wrappedPhaseDelta(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
}

/** @param {KeptBin[]} bins */
function sumEnergy(bins) {
    let e = 0;
    for (const b of bins) e += b.re * b.re + b.im * b.im;
    return e;
}

/** @param {number[]} a @param {number[]} b */
function l1(a, b) {
    const n = Math.min(a.length, b.length);
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
    if (a.length !== b.length) {
        const longer = a.length > b.length ? a : b;
        for (let i = n; i < longer.length; i++) s += Math.abs(longer[i]);
    }
    return s;
}

/** @param {HarmonicState} h */
function makeInputRef(h) {
    const seg = h.segment_id ?? "seg_default";
    const t0 = h.window_span?.t_start ?? "na";
    const t1 = h.window_span?.t_end ?? "na";
    return `H1:${h.stream_id}:${seg}:${t0}:${t1}`;
}

/** @param {HarmonicState} h */
function currentWindowRef(h) {
    const t0 = h.window_span?.t_start ?? "na";
    const t1 = h.window_span?.t_end ?? "na";
    return `${t0}:${t1}`;
}
