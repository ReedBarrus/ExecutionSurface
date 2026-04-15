// runtime/TrajectoryInterpretationReport.js

/**
 * TrajectoryInterpretationReport
 *
 * Layer:
 *   Read-side runtime interpretation helper.
 *   Not a pipeline operator. Not an authority-bearing artifact.
 *
 * Purpose:
 *   Produce a deterministic, plain-data interpretation of Door One trajectory
 *   behavior using already-lawful observational surfaces:
 *     - result.summaries.trajectory
 *     - result.substrate.transition_report
 *     - result.substrate.segment_transitions
 *     - result.summaries.segtracker
 *     - result.substrate
 *
 * Boundary contract:
 *   - derived / observational only
 *   - not canon
 *   - not prediction
 *   - not ontology
 *   - does not mutate input result
 *   - does not recompute authoritative artifacts
 *   - does not claim true dynamical basin membership
 *
 * Output:
 *   Plain-data report with explicit evidence fields under every interpretation.
 */

export class TrajectoryInterpretationReport {
    /**
     * @param {Object} [opts]
     * @param {number} [opts.strong_convergence_slope=0.01]
     * @param {number} [opts.medium_transition_density=0.20]
     * @param {number} [opts.high_transition_density=0.50]
     * @param {number} [opts.sticky_dwell_share=0.60]
     * @param {number} [opts.fragmented_segment_ratio=0.15]
     */
    constructor(opts = {}) {
        this.cfg = {
            strong_convergence_slope: opts.strong_convergence_slope ?? 0.01,
            medium_transition_density: opts.medium_transition_density ?? 0.20,
            high_transition_density: opts.high_transition_density ?? 0.50,
            sticky_dwell_share: opts.sticky_dwell_share ?? 0.60,
            fragmented_segment_ratio: opts.fragmented_segment_ratio ?? 0.15,
        };
    }

    /**
     * Interpret a DoorOneOrchestrator result.
     *
     * @param {Object} result
     * @returns {Object}
     */
    interpret(result) {
        if (!result?.ok) {
            return {
                ok: false,
                error: "INVALID_INPUT",
                reasons: ["TrajectoryInterpretationReport requires a successful DoorOneOrchestrator result"],
            };
        }

        const trajectorySummary = result?.summaries?.trajectory ?? {};
        const transitionReport = result?.substrate?.transition_report ?? {};
        const segmentTransitions = result?.substrate?.segment_transitions ?? [];
        const segtrackerSummary = result?.summaries?.segtracker ?? {};
        const substrate = result?.substrate ?? {};
        const artifacts = result?.artifacts ?? {};

        const scope = this._buildScope({ substrate, artifacts });

        const trajectoryCharacter =
            this._interpretTrajectoryCharacter(trajectorySummary, substrate, segmentTransitions);

        const neighborhoodCharacter =
            this._interpretNeighborhoodCharacter(transitionReport);

        const segmentCharacter =
            this._interpretSegmentCharacter(segmentTransitions, segtrackerSummary, trajectorySummary, substrate);

        const dynamicsFlags =
            this._deriveFlags({ trajectoryCharacter, neighborhoodCharacter, segmentCharacter });

        const notes =
            this._buildNotes({ trajectoryCharacter, neighborhoodCharacter, segmentCharacter });

        const semanticOverlay =
            this._buildSemanticOverlay({
                trajectoryCharacter,
                neighborhoodCharacter,
                segmentCharacter,
            });

        return {
            report_type: "runtime:trajectory_interpretation_report",
            report_kind: semanticOverlay.report_kind,
            generated_from:
                "Door One trajectory, dwell, recurrence, segment-boundary, and structural neighborhood observations only; not canon, not prediction, not ontology",
            scope,
            query_class: semanticOverlay.query_class,
            claim_ceiling: semanticOverlay.claim_ceiling,
            primary_posture: semanticOverlay.primary_posture,
            primary_descriptors: semanticOverlay.primary_descriptors,
            secondary_descriptors: semanticOverlay.secondary_descriptors,
            ...(semanticOverlay.caution_posture ? { caution_posture: semanticOverlay.caution_posture } : {}),
            evidence_refs: semanticOverlay.evidence_refs,
            explicit_non_claims: semanticOverlay.explicit_non_claims,

            trajectory_character: trajectoryCharacter,
            neighborhood_character: neighborhoodCharacter,
            segment_character: segmentCharacter,

            dynamics_flags: dynamicsFlags,
            notes,
        };
    }

