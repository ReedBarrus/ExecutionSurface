// runtime/CrossRunDynamicsReport.js

/**
 * CrossRunDynamicsReport
 *
 * Layer:
 *   Read-side runtime comparison helper.
 *   Not a pipeline operator. Not an authority-bearing artifact.
 *
 * Purpose:
 *   Compare multiple completed Door One runs using:
 *     - substrate summaries
 *     - transition reports
 *     - trajectory interpretation
 *     - attention/memory overlays
 *
 * Boundary contract:
 *   - derived / observational comparison only
 *   - not canon
 *   - not promotion
 *   - not prediction
 *   - not ontology
 *   - does not mutate input runs
 *   - does not recompute authoritative artifacts
 *   - does not claim true dynamical basin membership
 *
 * Output:
 *   Plain-data cross-run comparison report with:
 *     - per-run signatures
 *     - pairwise comparisons
 *     - reproducibility summary
 *     - flags / notes
 */

export class CrossRunDynamicsReport {
    /**
     * @param {Object} [opts]
     * @param {string} [opts.default_run_label_prefix="run"]
     * @param {number} [opts.high_similarity_ratio=0.75]
     * @param {number} [opts.medium_similarity_ratio=0.45]
     * @param {number} [opts.high_reproducibility_ratio=0.75]
     * @param {number} [opts.medium_reproducibility_ratio=0.45]
     */
    constructor(opts = {}) {
        this.cfg = {
            default_run_label_prefix: opts.default_run_label_prefix ?? "run",
            high_similarity_ratio: opts.high_similarity_ratio ?? 0.75,
            medium_similarity_ratio: opts.medium_similarity_ratio ?? 0.45,
            high_reproducibility_ratio: opts.high_reproducibility_ratio ?? 0.75,
            medium_reproducibility_ratio: opts.medium_reproducibility_ratio ?? 0.45,
        };
    }

    /**
     * Compare multiple Door One runs.
     *
     * @param {Array<Object>} runResults
     * @param {Object} [opts]
     * @returns {Object}
     */
    compare(runResults, opts = {}) {
        if (!Array.isArray(runResults) || runResults.length === 0) {
            return {
                ok: false,
                error: "INVALID_INPUT",
                reasons: ["CrossRunDynamicsReport requires a non-empty array of successful DoorOneOrchestrator results"],
            };
        }

        const badIndex = runResults.findIndex(r => !r?.ok);
        if (badIndex !== -1) {
            return {
                ok: false,
                error: "INVALID_RUN",
                reasons: [`Run at index ${badIndex} is not a successful DoorOneOrchestrator result`],
            };
        }

        const labeledRuns = runResults.map((result, idx) => ({
            run_label: this._resolveRunLabel(result, idx, opts),
            result,
        }));

        const perRunSignatures = labeledRuns.map(({ run_label, result }) =>
            this._extractRunSignature(run_label, result)
        );

        const pairwiseComparisons = this._buildPairwiseComparisons(perRunSignatures);

        const reproducibilitySummary = this._buildReproducibilitySummary(
            perRunSignatures,
            pairwiseComparisons
        );

        const dynamicsFlags = this._deriveFlags({
            pairwiseComparisons,
            reproducibilitySummary,
        });

        const notes = this._buildNotes({
            runCount: labeledRuns.length,
            pairwiseComparisons,
            reproducibilitySummary,
        });

        return {
            report_type: "runtime:cross_run_dynamics_report",
            generated_from:
                "Evidence-led comparison of multiple Door One runs using structural/support evidence first and bounded semantic overlay summaries second; not canon, not promotion, not ontology, not same-object closure",
            comparison_posture: "evidence_first_cross_run_comparison",
            claim_ceiling: "comparative_support_only",
            scope: {
                run_count: labeledRuns.length,
                run_labels: labeledRuns.map(r => r.run_label),
                stream_ids: this._unique(
                    labeledRuns.map(r => r.result?.artifacts?.a1?.stream_id).filter(Boolean)
                ),
            },

            per_run_signatures: perRunSignatures,
            pairwise_comparisons: pairwiseComparisons,
            reproducibility_summary: reproducibilitySummary,

            dynamics_flags: dynamicsFlags,
            explicit_non_claims: [
                "not same-object closure",
                "not memory closure",
                "not identity closure",
                "not promotion",
                "not canon",
                "not truth",
            ],
            notes,
        };
    }

