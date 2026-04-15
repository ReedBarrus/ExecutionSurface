// operators/compress/CompressOp.js

/**
 * CompressOp
 *
 * Layer: Runtime Memory Space
 * Authority class: Structural (proof-preserving reduction)
 *
 * Purpose:
 * Reduce a full SpectralFrame (S1) into a sparse, replayable, merge-safe
 * HarmonicState (H1) while preserving declared invariances with receipts.
 * CompressOp decides what portion of the spectral structure becomes runtime
 * memory. TransformOp creates structure; CompressOp selects what to keep.
 *
 * Contract:
 * - accepts S1 SpectralFrame + context (segment_id required, window_span required)
 * - emits H1 HarmonicState
 * - selection_method: "topK" (rank by magnitude) or "band_quota" (per-band floor)
 *   NOTE: band_quota without a valid band_quota.band_edges spec silently falls
 *   through to topK behavior (known gap; receipt echoes policy label regardless)
 * - deterministic kept-set given identical (S1, CompressionPolicy); tie-break
 *   by magnitude desc, then k asc
 * - logs reconstruction, energy, and band-profile receipts with thresholds
 * - context.segment_id is required: fabricating a default is a provenance lie
 *
 * Non-responsibilities:
 * - does NOT merge across windows (that is MergeOp)
 * - does NOT invent bins — only keeps or zeros existing S1 bins
 * - does NOT canonicalize memory
 * - H1 gates (passes_invariance_bounds, eligible_for_archive_tier) reflect
 *   runtime memory lawfulness, NOT canon promotion eligibility; only
 *   no review or promotion layer is activated here
 *
 * Artifact IO:
 *   Input:  S1 SpectralFrame + CompressionPolicy + context
 *   Output: H1 HarmonicState
 *
 * References:
 * - README_WorkflowContract.md
 * - README_MasterConstitution.md §3 (runtime memory layer)
 * - OPERATOR_CONTRACTS.md §5
 * - README_SubstrateLayer.md (legitimacy prerequisites for commit)
 */

/**
 * @typedef {Object} CompressionThresholds
 * @property {number} max_recon_rmse
 * @property {number} max_energy_residual
 * @property {number} max_band_divergence
 */

/**
 * @typedef {Object} BandQuotaSpec
 * @property {number[]} band_edges
 * @property {number} [min_bins_per_band=0]
 */

/**
 * @typedef {Object} CompressionPolicy
 * @property {string} policy_id
 * @property {"topK"|"band_quota"} selection_method
 * @property {number} budget_K
 * @property {number} [maxK]
 * @property {"identity"|"energy"|"band_profile"} invariance_lens
 * @property {CompressionThresholds} thresholds
 * @property {BandQuotaSpec} [band_quota]
 * @property {boolean} [include_dc=true]
 * @property {boolean} [respect_novelty_boundary=true]
 * @property {number[]} [band_edges]
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
 * @property {Object} uncertainty.time
 * @property {number|null} uncertainty.time.dt_nominal
 * @property {number|null} uncertainty.time.jitter_rms
 * @property {number} uncertainty.time.gap_total_duration
 * @property {number} uncertainty.time.monotonicity_violations
 * @property {number|null} uncertainty.time.drift_ppm
 * @property {number|null} uncertainty.time.fit_residual_rms
 * @property {number|null} uncertainty.time.post_align_jitter
 * @property {Object} uncertainty.phase_by_band
 * @property {number[]} uncertainty.phase_by_band.band_edges
 * @property {number[]} uncertainty.phase_by_band.sigma_phi
 * @property {string} uncertainty.phase_by_band.source
 * @property {Object} uncertainty.replay
 * @property {number} uncertainty.replay.recon_mae
 * @property {number} uncertainty.replay.recon_rmse
 * @property {number|null} uncertainty.replay.parseval_error
 * @property {Object} uncertainty.distortion
 * @property {number} uncertainty.distortion.energy_residual
 * @property {number} uncertainty.distortion.band_profile_divergence
 * @property {number|null} uncertainty.distortion.phase_align_residual
 * @property {Object} confidence
 * @property {Object} confidence.by_invariant
 * @property {number} confidence.by_invariant.identity
 * @property {number} confidence.by_invariant.energy
 * @property {number} confidence.by_invariant.band_profile
 * @property {number} confidence.overall
 * @property {string} confidence.method
 * @property {{
*   passes_invariance_bounds: boolean;
*   eligible_for_archive_tier: boolean;
*   blocked_reason: string | null;
* }} gates
 * @property {"none"|"low_identity"|"low_energy"|"low_band"|"novelty_boundary"} gates.blocked_reason: string | null;
 * @property {Object} receipts
 * @property {Object} receipts.compress
 * @property {string} receipts.compress.policy_id
 * @property {number} receipts.compress.budget_K
 * @property {"topK"|"band_quota"} receipts.compress.selection_method
 * @property {CompressionThresholds} receipts.compress.thresholds
 * @property {boolean} receipts.compress.novelty_boundary_respected
 * @property {Object} receipts.provenance_anchor
 * @property {string[]} receipts.provenance_anchor.source_window_ids
 * @property {number} receipts.provenance_anchor.ingest_confidence_min
 * @property {number} receipts.provenance_anchor.clock_integrity_score
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
 * @typedef {Object} CompressResult
 * @property {true} ok
 * @property {HarmonicState} artifact
 *
 * @typedef {Object} CompressError
 * @property {false} ok
 * @property {string} error
 * @property {string[]} reasons
 *
 * @typedef {CompressResult | CompressError} CompressOutcome
 */