    _buildSemanticOverlay({ trajectoryCharacter, neighborhoodCharacter, segmentCharacter }) {
        return {
            report_kind: "trajectory_semantic_overlay",
            query_class: "Q2_continuity",
            claim_ceiling: "bounded continuity interpretation only",
            primary_posture: this._derivePrimaryPosture({
                trajectoryCharacter,
                neighborhoodCharacter,
                segmentCharacter,
            }),
            primary_descriptors: this._buildPrimaryDescriptors({
                trajectoryCharacter,
                segmentCharacter,
            }),
            secondary_descriptors: this._buildSecondaryDescriptors({
                neighborhoodCharacter,
                segmentCharacter,
            }),
            caution_posture: this._buildCautionPosture({
                trajectoryCharacter,
                neighborhoodCharacter,
                segmentCharacter,
            }),
            evidence_refs: [
                "summaries.trajectory",
                "substrate.transition_report",
                "substrate.segment_transitions",
                "summaries.segtracker",
            ],
            explicit_non_claims: [
                "not canon",
                "not prediction",
                "not ontology",
                "not retention substance",
                "not a memory claim",
                "not an identity verdict",
            ],
        };
    }

    _derivePrimaryPosture({ trajectoryCharacter, neighborhoodCharacter, segmentCharacter }) {
        const convergence = trajectoryCharacter?.convergence ?? "insufficient_data";
        const motion = trajectoryCharacter?.motion ?? "diffuse";
        const continuity = segmentCharacter?.continuity ?? "mixed";
        const transitionDensity = neighborhoodCharacter?.transition_density ?? "low";

        if (continuity === "fragmented") return "degraded";
        if (convergence === "insufficient_data") return "unresolved";
        if (continuity === "mixed" || motion === "diffuse") return "unresolved";
        if (continuity === "novelty-driven" || motion === "drifting" || transitionDensity === "high") {
            return "degraded";
        }
        if (continuity === "smooth" && (convergence === "strong" || convergence === "moderate")) {
            return "bounded_conserved";
        }
        return "narrowed_conserved";
    }

    _buildPrimaryDescriptors({ trajectoryCharacter, segmentCharacter }) {
        return [
            `convergence:${trajectoryCharacter?.convergence ?? "insufficient_data"}`,
            `motion:${trajectoryCharacter?.motion ?? "diffuse"}`,
            `continuity:${segmentCharacter?.continuity ?? "mixed"}`,
        ].slice(0, 3);
    }

    _buildSecondaryDescriptors({ neighborhoodCharacter, segmentCharacter }) {
        return [
            `recurrence_signature_strength:${neighborhoodCharacter?.recurrence_strength ?? "low"}`,
            `boundary_stress:${segmentCharacter?.boundary_density ?? "low"}`,
        ].slice(0, 2);
    }

    _buildCautionPosture({ trajectoryCharacter, neighborhoodCharacter, segmentCharacter }) {
        const convergence = trajectoryCharacter?.convergence ?? "insufficient_data";
        const occupancy = neighborhoodCharacter?.occupancy ?? "sparse";
        const transitionDensity = neighborhoodCharacter?.transition_density ?? "low";
        const continuity = segmentCharacter?.continuity ?? "mixed";
        const boundaryDensity = segmentCharacter?.boundary_density ?? "low";

        if (convergence === "insufficient_data") return "limited_structural_evidence";
        if (continuity === "mixed" || occupancy === "sparse") return "interpretive_non_closure";
        if (continuity === "fragmented" || boundaryDensity === "high" || transitionDensity === "high") {
            return "boundary_stress";
        }
        return null;
    }