    // -------------------------------------------------------------------------
    // Per-run signature extraction
    // -------------------------------------------------------------------------

    _extractRunSignature(runLabel, result) {
        const substrate = result?.substrate ?? {};
        const trajectory =
            result?.semantic_overlay?.trajectory ??
            result?.interpretation?.trajectory ??
            {};
        const attentionMemory =
            result?.semantic_overlay?.attention_memory ??
            result?.interpretation?.attention_memory ??
            {};

        const sig = {
            convergence: trajectory?.trajectory_character?.convergence ?? "unknown",
            motion: trajectory?.trajectory_character?.motion ?? "unknown",
            occupancy: trajectory?.neighborhood_character?.occupancy ?? "unknown",
            transition_density: trajectory?.neighborhood_character?.transition_density ?? "unknown",
            recurrence_strength: trajectory?.neighborhood_character?.recurrence_strength ?? "unknown",
            continuity: trajectory?.segment_character?.continuity ?? "unknown",
            boundary_density: trajectory?.segment_character?.boundary_density ?? "unknown",

            attention_concentration: attentionMemory?.attention_character?.concentration ?? "unknown",
            attention_persistence: attentionMemory?.attention_character?.persistence ?? "unknown",
            attention_volatility: attentionMemory?.attention_character?.volatility ?? "unknown",
            support_persistence: attentionMemory?.support_persistence?.posture ?? "unknown",
            reuse_pressure: attentionMemory?.reuse_pressure?.posture ?? "unknown",
            memory_candidate_posture: attentionMemory?.memory_candidate_posture?.posture ?? "unknown",

            memory_recurrence_strength: attentionMemory?.memory_character?.recurrence_strength ?? "unknown",
            memory_persistence: attentionMemory?.memory_character?.persistence ?? "unknown",
            memory_stability: attentionMemory?.memory_character?.stability ?? "unknown",
        };

        const evidence = {
            h1_count: this._finiteOrZero(result?.artifacts?.h1s?.length),
            m1_count: this._finiteOrZero(result?.artifacts?.m1s?.length),
            anomaly_count: this._finiteOrZero(result?.artifacts?.anomaly_reports?.length),
            query_present: result?.artifacts?.q ? 1 : 0,
            state_count: this._finiteOrZero(substrate?.state_count),
            basin_count: this._finiteOrZero(substrate?.basin_count),
            segment_count: this._finiteOrZero(substrate?.segment_count),
            trajectory_frames: this._finiteOrZero(substrate?.trajectory_frames),

            total_transitions: this._finiteOrZero(substrate?.transition_report?.total_transitions),
            total_re_entries: this._finiteOrZero(substrate?.transition_report?.total_re_entries),
            dominant_dwell_share: this._finiteOrZero(
                trajectory?.neighborhood_character?.evidence?.dominant_dwell_share
            ),
            current_dwell_count: this._finiteOrZero(
                trajectory?.neighborhood_character?.evidence?.current_dwell_count
            ),
            current_dwell_duration_sec: this._finiteOrZero(
                trajectory?.neighborhood_character?.evidence?.current_dwell_duration_sec
            ),
            transition_density_value: this._finiteOrZero(
                trajectory?.neighborhood_character?.evidence?.transition_density_value
            ),
        };

        return {
            run_label: runLabel,
            comparison_posture: "structural_support_signature_with_subordinate_semantic_summary",
            claim_ceiling: "comparative_support_only",
            signature: sig,
            evidence,
            explicit_non_claims: [
                "not same-object verdict",
                "not memory closure",
                "not identity closure",
                "not promotion",
            ],
        };
    }

    _resolveRunLabel(result, idx, opts) {
        return (
            opts?.run_labels?.[idx] ??
            result?.run_label ??
            result?.meta?.run_label ??
            `${this.cfg.default_run_label_prefix}_${idx + 1}`
        );
    }

    // -------------------------------------------------------------------------
    // Pairwise comparison
    // -------------------------------------------------------------------------