export class CompressOp {
    /**
     * @param {Object} cfg
     * @param {string} [cfg.operator_id="CompressOp"]
     * @param {string} [cfg.operator_version="0.1.0"]
     */
    constructor(cfg = {}) {
        this.operator_id = cfg.operator_id ?? "CompressOp";
        this.operator_version = cfg.operator_version ?? "0.1.0";
    }

    /**
     * @param {Object} input
     * @param {Object} input.s1
     * @param {"S1"} input.s1.artifact_class
     * @param {string} input.s1.stream_id
     * @param {string} input.s1.window_id
     * @param {Object} input.s1.grid
     * @param {number} input.s1.grid.Fs_target
     * @param {number} input.s1.grid.N
     * @param {number} input.s1.grid.frequency_resolution
     * @param {Array<{k:number,freq_hz:number,re:number,im:number,magnitude:number,phase:number}>} input.s1.spectrum
     * @param {Object} input.s1.transform_receipt
     * @param {Object} input.s1.policies
     * @param {Object} input.context
     * @param {string} input.context.segment_id
     * @param {Object} [input.context.time_uncertainty]
     * @param {Object} [input.context.provenance_anchor]
     * @param {boolean} [input.context.novelty_boundary_detected]
     * @param {CompressionPolicy} input.compression_policy
     * @returns {CompressOutcome}
     */
    run(input) {
        const { s1, compression_policy, context } = input ?? {};
        const reasons = [];

        if (!s1 || s1.artifact_class !== "S1") {
            reasons.push("input.s1 must be a valid S1 SpectralFrame");
        }
        if (!s1.policies?.clock_policy_id || typeof s1.policies.clock_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_S1",
                reasons: ["S1.policies.clock_policy_id must be a valid policy reference"],
            };
        }