    // ---------------------------------------------------------------------------
    // Scope
    // ---------------------------------------------------------------------------

    _buildScope({ substrate, artifacts }) {
        return {
            stream_id: artifacts?.a1?.stream_id ?? null,
            segment_ids: Array.isArray(substrate?.segment_ids) ? [...substrate.segment_ids] : [],
            t_span: substrate?.t_span
                ? {
                    t_start: substrate.t_span.t_start ?? null,
                    t_end: substrate.t_span.t_end ?? null,
                    duration_sec: substrate.t_span.duration_sec ?? null,
                }
                : null,
        };
    }

    // ---------------------------------------------------------------------------
    // Trajectory character
    // ---------------------------------------------------------------------------

    _interpretTrajectoryCharacter(traj, substrate, segmentTransitions) {
        const sufficientData = !!traj?.sufficient_data;
        const isConverging = !!traj?.is_converging;
        const trendSlope = this._finiteOrNull(traj?.trend_slope);
        const meanL1Delta = this._finiteOrNull(traj?.mean_l1_delta);
        const framesUsed = this._finiteOrNull(traj?.frames_used);
        const frameCount = this._finiteOrNull(traj?.frame_count ?? substrate?.trajectory_frames);
        const segmentTransitionCount = Array.isArray(segmentTransitions) ? segmentTransitions.length : 0;

        const convergence =
            this._labelConvergence({ sufficientData, isConverging, trendSlope });

        const motion =
            this._labelMotion({
                sufficientData,
                isConverging,
                trendSlope,
                meanL1Delta,
                frameCount,
                segmentTransitionCount,
            });

        return {
            convergence,
            motion,
            evidence: {
                sufficient_data: sufficientData,
                is_converging: isConverging,
                trend_slope: trendSlope,
                mean_l1_delta: meanL1Delta,
                frames_used: framesUsed,
                frame_count: frameCount,
                segment_transition_count: segmentTransitionCount,
            },
        };
    }

    _labelConvergence({ sufficientData, isConverging, trendSlope }) {
        if (!sufficientData) return "insufficient_data";
        if (isConverging && typeof trendSlope === "number") {
            if (Math.abs(trendSlope) >= this.cfg.strong_convergence_slope) return "strong";
            return "moderate";
        }
        return "weak";
    }

    _labelMotion({ sufficientData, isConverging, trendSlope, meanL1Delta, frameCount, segmentTransitionCount }) {
        if (!sufficientData) return "diffuse";

        // Placeholder first-pass logic:
        // - transitional if segment boundaries are relatively common
        // - stable if converging and motion is small
        // - drifting if not converging and motion is non-trivial
        // - diffuse as a safe fallback
        const segRatio =
            this._safeRatio(segmentTransitionCount, frameCount);

        if (segRatio >= this.cfg.fragmented_segment_ratio) {
            return "transitional";
        }

        if (isConverging && typeof meanL1Delta === "number" && meanL1Delta < 0.25) {
            return "stable";
        }

        if (!isConverging && typeof meanL1Delta === "number" && meanL1Delta >= 0.25) {
            return "drifting";
        }

        return "diffuse";
    }

    // ---------------------------------------------------------------------------
    // Neighborhood character
    // ---------------------------------------------------------------------------