    _buildPairwiseComparisons(perRunSignatures) {
        const rows = [];

        for (let i = 0; i < perRunSignatures.length; i += 1) {
            for (let j = i + 1; j < perRunSignatures.length; j += 1) {
                rows.push(this._compareSignatures(perRunSignatures[i], perRunSignatures[j]));
            }
        }

        return rows;
    }

    _compareSignatures(a, b) {
        const sigA = a.signature;
        const sigB = b.signature;

        const keys = Object.keys(sigA);
        let sharedLabels = 0;
        let differingLabels = 0;

        for (const key of keys) {
            if (sigA[key] === sigB[key]) sharedLabels += 1;
            else differingLabels += 1;
        }

        const semanticSimilarityRatio = this._safeRatio(sharedLabels, keys.length);
        const evidenceSimilarityRatio = this._evidenceSimilarityRatio(a.evidence, b.evidence);
        const similarity = this._labelSimilarity(evidenceSimilarityRatio);

        const differences = {
            convergence_changed: sigA.convergence !== sigB.convergence,
            motion_changed: sigA.motion !== sigB.motion,
            occupancy_changed: sigA.occupancy !== sigB.occupancy,
            continuity_changed: sigA.continuity !== sigB.continuity,
            attention_shift: this._labelOrdinalShift(sigA.attention_concentration, sigB.attention_concentration),
            memory_shift: this._labelOrdinalShift(sigA.memory_stability, sigB.memory_stability),
        };

        const evidence = {
            shared_labels: sharedLabels,
            differing_labels: differingLabels,
            similarity_ratio: evidenceSimilarityRatio,
            semantic_similarity_ratio: semanticSimilarityRatio,
            evidence_priority: "structural_support_primary",

            h1_count_delta: this._absDelta(a.evidence.h1_count, b.evidence.h1_count),
            m1_count_delta: this._absDelta(a.evidence.m1_count, b.evidence.m1_count),
            anomaly_count_delta: this._absDelta(a.evidence.anomaly_count, b.evidence.anomaly_count),
            query_present_delta: this._absDelta(a.evidence.query_present, b.evidence.query_present),
            state_count_delta: this._absDelta(a.evidence.state_count, b.evidence.state_count),
            basin_count_delta: this._absDelta(a.evidence.basin_count, b.evidence.basin_count),
            segment_count_delta: this._absDelta(a.evidence.segment_count, b.evidence.segment_count),
            total_transitions_delta: this._absDelta(a.evidence.total_transitions, b.evidence.total_transitions),
            total_re_entries_delta: this._absDelta(a.evidence.total_re_entries, b.evidence.total_re_entries),
            dominant_dwell_share_delta: this._absDelta(a.evidence.dominant_dwell_share, b.evidence.dominant_dwell_share),
            transition_density_delta: this._absDelta(a.evidence.transition_density_value, b.evidence.transition_density_value),
        };

        return {
            run_a: a.run_label,
            run_b: b.run_label,
            comparison_posture: "evidence_first_pairwise_comparison",
            claim_ceiling: "comparative_support_only",
            similarity,
            differences,
            evidence,
            semantic_summary: {
                label_similarity: this._labelSimilarity(semanticSimilarityRatio),
                label_similarity_ratio: semanticSimilarityRatio,
                subordinate_to_evidence: true,
                caution_posture:
                    semanticSimilarityRatio > evidenceSimilarityRatio
                        ? "semantic_similarity_narrowed_to_structural_support"
                        : null,
            },
            explicit_non_claims: [
                "not same-object closure",
                "not identity preservation verdict",
                "not readiness uplift",
                "not promotion",
            ],
        };
    }

    _labelSimilarity(ratio) {
        if (ratio >= this.cfg.high_similarity_ratio) return "high";
        if (ratio >= this.cfg.medium_similarity_ratio) return "medium";
        return "low";
    }

    _labelOrdinalShift(a, b) {
        const idxA = this._ordinalIndex(a);
        const idxB = this._ordinalIndex(b);

        if (idxA === -1 || idxB === -1) return "unknown";
        const d = Math.abs(idxA - idxB);
        if (d >= 2) return "high";
        if (d === 1) return "medium";
        return "low";
    }

