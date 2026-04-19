// runtime/CrossRunDynamicsReport.js

/**
 * CrossRunDynamicsReport
 *
 * Layer:
 *   Read-side runtime comparison helper.
 *   Not a pipeline operator. Not an authority-bearing artifact.
 *
 * Purpose:
 *   Compare multiple completed Door One runs using direct structural/support
 *   evidence only:
 *     - H1 / M1 state objects
 *     - anomaly reports
 *     - basin sets
 *     - substrate transition reports
 *
 * Boundary contract:
 *   - derived / observational comparison only
 *   - not canon
 *   - not promotion
 *   - not prediction
 *   - not ontology
 *   - does not mutate input runs
 *   - does not recompute authoritative artifacts
 *   - does not depend on semantic overlays or interpretation aliases
 *   - does not claim true dynamical basin membership
 *
 * Output:
 *   Plain-data cross-run comparison report with:
 *     - per-run structural/support signatures
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
                "Evidence-led comparison of multiple Door One runs using direct structural/support objects only; not canon, not promotion, not ontology, not same-object closure",
            comparison_posture: "direct_structural_support_comparison",
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
        const artifacts = result?.artifacts ?? {};
        const substrate = result?.substrate ?? {};
        const h1s = this._asArray(artifacts?.h1s);
        const m1s = this._asArray(artifacts?.m1s);
        const anomalies = this._asArray(artifacts?.anomaly_reports);
        const basins = this._flattenBasins(this._asArray(artifacts?.basin_sets));
        const transitionReport = substrate?.transition_report ?? {};

        const sig = {
            h1_band_profile_mean: this._meanProfile(
                h1s.map((state) => state?.invariants?.band_profile_norm?.band_energy)
            ),
            m1_band_profile_mean: this._meanProfile(
                m1s.map((state) => state?.invariants?.band_profile_norm?.band_energy)
            ),
            basin_band_profile_mean: this._meanProfile(
                basins.map((basin) => basin?.centroid_band_profile)
            ),
            dominant_frequency_hz_mean: this._mean(
                [...h1s, ...m1s].map((state) => this._dominantFrequencyHz(state))
            ),
            state_duration_sec_mean: this._mean(
                [...h1s, ...m1s].map((state) => state?.window_span?.duration_sec)
            ),
            transition_density: this._safeRatio(
                this._finiteOrZero(transitionReport?.total_transitions),
                Math.max(1, this._finiteOrZero(substrate?.trajectory_frames) - 1)
            ),
            recurrence_mean: this._mean(
                this._asArray(transitionReport?.recurrence).map((row) => row?.re_entry_count)
            ),
            basin_radius_mean: this._mean(basins.map((basin) => basin?.radius)),
            basin_member_count_mean: this._mean(basins.map((basin) => basin?.member_count)),
        };

        const anomalyEventCounts = this._countAnomalyEvents(anomalies);
        const evidence = {
            h1_count: this._finiteOrZero(h1s.length),
            m1_count: this._finiteOrZero(m1s.length),
            anomaly_count: this._finiteOrZero(anomalies.length),
            query_present: artifacts?.q ? 1 : 0,
            state_count: this._finiteOrZero(substrate?.state_count),
            basin_count: this._finiteOrZero(substrate?.basin_count),
            segment_count: this._finiteOrZero(substrate?.segment_count),
            trajectory_frames: this._finiteOrZero(substrate?.trajectory_frames),
            total_transitions: this._finiteOrZero(transitionReport?.total_transitions),
            total_re_entries: this._finiteOrZero(transitionReport?.total_re_entries),
            novelty_gate_count: anomalies.filter((row) => row?.novelty_gate_triggered === true).length,
            new_frequency_event_count: anomalyEventCounts.new_frequency,
            vanished_frequency_event_count: anomalyEventCounts.vanished_frequency,
            drift_event_count: anomalyEventCounts.drift,
            energy_shift_event_count: anomalyEventCounts.energy_shift,
        };

        return {
            run_label: runLabel,
            comparison_posture: "direct_structural_support_signature",
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
        const supportDistances = {
            h1_band_profile_distance: this._vectorDistance(
                sigA.h1_band_profile_mean,
                sigB.h1_band_profile_mean
            ),
            m1_band_profile_distance: this._vectorDistance(
                sigA.m1_band_profile_mean,
                sigB.m1_band_profile_mean
            ),
            basin_band_profile_distance: this._vectorDistance(
                sigA.basin_band_profile_mean,
                sigB.basin_band_profile_mean
            ),
            dominant_frequency_delta: this._absDelta(
                sigA.dominant_frequency_hz_mean,
                sigB.dominant_frequency_hz_mean
            ),
            state_duration_delta: this._absDelta(
                sigA.state_duration_sec_mean,
                sigB.state_duration_sec_mean
            ),
            transition_density_delta: this._absDelta(
                sigA.transition_density,
                sigB.transition_density
            ),
            recurrence_delta: this._absDelta(sigA.recurrence_mean, sigB.recurrence_mean),
            basin_radius_delta: this._absDelta(sigA.basin_radius_mean, sigB.basin_radius_mean),
            basin_member_count_delta: this._absDelta(
                sigA.basin_member_count_mean,
                sigB.basin_member_count_mean
            ),
        };

        const evidenceSimilarityRatio = this._evidenceSimilarityRatio(a.evidence, b.evidence, supportDistances);
        const similarity = this._labelSimilarity(evidenceSimilarityRatio);

        const differences = {
            h1_band_profile_changed: supportDistances.h1_band_profile_distance > 0.15,
            m1_band_profile_changed: supportDistances.m1_band_profile_distance > 0.15,
            basin_profile_changed: supportDistances.basin_band_profile_distance > 0.15,
            dominant_frequency_shift_hz: supportDistances.dominant_frequency_delta,
            transition_density_delta: supportDistances.transition_density_delta,
            recurrence_delta: supportDistances.recurrence_delta,
            basin_radius_delta: supportDistances.basin_radius_delta,
        };

        const evidence = {
            similarity_ratio: evidenceSimilarityRatio,
            evidence_priority: "structural_support_only",
            h1_count_delta: this._absDelta(a.evidence.h1_count, b.evidence.h1_count),
            m1_count_delta: this._absDelta(a.evidence.m1_count, b.evidence.m1_count),
            anomaly_count_delta: this._absDelta(a.evidence.anomaly_count, b.evidence.anomaly_count),
            query_present_delta: this._absDelta(a.evidence.query_present, b.evidence.query_present),
            state_count_delta: this._absDelta(a.evidence.state_count, b.evidence.state_count),
            basin_count_delta: this._absDelta(a.evidence.basin_count, b.evidence.basin_count),
            segment_count_delta: this._absDelta(a.evidence.segment_count, b.evidence.segment_count),
            total_transitions_delta: this._absDelta(a.evidence.total_transitions, b.evidence.total_transitions),
            total_re_entries_delta: this._absDelta(a.evidence.total_re_entries, b.evidence.total_re_entries),
            novelty_gate_count_delta: this._absDelta(
                a.evidence.novelty_gate_count,
                b.evidence.novelty_gate_count
            ),
            new_frequency_event_count_delta: this._absDelta(
                a.evidence.new_frequency_event_count,
                b.evidence.new_frequency_event_count
            ),
            energy_shift_event_count_delta: this._absDelta(
                a.evidence.energy_shift_event_count,
                b.evidence.energy_shift_event_count
            ),
            h1_band_profile_distance: supportDistances.h1_band_profile_distance,
            m1_band_profile_distance: supportDistances.m1_band_profile_distance,
            basin_band_profile_distance: supportDistances.basin_band_profile_distance,
            dominant_frequency_delta: supportDistances.dominant_frequency_delta,
            state_duration_delta: supportDistances.state_duration_delta,
            transition_density_delta: supportDistances.transition_density_delta,
            recurrence_delta: supportDistances.recurrence_delta,
            basin_radius_delta: supportDistances.basin_radius_delta,
            basin_member_count_delta: supportDistances.basin_member_count_delta,
        };

        return {
            run_a: a.run_label,
            run_b: b.run_label,
            comparison_posture: "evidence_first_pairwise_comparison",
            claim_ceiling: "comparative_support_only",
            similarity,
            differences,
            evidence,
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

    // -------------------------------------------------------------------------
    // Reproducibility summary
    // -------------------------------------------------------------------------

    _buildReproducibilitySummary(perRunSignatures, pairwiseComparisons) {
        if (perRunSignatures.length <= 1) {
            return {
                comparison_posture: "structural_support_reproducibility_summary",
                claim_ceiling: "comparative_support_only",
                count_reproducibility: "insufficient_data",
                support_profile_reproducibility: "insufficient_data",
                transition_reproducibility: "insufficient_data",
                basin_reproducibility: "insufficient_data",
                overall_reproducibility: "insufficient_data",
                explicit_non_claims: [
                    "not same-object closure",
                    "not memory closure",
                    "not identity closure",
                ],
            };
        }

        const countRepro = this._labelMeanRatio(
            pairwiseComparisons,
            (row) => this._pairwiseCountRatio(row)
        );
        const supportProfileRepro = this._labelMeanRatio(
            pairwiseComparisons,
            (row) => this._pairwiseSupportRatio(row)
        );
        const transitionRepro = this._labelMeanRatio(
            pairwiseComparisons,
            (row) => this._pairwiseTransitionRatio(row)
        );
        const basinRepro = this._labelMeanRatio(
            pairwiseComparisons,
            (row) => this._pairwiseBasinRatio(row)
        );
        const overallRepro = this._labelMeanRatio(
            pairwiseComparisons,
            (row) => row?.evidence?.similarity_ratio
        );

        return {
            comparison_posture: "structural_support_reproducibility_summary",
            claim_ceiling: "comparative_support_only",
            count_reproducibility: countRepro,
            support_profile_reproducibility: supportProfileRepro,
            transition_reproducibility: transitionRepro,
            basin_reproducibility: basinRepro,
            overall_reproducibility: overallRepro,
            explicit_non_claims: [
                "not same-object closure",
                "not identity closure",
                "not promotion",
            ],
        };
    }

    _evidenceSimilarityRatio(aEvidence, bEvidence, supportDistances) {
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
            this._withinDelta(aEvidence?.novelty_gate_count, bEvidence?.novelty_gate_count, 1),
            this._withinDelta(
                aEvidence?.new_frequency_event_count,
                bEvidence?.new_frequency_event_count,
                2
            ),
            this._withinDelta(
                aEvidence?.energy_shift_event_count,
                bEvidence?.energy_shift_event_count,
                2
            ),
            this._withinDelta(supportDistances?.h1_band_profile_distance, 0, 0.2),
            this._withinDelta(supportDistances?.m1_band_profile_distance, 0, 0.2),
            this._withinDelta(supportDistances?.basin_band_profile_distance, 0, 0.2),
            this._withinDelta(supportDistances?.dominant_frequency_delta, 0, 1.0),
            this._withinDelta(supportDistances?.state_duration_delta, 0, 0.5),
            this._withinDelta(supportDistances?.transition_density_delta, 0, 0.2),
            this._withinDelta(supportDistances?.recurrence_delta, 0, 1),
            this._withinDelta(supportDistances?.basin_radius_delta, 0, 0.25),
            this._withinDelta(supportDistances?.basin_member_count_delta, 0, 1),
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

        if (reproducibilitySummary?.support_profile_reproducibility === "high") {
            flags.push("support_profile_stable");
        }

        if (reproducibilitySummary?.count_reproducibility === "high") {
            flags.push("structural_support_stable");
        }

        if (reproducibilitySummary?.transition_reproducibility === "high") {
            flags.push("transition_pattern_stable");
        }

        if (reproducibilitySummary?.basin_reproducibility === "high") {
            flags.push("basin_profile_stable");
        }

        if (pairwiseComparisons.some(r => r?.similarity === "low")) {
            flags.push("run_divergence_detected");
        }

        if (pairwiseComparisons.every(r => r?.similarity === "high") && pairwiseComparisons.length > 0) {
            flags.push("high_pairwise_agreement");
        }

        return flags;
    }

    _buildNotes({ runCount, pairwiseComparisons, reproducibilitySummary }) {
        const notes = [
            "Cross-run comparison is derived from completed Door One runs only.",
            "Structural/support evidence is compared directly from runtime objects and substrate reports.",
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

        if (reproducibilitySummary?.overall_reproducibility === "high") {
            notes.push("Overall structural/support comparison remains relatively reproducible across the provided runs.");
        }

        return notes;
    }

    // -------------------------------------------------------------------------
    // Small utilities
    // -------------------------------------------------------------------------

    _asArray(value) {
        return Array.isArray(value) ? value : [];
    }

    _flattenBasins(basinSets) {
        return basinSets.flatMap((set) => this._asArray(set?.basins));
    }

    _dominantFrequencyHz(state) {
        const bins = this._asArray(state?.kept_bins)
            .filter((bin) => Number.isFinite(bin?.magnitude))
            .sort((a, b) => {
                if (b.magnitude !== a.magnitude) return b.magnitude - a.magnitude;
                return (a.k ?? 0) - (b.k ?? 0);
            });
        const nonDc = bins.find((bin) => bin?.k !== 0);
        return this._finiteOrNull((nonDc ?? bins[0])?.freq_hz);
    }

    _mean(values) {
        const finite = this._asArray(values).filter((value) => Number.isFinite(value));
        if (finite.length === 0) return null;
        return finite.reduce((sum, value) => sum + value, 0) / finite.length;
    }

    _meanProfile(profiles) {
        const valid = this._asArray(profiles).filter(
            (profile) => Array.isArray(profile) && profile.every((value) => Number.isFinite(value))
        );
        if (valid.length === 0) return [];
        const width = valid[0].length;
        if (!valid.every((profile) => profile.length === width)) return [];

        const totals = new Array(width).fill(0);
        for (const profile of valid) {
            for (let idx = 0; idx < width; idx += 1) {
                totals[idx] += profile[idx];
            }
        }
        return totals.map((value) => value / valid.length);
    }

    _vectorDistance(a, b) {
        const vecA = this._asArray(a);
        const vecB = this._asArray(b);
        if (vecA.length === 0 && vecB.length === 0) return 0;
        if (vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) return 1;

        let total = 0;
        for (let idx = 0; idx < vecA.length; idx += 1) {
            total += Math.abs((vecA[idx] ?? 0) - (vecB[idx] ?? 0));
        }
        return total;
    }

    _countAnomalyEvents(anomalies) {
        const counts = {
            new_frequency: 0,
            vanished_frequency: 0,
            drift: 0,
            energy_shift: 0,
        };
        for (const anomaly of this._asArray(anomalies)) {
            for (const event of this._asArray(anomaly?.detected_events)) {
                const key = event?.type;
                if (key in counts) counts[key] += 1;
            }
        }
        return counts;
    }

    _labelMeanRatio(rows, picker) {
        if (!Array.isArray(rows) || rows.length === 0) return "insufficient_data";
        const ratios = rows
            .map((row) => this._finiteOrNull(picker(row)))
            .filter((value) => value !== null);
        if (ratios.length === 0) return "insufficient_data";
        const mean = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
        if (mean >= this.cfg.high_reproducibility_ratio) return "high";
        if (mean >= this.cfg.medium_reproducibility_ratio) return "medium";
        return "low";
    }

    _pairwiseCountRatio(row) {
        const checks = [
            this._withinDelta(row?.evidence?.h1_count_delta, 0, 2),
            this._withinDelta(row?.evidence?.m1_count_delta, 0, 2),
            this._withinDelta(row?.evidence?.anomaly_count_delta, 0, 1),
            this._withinDelta(row?.evidence?.state_count_delta, 0, 2),
            this._withinDelta(row?.evidence?.basin_count_delta, 0, 1),
            this._withinDelta(row?.evidence?.segment_count_delta, 0, 0),
        ];
        return this._safeRatio(checks.filter(Boolean).length, checks.length);
    }

    _pairwiseSupportRatio(row) {
        const checks = [
            this._withinDelta(row?.evidence?.h1_band_profile_distance, 0, 0.2),
            this._withinDelta(row?.evidence?.m1_band_profile_distance, 0, 0.2),
            this._withinDelta(row?.evidence?.basin_band_profile_distance, 0, 0.2),
            this._withinDelta(row?.evidence?.dominant_frequency_delta, 0, 1.0),
            this._withinDelta(row?.evidence?.state_duration_delta, 0, 0.5),
        ];
        return this._safeRatio(checks.filter(Boolean).length, checks.length);
    }

    _pairwiseTransitionRatio(row) {
        const checks = [
            this._withinDelta(row?.evidence?.total_transitions_delta, 0, 2),
            this._withinDelta(row?.evidence?.total_re_entries_delta, 0, 1),
            this._withinDelta(row?.evidence?.transition_density_delta, 0, 0.2),
            this._withinDelta(row?.evidence?.recurrence_delta, 0, 1),
        ];
        return this._safeRatio(checks.filter(Boolean).length, checks.length);
    }

    _pairwiseBasinRatio(row) {
        const checks = [
            this._withinDelta(row?.evidence?.basin_count_delta, 0, 1),
            this._withinDelta(row?.evidence?.basin_radius_delta, 0, 0.25),
            this._withinDelta(row?.evidence?.basin_member_count_delta, 0, 1),
        ];
        return this._safeRatio(checks.filter(Boolean).length, checks.length);
    }

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