    _interpretNeighborhoodCharacter(report) {
        const totalNeighborhoods = this._finiteOrZero(report?.total_neighborhoods_observed);
        const totalTransitions = this._finiteOrZero(report?.total_transitions);
        const totalReEntries = this._finiteOrZero(report?.total_re_entries);
        const currentDwellCount = this._finiteOrZero(report?.current_dwell_count);
        const currentDwellDurationSec = this._finiteOrZero(report?.current_dwell_duration_sec);

        const dominantDwellShare = this._dominantDwellShare(report?.dwell ?? []);
        const transitionDensityValue = this._safeRatio(totalTransitions, report?.total_frames_considered ?? 0);

        const occupancy =
            this._labelOccupancy({
                totalNeighborhoods,
                totalTransitions,
                totalReEntries,
                dominantDwellShare,
            });

        const transitionDensity =
            this._labelTransitionDensity(transitionDensityValue);

        const recurrenceStrength =
            this._labelRecurrenceStrength({ totalNeighborhoods, totalReEntries });

        return {
            occupancy,
            transition_density: transitionDensity,
            recurrence_strength: recurrenceStrength,
            evidence: {
                total_neighborhoods_observed: totalNeighborhoods,
                total_transitions: totalTransitions,
                total_re_entries: totalReEntries,
                current_dwell_count: currentDwellCount,
                current_dwell_duration_sec: currentDwellDurationSec,
                dominant_dwell_share: dominantDwellShare,
                transition_density_value: transitionDensityValue,
            },
        };
    }

    _labelOccupancy({ totalNeighborhoods, totalTransitions, totalReEntries, dominantDwellShare }) {
        if (totalNeighborhoods === 0) return "sparse";
        if (dominantDwellShare >= this.cfg.sticky_dwell_share && totalTransitions <= 1) return "sticky";
        if (totalReEntries >= Math.max(1, totalNeighborhoods - 1)) return "recurrent";
        if (totalTransitions >= totalNeighborhoods) return "hopping";
        if (totalNeighborhoods >= 4 && dominantDwellShare < 0.40) return "diffuse";
        return "sparse";
    }

    _labelTransitionDensity(value) {
        if (!Number.isFinite(value)) return "low";
        if (value >= this.cfg.high_transition_density) return "high";
        if (value >= this.cfg.medium_transition_density) return "medium";
        return "low";
    }

    _labelRecurrenceStrength({ totalNeighborhoods, totalReEntries }) {
        if (totalNeighborhoods === 0) return "low";
        const ratio = this._safeRatio(totalReEntries, totalNeighborhoods);
        if (ratio >= 1.0) return "high";
        if (ratio >= 0.5) return "medium";
        return "low";
    }

    _dominantDwellShare(dwellRows) {
        if (!Array.isArray(dwellRows) || dwellRows.length === 0) return 0;

        const totals = dwellRows
            .map(r => this._finiteOrZero(r?.total_duration_sec))
            .filter(v => v > 0);

        if (totals.length === 0) return 0;

        const total = totals.reduce((a, b) => a + b, 0);
        const max = Math.max(...totals);

        return this._safeRatio(max, total);
    }

    // ---------------------------------------------------------------------------
    // Segment character
    // ---------------------------------------------------------------------------

    _interpretSegmentCharacter(segmentTransitions, segtrackerSummary, trajectorySummary, substrate) {
        const segmentTransitionCount = Array.isArray(segmentTransitions) ? segmentTransitions.length : 0;
        const segmentCount = this._finiteOrZero(
            substrate?.segment_count ?? segtrackerSummary?.segment_count ?? segtrackerSummary?.epoch_counter
        );
        const frameCount = this._finiteOrZero(
            trajectorySummary?.frame_count ?? substrate?.trajectory_frames
        );

        const meanDivergenceScore = this._mean(
            (segmentTransitions ?? []).map(t => this._finiteOrNull(t?.divergence_score)).filter(v => v !== null)
        );

        const eventTypeCounts = this._countEventTypes(segmentTransitions ?? []);
        const continuity =
            this._labelSegmentContinuity({
                segmentTransitionCount,
                segmentCount,
                frameCount,
                meanDivergenceScore,
                eventTypeCounts,
            });

        const boundaryDensity =
            this._labelBoundaryDensity(this._safeRatio(segmentTransitionCount, frameCount));

        return {
            continuity,
            boundary_density: boundaryDensity,
            evidence: {
                segment_count: segmentCount,
                segment_transition_count: segmentTransitionCount,
                frame_count: frameCount,
                mean_divergence_score: meanDivergenceScore,
                event_type_counts: eventTypeCounts,
            },
        };
    }