    _ordinalIndex(label) {
        const order = ["low", "medium", "high"];
        return order.indexOf(label);
    }

    // -------------------------------------------------------------------------
    // Reproducibility summary
    // -------------------------------------------------------------------------

    _buildReproducibilitySummary(perRunSignatures, pairwiseComparisons) {
        if (perRunSignatures.length <= 1) {
            return {
                comparison_posture: "evidence_first_reproducibility_summary",
                claim_ceiling: "comparative_support_only",
                structural_reproducibility: "insufficient_data",
                convergence_reproducibility: "insufficient_data",
                neighborhood_reproducibility: "insufficient_data",
                segment_reproducibility: "insufficient_data",
                overlay_reproducibility: "insufficient_data",
                overall_reproducibility: "insufficient_data",
                explicit_non_claims: [
                    "not same-object closure",
                    "not memory closure",
                    "not identity closure",
                ],
            };
        }

        const structuralRepro = this._labelPairwiseEvidenceReproducibility(pairwiseComparisons);
        const convergenceRepro = this._labelRunwiseAgreement(perRunSignatures, ["convergence", "motion"]);
        const neighborhoodRepro = this._labelRunwiseAgreement(perRunSignatures, ["occupancy", "transition_density", "recurrence_strength"]);
        const segmentRepro = this._labelRunwiseAgreement(perRunSignatures, ["continuity", "boundary_density"]);
        const overlayRepro = this._labelRunwiseAgreement(perRunSignatures, [
            "attention_concentration",
            "attention_persistence",
            "attention_volatility",
            "support_persistence",
            "reuse_pressure",
            "memory_candidate_posture",
            "memory_recurrence_strength",
            "memory_persistence",
            "memory_stability",
        ]);

        return {
            comparison_posture: "evidence_first_reproducibility_summary",
            claim_ceiling: "comparative_support_only",
            structural_reproducibility: structuralRepro,
            convergence_reproducibility: convergenceRepro,
            neighborhood_reproducibility: neighborhoodRepro,
            segment_reproducibility: segmentRepro,
            overlay_reproducibility: overlayRepro,
            overall_reproducibility: structuralRepro,
            explicit_non_claims: [
                "not same-object closure",
                "not identity closure",
                "not promotion",
            ],
        };
    }

    _labelRunwiseAgreement(perRunSignatures, keys) {
        const pairCount = this._pairCount(perRunSignatures.length);
        if (pairCount === 0) return "insufficient_data";

        let matches = 0;
        let total = 0;

        for (let i = 0; i < perRunSignatures.length; i += 1) {
            for (let j = i + 1; j < perRunSignatures.length; j += 1) {
                for (const key of keys) {
                    total += 1;
                    if (perRunSignatures[i].signature[key] === perRunSignatures[j].signature[key]) {
                        matches += 1;
                    }
                }
            }
        }

        const ratio = this._safeRatio(matches, total);
        if (ratio >= this.cfg.high_reproducibility_ratio) return "high";
        if (ratio >= this.cfg.medium_reproducibility_ratio) return "medium";
        return "low";
    }

    _labelOverallReproducibility(meanScore) {
        if (meanScore === null) return "insufficient_data";
        if (meanScore >= 2.5) return "high";
        if (meanScore >= 1.5) return "medium";
        return "low";
    }

    _reproScore(label) {
        if (label === "high") return 3;
        if (label === "medium") return 2;
        if (label === "low") return 1;
        return null;
    }

    _labelPairwiseEvidenceReproducibility(pairwiseComparisons) {
        if (!Array.isArray(pairwiseComparisons) || pairwiseComparisons.length === 0) {
            return "insufficient_data";
        }

        const ratios = pairwiseComparisons
            .map(row => this._finiteOrNull(row?.evidence?.similarity_ratio))
            .filter(v => v !== null);

        if (ratios.length === 0) return "insufficient_data";

        const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
        if (mean >= this.cfg.high_reproducibility_ratio) return "high";
        if (mean >= this.cfg.medium_reproducibility_ratio) return "medium";
        return "low";
    }

    _pairCount(n) {
        return (n * (n - 1)) / 2;
    }