        if (!s1.policies?.grid_policy_id || typeof s1.policies.grid_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_S1",
                reasons: ["S1.policies.grid_policy_id must be a valid policy reference"],
            };
        }

        if (!s1.policies?.window_policy_id || typeof s1.policies.window_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_S1",
                reasons: ["S1.policies.window_policy_id must be a valid policy reference"],
            };
        }

        if (!s1.policies?.transform_policy_id || typeof s1.policies.transform_policy_id !== "string") {
            return {
                ok: false,
                error: "INVALID_S1",
                reasons: ["S1.policies.transform_policy_id must be a valid policy reference"],
            };
        }
        if (!compression_policy) {
            reasons.push("compression_policy is required");
        }
        if (reasons.length > 0) {
            return { ok: false, error: "INVALID_SCHEMA", reasons };
        }

        const spectrum = s1.spectrum ?? [];
        const N = s1.grid?.N;
        const Fs = s1.grid?.Fs_target;
        const df = s1.grid?.frequency_resolution;

        if (!context || typeof context !== "object") {
            return {
                ok: false,
                error: "MISSING_CONTEXT",
                reasons: ["context is required (must supply segment_id and window_span)"],
            };
        }

        const tStart = context.window_span?.t_start;
        const tEnd = context.window_span?.t_end;

        if (!Array.isArray(spectrum) || spectrum.length === 0) {
            return { ok: false, error: "INVALID_S1", reasons: ["S1.spectrum must be non-empty"] };
        }
        if (!Number.isFinite(N) || !Number.isFinite(Fs) || !Number.isFinite(df)) {
            return { ok: false, error: "INVALID_S1", reasons: ["S1 grid must define Fs_target, N, frequency_resolution"] };
        }
        if (!Number.isFinite(tStart) || !Number.isFinite(tEnd)) {
            return {
                ok: false,
                error: "MISSING_WINDOW_SPAN",
                reasons: ["context.window_span is required (t_start and t_end must be finite)"],
            };
        }

        if (compression_policy.respect_novelty_boundary && context.novelty_boundary_detected) {
            return {
                ok: false,
                error: "NOVELTY_BOUNDARY_BLOCK",
                reasons: ["Compression blocked because novelty boundary is active under current policy"],
            };
        }
        // segment_id is required: it becomes the H1 segment identity used by AnomalyOp
        // and MergeOp for grouping and eligibility. A fabricated "seg_default" would
        // silently merge H1s from different segments.
        if (!context.segment_id || typeof context.segment_id !== "string") {
            return {
                ok: false,
                error: "MISSING_SEGMENT_ID",
                reasons: ["context.segment_id is required; H1 segment identity cannot be fabricated"],
            };
        }

        const includeDC = compression_policy.include_dc ?? true;
        const maxK = compression_policy.maxK ?? compression_policy.budget_K;
        const bandEdges =
            compression_policy.band_edges ??
            compression_policy.band_quota?.band_edges ??
            defaultBandEdges(Fs);

        if (!Array.isArray(bandEdges) || bandEdges.length < 2) {
            return {
                ok: false,
                error: "INVALID_POLICY",
                reasons: ["CompressionPolicy must declare usable band_edges"],
            };
        }

        const selectionMethod = compression_policy.selection_method ?? "topK";
        let kept = selectBins({
            spectrum,
            selectionMethod,
            budgetK: compression_policy.budget_K,
            includeDC,
            bandQuota: compression_policy.band_quota,
        });

        // Deterministic invariant-driven budget escalation
        let evalResult = evaluateCompression({
            spectrum,
            kept,
            N,
            bandEdges,
            thresholds: compression_policy.thresholds,
        });

        while (
            !evalResult.pass &&
            kept.length < maxK
        ) {
            kept = selectBins({
                spectrum,
                selectionMethod,
                budgetK: kept.length + 1,
                includeDC,
                bandQuota: compression_policy.band_quota,
            });

            evalResult = evaluateCompression({
                spectrum,
                kept,
                N,
                bandEdges,
                thresholds: compression_policy.thresholds,
            });
        }

        if (!evalResult.pass) {
            return {
                ok: false,
                error: "INVARIANCE_BOUNDS_FAILED",
                reasons: [
                    `recon_rmse=${evalResult.recon_rmse} exceeds ${compression_policy.thresholds.max_recon_rmse} or`,
                    `energy_residual=${evalResult.energy_residual} exceeds ${compression_policy.thresholds.max_energy_residual} or`,
                    `band_profile_divergence=${evalResult.band_profile_divergence} exceeds ${compression_policy.thresholds.max_band_divergence}`,
                ],
            };
        }

        const energyRaw = sumEnergy(spectrum);
        const energyKept = sumEnergy(kept);
        const energyNorm = energyRaw === 0 ? 0 : energyKept / energyRaw;
        const bandProfileNorm = computeBandProfile(kept, bandEdges);
        const identityConfidence = scoreThreshold(evalResult.recon_rmse, compression_policy.thresholds.max_recon_rmse);
        const energyConfidence = scoreThreshold(evalResult.energy_residual, compression_policy.thresholds.max_energy_residual);
        const bandConfidence = scoreThreshold(evalResult.band_profile_divergence, compression_policy.thresholds.max_band_divergence);
        const overallConfidence = Math.max(0, Math.min(identityConfidence, energyConfidence, bandConfidence));
        const archiveEligible = overallConfidence >= 0.75;

        const blockedReason =
            context.novelty_boundary_detected
                ? "novelty_boundary"
                : overallConfidence < 1
                    ? lowestInvariant(identityConfidence, energyConfidence, bandConfidence)
                    : "none";

        /** @type {HarmonicState} */
        const artifact = {
            artifact_type: "HarmonicState",
            artifact_class: "H1",
            state_id: makeStateId(
                s1.stream_id,
                context.segment_id,
                tStart,
                tEnd
            ),
            stream_id: s1.stream_id,
            segment_id: context.segment_id,
            window_span: {
                t_start: tStart,
                t_end: tEnd,
                duration_sec: tEnd - tStart,
                window_count: 1,
            },
            grid: {
                Fs_target: Fs,
                N,
                df,
                bin_count_full: spectrum.length,
                bin_count_kept: kept.length,
            },
            kept_bins: kept.map((b) => ({ ...b })),
            invariants: {
                energy_raw: energyRaw,
                energy_norm: energyNorm,
                band_profile_norm: bandProfileNorm,
            },
            uncertainty: {
                time: {
                    dt_nominal: context.time_uncertainty?.dt_nominal ?? null,
                    jitter_rms: context.time_uncertainty?.jitter_rms ?? null,
                    gap_total_duration: context.time_uncertainty?.gap_total_duration ?? 0,
                    monotonicity_violations: context.time_uncertainty?.monotonicity_violations ?? 0,
                    drift_ppm: context.time_uncertainty?.drift_ppm ?? null,
                    fit_residual_rms: context.time_uncertainty?.fit_residual_rms ?? null,
                    post_align_jitter: context.time_uncertainty?.post_align_jitter ?? null,
                },
                phase_by_band: {
                    band_edges: [...bandEdges],
                    sigma_phi: estimatePhaseSigmaByBand(kept, bandEdges),
                    source: "derived_from_time",
                },
                replay: {
                    recon_mae: evalResult.recon_mae,
                    recon_rmse: evalResult.recon_rmse,
                    parseval_error: s1.transform_receipt?.parseval_error ?? null,
                },
                distortion: {
                    energy_residual: evalResult.energy_residual,
                    band_profile_divergence: evalResult.band_profile_divergence,
                    phase_align_residual: null,
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
            gates: {
                passes_invariance_bounds: blockedReason === "none",
                eligible_for_archive_tier: archiveEligible,
                blocked_reason: blockedReason,
            },
            receipts: {
                compress: {
                    policy_id: compression_policy.policy_id,
                    budget_K: kept.length,
                    selection_method: selectionMethod,
                    thresholds: { ...compression_policy.thresholds },
                    novelty_boundary_respected: !(context.novelty_boundary_detected ?? false),
                },
                // receipts.merge is absent on H1: H1 has never been merged.
                // MergeOp writes merge receipts onto M1. A merge receipt on H1 is dishonest.
                provenance_anchor: {
                    source_window_ids: [s1.window_id],
                    ingest_confidence_min: context.provenance_anchor?.ingest_confidence_min ?? 1.0,
                    clock_integrity_score: context.provenance_anchor?.clock_integrity_score ?? 1.0,
                },
            },
            policies: {
                clock_policy_id: s1.policies.clock_policy_id,
                grid_policy_id: s1.policies.grid_policy_id,
                window_policy_id: s1.policies.window_policy_id,
                transform_policy_id: s1.policies.transform_policy_id,
                compression_policy_id: makeCompressionPolicyId(compression_policy),
            },
            provenance: {
                input_refs: [makeInputRef(s1)],
                operator_id: this.operator_id,
                operator_version: this.operator_version,
            },
        };

        return { ok: true, artifact };
    }
}