    _labelSegmentContinuity({ segmentTransitionCount, segmentCount, frameCount, meanDivergenceScore, eventTypeCounts }) {
        const ratio = this._safeRatio(segmentCount, frameCount);
        const noveltySignals =
            (eventTypeCounts.new_frequency ?? 0) +
            (eventTypeCounts.vanished_frequency ?? 0) +
            (eventTypeCounts.energy_shift ?? 0);

        if (segmentTransitionCount === 0) return "smooth";
        if (noveltySignals >= 2 && segmentTransitionCount >= 1) return "novelty-driven";
        if (ratio >= this.cfg.fragmented_segment_ratio) return "fragmented";
        if ((meanDivergenceScore ?? 0) < 0.2 && segmentTransitionCount <= 1) return "smooth";
        return "mixed";
    }

    _labelBoundaryDensity(value) {
        if (!Number.isFinite(value)) return "low";
        if (value >= this.cfg.high_transition_density) return "high";
        if (value >= this.cfg.medium_transition_density) return "medium";
        return "low";
    }

    _countEventTypes(segmentTransitions) {
        const counts = {};
        for (const t of segmentTransitions) {
            for (const e of t?.detected_event_types ?? []) {
                counts[e] = (counts[e] ?? 0) + 1;
            }
        }
        return counts;
    }

    // ---------------------------------------------------------------------------
    // Flags / notes
    // ---------------------------------------------------------------------------

    _deriveFlags({ trajectoryCharacter, neighborhoodCharacter, segmentCharacter }) {
        const flags = [];

        if (trajectoryCharacter?.convergence === "strong") flags.push("converging");
        if (neighborhoodCharacter?.occupancy === "sticky") flags.push("sticky_neighborhood");
        if (neighborhoodCharacter?.occupancy === "recurrent") flags.push("high_recurrence");
        if (neighborhoodCharacter?.transition_density === "high") flags.push("transition_dense");
        if (segmentCharacter?.continuity === "novelty-driven") flags.push("novelty_driven");
        if (segmentCharacter?.continuity === "fragmented") flags.push("fragmented");

        return flags;
    }

    _buildNotes({ trajectoryCharacter, neighborhoodCharacter, segmentCharacter }) {
        const notes = [
            "Interpretation is derived from structural observations only.",
            "Neighborhood recurrence does not prove true dynamical basin membership.",
            "No forward prediction is performed.",
        ];

        if (trajectoryCharacter?.convergence === "insufficient_data") {
            notes.push("Convergence evidence is limited by available trajectory data.");
        }

        if (neighborhoodCharacter?.occupancy === "sparse") {
            notes.push("Neighborhood interpretation is sparse and should be treated cautiously.");
        }

        if (segmentCharacter?.continuity === "mixed") {
            notes.push("Segment behavior does not cleanly resolve to a single continuity profile.");
        }

        return notes;
    }

    // ---------------------------------------------------------------------------
    // Small utilities
    // ---------------------------------------------------------------------------

    _finiteOrNull(v) {
        return Number.isFinite(v) ? v : null;
    }

    _finiteOrZero(v) {
        return Number.isFinite(v) ? v : 0;
    }

    _safeRatio(a, b) {
        if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
        return a / b;
    }

    _mean(vals) {
        if (!Array.isArray(vals) || vals.length === 0) return null;
        const s = vals.reduce((a, b) => a + b, 0);
        return s / vals.length;
    }
}