    _evidenceSimilarityRatio(aEvidence, bEvidence) {
        const checks = [
            this._withinDelta(aEvidence?.h1_count, bEvidence?.h1_count, 2),
            this._withinDelta(aEvidence?.m1_count, bEvidence?.m1_count, 2),
            this._withinDelta(aEvidence?.anomaly_count, bEvidence?.anomaly_count, 1),
            this._withinDelta(aEvidence?.query_present, bEvidence?.query_present, 0),
            this._withinDelta(aEvidence?.state_count, bEvidence?.state_count, 2),
            this._withinDelta(aEvidence?.basin_count, bEvidence?.basin_count, 1),
            this._withinDelta(aEvidence?.segment_count, bEvidence?.segment_count, 0),
            this._withinDelta(aEvidence?.total_transitions, bEvidence?.total_transitions, 2),
            this._withinDelta(aEvidence?.total_re_entries, bEvidence?.total_re_entries, 1),
            this._withinDelta(aEvidence?.dominant_dwell_share, bEvidence?.dominant_dwell_share, 0.15),
            this._withinDelta(aEvidence?.transition_density_value, bEvidence?.transition_density_value, 0.15),
        ];

        const matches = checks.filter(Boolean).length;
        return this._safeRatio(matches, checks.length);
    }

    // -------------------------------------------------------------------------
    // Flags / notes
    // -------------------------------------------------------------------------

    _deriveFlags({ pairwiseComparisons, reproducibilitySummary }) {
        const flags = [];

        if (reproducibilitySummary?.overall_reproducibility === "high") {
            flags.push("cross_run_reproducible");
        }

        if (reproducibilitySummary?.overlay_reproducibility === "high") {
            flags.push("overlay_stable");
        }

        if (reproducibilitySummary?.structural_reproducibility === "high") {
            flags.push("structural_support_stable");
        }

        if (pairwiseComparisons.some(r => r?.similarity === "low")) {
            flags.push("run_divergence_detected");
        }

        if (pairwiseComparisons.some(r => r?.semantic_summary?.caution_posture)) {
            flags.push("semantic_similarity_narrowed_to_evidence");
        }

        if (pairwiseComparisons.every(r => r?.similarity === "high") && pairwiseComparisons.length > 0) {
            flags.push("high_pairwise_agreement");
        }

        return flags;
    }

    _buildNotes({ runCount, pairwiseComparisons, reproducibilitySummary }) {
        const notes = [
            "Cross-run comparison is derived from completed Door One runs only.",
            "Structural/support evidence is compared first; semantic overlay summaries are subordinate and may not outrun the evidence basis.",
            "Similarity and reproducibility do not by themselves justify canon or promotion.",
            "Repeated structure strengthens evidence but does not prove ontology or true dynamical basin membership.",
            "Cross-run comparison does not by itself establish same-object continuity, memory closure, or identity closure across runs.",
        ];

        if (runCount <= 1) {
            notes.push("Cross-run reproducibility is limited by insufficient run count.");
        }

        if (pairwiseComparisons.some(r => r?.similarity === "low")) {
            notes.push("At least one run pair shows low structural/support similarity across compared runs.");
        }

        if (pairwiseComparisons.some(r => r?.semantic_summary?.caution_posture)) {
            notes.push("At least one run pair showed semantic-label similarity that was narrowed to the weaker structural/support evidence basis.");
        }

        if (reproducibilitySummary?.overall_reproducibility === "high") {
            notes.push("Overall structural/support comparison remains relatively reproducible across the provided runs.");
        }

        return notes;
    }

    // -------------------------------------------------------------------------
    // Small utilities
    // -------------------------------------------------------------------------

    _finiteOrZero(v) {
        return Number.isFinite(v) ? v : 0;
    }

    _safeRatio(a, b) {
        if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
        return a / b;
    }

    _absDelta(a, b) {
        const x = this._finiteOrZero(a);
        const y = this._finiteOrZero(b);
        return Math.abs(x - y);
    }

    _withinDelta(a, b, maxDelta) {
        return this._absDelta(a, b) <= maxDelta;
    }

    _finiteOrNull(v) {
        return Number.isFinite(v) ? v : null;
    }

    _unique(arr) {
        return [...new Set(arr)];
    }
}