/**
 * Deterministic bin selection.
 */
function selectBins({ spectrum, selectionMethod, budgetK, includeDC, bandQuota }) {
    const bins = [...spectrum];

    const dc = bins.find((b) => b.k === 0);
    const nonDC = bins.filter((b) => b.k !== 0);

    if (selectionMethod === "band_quota" && bandQuota?.band_edges?.length >= 2) {
        const out = [];
        const minBinsPerBand = bandQuota.min_bins_per_band ?? 0;

        for (let i = 0; i < bandQuota.band_edges.length - 1; i++) {
            const f0 = bandQuota.band_edges[i];
            const f1 = bandQuota.band_edges[i + 1];
            const bandBins = nonDC
                .filter((b) => b.freq_hz >= f0 && b.freq_hz < f1)
                .sort(compareBins);

            for (let j = 0; j < Math.min(minBinsPerBand, bandBins.length); j++) {
                out.push(bandBins[j]);
            }
        }

        const used = new Set(out.map((b) => b.k));
        const remaining = nonDC.filter((b) => !used.has(b.k)).sort(compareBins);

        while (out.length < budgetK - (includeDC && dc ? 1 : 0) && remaining.length > 0) {
            out.push(remaining.shift());
        }

        const result = includeDC && dc ? [dc, ...out] : out;
        return stableDedup(result).slice(0, budgetK);
    }

    const ranked = nonDC.sort(compareBins);
    const result = includeDC && dc
        ? [dc, ...ranked.slice(0, Math.max(0, budgetK - 1))]
        : ranked.slice(0, budgetK);

    return stableDedup(result);
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

function evaluateCompression({ spectrum, kept, N, bandEdges, thresholds }) {
    const fullByK = new Map(spectrum.map((b) => [b.k, b]));
    const keptByK = new Map(kept.map((b) => [b.k, b]));
    const fullVector = buildComplexVector(fullByK, N);
    const keptVector = buildComplexVector(keptByK, N);

    const xFull = inverseFromComplex(fullVector);
    const xKept = inverseFromComplex(keptVector);

    const reconMae = mae(xFull, xKept);
    const reconRmse = rmse(xFull, xKept);

    const fullEnergy = sumEnergy(spectrum);
    const keptEnergy = sumEnergy(kept);
    const energyResidual = fullEnergy === 0 ? 0 : Math.max(0, (fullEnergy - keptEnergy) / fullEnergy);

    const fullBand = computeBandProfile(spectrum, bandEdges);
    const keptBand = computeBandProfile(kept, bandEdges);
    const bandProfileDivergence = l1(
        fullBand.band_energy,
        keptBand.band_energy
    );

    const pass =
        reconRmse <= thresholds.max_recon_rmse &&
        energyResidual <= thresholds.max_energy_residual &&
        bandProfileDivergence <= thresholds.max_band_divergence;

    return {
        pass,
        recon_mae: reconMae,
        recon_rmse: reconRmse,
        energy_residual: energyResidual,
        band_profile_divergence: bandProfileDivergence,
    };
}

function buildComplexVector(byK, N) {
    const X = new Array(N).fill(null).map(() => ({ re: 0, im: 0 }));
    const kMax = Math.floor(N / 2);

    for (let k = 0; k <= kMax; k++) {
        const b = byK.get(k);
        if (!b) continue;
        X[k] = { re: b.re, im: b.im };

        // Real-input conjugate mirror, excluding DC/Nyquist
        if (k > 0 && k < N - k) {
            X[N - k] = { re: b.re, im: -b.im };
        }
    }

    return X;
}

function inverseFromComplex(X) {
    const N = X.length;
    const x = new Array(N).fill(0);

    for (let n = 0; n < N; n++) {
        let sum = 0;
        for (let k = 0; k < N; k++) {
            const theta = (2 * Math.PI * k * n) / N;
            sum += X[k].re * Math.cos(theta) - X[k].im * Math.sin(theta);
        }
        x[n] = sum / N;
    }

    return x;
}

function computeBandProfile(bins, bandEdges) {
    const bandEnergy = new Array(bandEdges.length - 1).fill(0);

    for (const b of bins) {
        const e = b.re * b.re + b.im * b.im;
        const idx = findBand(b.freq_hz, bandEdges);
        if (idx >= 0) bandEnergy[idx] += e;
    }

    const total = bandEnergy.reduce((a, b) => a + b, 0);
    const normalized = total === 0
        ? bandEnergy.map(() => 0)
        : bandEnergy.map((x) => x / total);

    return {
        band_edges: [...bandEdges],
        band_energy: normalized,
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
    let c = 0;
    let s = 0;
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

function mae(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s / a.length;
}

function rmse(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) {
        const d = a[i] - b[i];
        s += d * d;
    }
    return Math.sqrt(s / a.length);
}

function l1(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
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

function makeCompressionPolicyId(policy) {
    return [
        "COMP",
        `pid=${policy.policy_id ?? "unspecified"}`,
        `select=${policy.selection_method ?? "topK"}`,
        `budget=${policy.budget_K}`,
        `maxK=${policy.maxK ?? policy.budget_K}`,
        `lens=${policy.invariance_lens ?? "unspecified"}`,
        `recon=${policy.thresholds?.max_recon_rmse}`,
        `energy=${policy.thresholds?.max_energy_residual}`,
        `band=${policy.thresholds?.max_band_divergence}`,
        `dc=${policy.include_dc ?? true}`,
        `novelty=${policy.respect_novelty_boundary ?? true}`,
        `numeric=${policy.numeric_policy ?? "tolerant"}`,
    ].join(":");
}

function defaultBandEdges(Fs) {
    const nyquist = Fs / 2;
    const edges = [0, 1, 4, 8, 16, 32, 64, 128, 256, 512, 1024, nyquist];
    const uniq = [...new Set(edges.filter((x) => x >= 0 && x <= nyquist))].sort((a, b) => a - b);
    if (uniq[uniq.length - 1] !== nyquist) uniq.push(nyquist);
    if (uniq[0] !== 0) uniq.unshift(0);
    return uniq;
}

function makeStateId(streamId, segmentId, tStart, tEnd) {
    return `H1:${streamId}:${segmentId}:${tStart}:${tEnd}`;
}

function makeInputRef(s1) {
    return `S1:${s1.stream_id}:${s1.window_id}`;
}
