// runtime/AttentionMemoryReport.js

/**
 * AttentionMemoryReport
 *
 * Layer:
 *   Read-side runtime interpretation overlay.
 *   Not a pipeline operator. Not an authority-bearing artifact.
 *
 * Purpose:
 *   Produce a deterministic, plain-data overlay describing support-persistence
 *   and reuse-pressure behavior using:
 *     - DoorOneOrchestrator result
 *     - TrajectoryInterpretationReport
 *
 * Boundary contract:
 *   - derived / observational overlay only
 *   - not canon
 *   - not prediction
 *   - not ontology
 *   - not semantic intent
 *   - not trusted commitment
 *   - does not mutate input result
 *   - does not recompute authoritative artifacts
 *   - does not claim agency or commitment as fact
 *
 * Output:
 *   Plain-data report with explicit evidence fields under each overlay label.
 *   This overlay remains below runtime memory substance and below identity closure.
 *
 * Dependencies:
 *   - runtime/TrajectoryInterpretationReport.js
 */

import { TrajectoryInterpretationReport } from "./TrajectoryInterpretationReport.js";

export class AttentionMemoryReport {
    /**
     * @param {Object} [opts]
     * @param {number} [opts.high_concentration_share=0.60]
     * @param {number} [opts.medium_concentration_share=0.40]
     * @param {number} [opts.high_persistence_dwell=3]
     * @param {number} [opts.medium_persistence_dwell=2]
     * @param {number} [opts.high_volatility_transition_density=0.50]
     * @param {number} [opts.medium_volatility_transition_density=0.20]
     * @param {number} [opts.high_memory_reentry_ratio=1.0]
     * @param {number} [opts.medium_memory_reentry_ratio=0.50]
     */
    constructor(opts = {}) {
        this.cfg = {
            high_concentration_share: opts.high_concentration_share ?? 0.60,
            medium_concentration_share: opts.medium_concentration_share ?? 0.40,
            high_persistence_dwell: opts.high_persistence_dwell ?? 3,
            medium_persistence_dwell: opts.medium_persistence_dwell ?? 2,
            high_volatility_transition_density: opts.high_volatility_transition_density ?? 0.50,
            medium_volatility_transition_density: opts.medium_volatility_transition_density ?? 0.20,
            high_memory_reentry_ratio: opts.high_memory_reentry_ratio ?? 1.0,
            medium_memory_reentry_ratio: opts.medium_memory_reentry_ratio ?? 0.50,
        };

        this._base = new TrajectoryInterpretationReport();
    }

    /**
     * Interpret a DoorOneOrchestrator result into attention/memory overlay form.
     *
     * If baseReport is omitted, it is derived internally from
     * TrajectoryInterpretationReport.
     *
     * @param {Object} result
     * @param {Object|null} [baseReport=null]
     * @returns {Object}
     */
    interpret(result, baseReport = null) {
        if (!result?.ok) {
            return {
                ok: false,
                error: "INVALID_INPUT",
                reasons: ["AttentionMemoryReport requires a successful DoorOneOrchestrator result"],
            };
        }

        const base = baseReport ?? this._base.interpret(result);
        if (!base || base.ok === false) {
            return {
                ok: false,
                error: "INVALID_BASE_REPORT",
                reasons: ["AttentionMemoryReport requires a valid TrajectoryInterpretationReport"],
            };
        }

        const attentionCharacter =
            this._interpretAttentionCharacter(base);

        const memoryCharacter =
            this._interpretMemoryCharacter(base);

        const supportPersistence =
            this._interpretSupportPersistence({
                attentionCharacter,
                memoryCharacter,
                base,
            });

        const reusePressure =
            this._interpretReusePressure({
                attentionCharacter,
                memoryCharacter,
                base,
            });

        const memoryCandidatePosture =
            this._interpretMemoryCandidatePosture({
                supportPersistence,
                reusePressure,
                memoryCharacter,
                base,
            });

        const coordinationHints =
            this._interpretCoordinationHints({
                supportPersistence,
                reusePressure,
                memoryCandidatePosture,
            });

        const semanticOverlay =
            this._buildSemanticOverlay({
                supportPersistence,
                reusePressure,
                memoryCandidatePosture,
                attentionCharacter,
                memoryCharacter,
                coordinationHints,
            });

        const overlayFlags =
            this._deriveOverlayFlags({
                supportPersistence,
                reusePressure,
                memoryCandidatePosture,
                attentionCharacter,
                memoryCharacter,
                coordinationHints,
            });

        const notes =
            this._buildNotes({
                supportPersistence,
                reusePressure,
                memoryCandidatePosture,
                attentionCharacter,
                memoryCharacter,
                coordinationHints,
            });

        return {
            report_type: "runtime:attention_memory_report",
            report_kind: semanticOverlay.report_kind,
            generated_from:
                "Door One trajectory interpretation, dwell, recurrence, transition, and segment-boundary observations only; derived support-persistence and reuse-pressure overlay, not runtime memory substance, not identity closure, not canon, not readiness, not ontology",
            scope: this._copyScope(base.scope),
            query_class: semanticOverlay.query_class,
            claim_ceiling: semanticOverlay.claim_ceiling,
            primary_posture: semanticOverlay.primary_posture,
            primary_descriptors: semanticOverlay.primary_descriptors,
            secondary_descriptors: semanticOverlay.secondary_descriptors,
            ...(semanticOverlay.caution_posture ? { caution_posture: semanticOverlay.caution_posture } : {}),
            evidence_refs: semanticOverlay.evidence_refs,
            explicit_non_claims: semanticOverlay.explicit_non_claims,

            support_persistence: supportPersistence,
            reuse_pressure: reusePressure,
            memory_candidate_posture: memoryCandidatePosture,

            // Transitional compatibility surfaces for downstream seams that still
            // consume these names. They remain derived heuristics, not runtime
            // memory substance and not identity closure.
            attention_character: attentionCharacter,
            memory_character: memoryCharacter,
            coordination_hints: coordinationHints,

            overlay_flags: overlayFlags,
            notes,
        };
    }

    _buildSemanticOverlay({
        supportPersistence,
        reusePressure,
        memoryCandidatePosture,
        attentionCharacter,
        memoryCharacter,
        coordinationHints,
    }) {
        return {
            report_kind: "attention_memory_semantic_overlay",
            query_class: "Q3_support_lineage",
            claim_ceiling: "support_only",
            primary_posture: this._derivePrimaryPosture({
                supportPersistence,
                reusePressure,
                memoryCandidatePosture,
            }),
            primary_descriptors: [
                `support_persistence:${supportPersistence?.posture ?? "support_only"}`,
                `reuse_pressure:${reusePressure?.posture ?? "low"}`,
                `memory_candidate:${memoryCandidatePosture?.posture ?? "no_memory_class_claim"}`,
            ].slice(0, 3),
            secondary_descriptors: [
                `attention_volatility:${attentionCharacter?.volatility ?? "low"}`,
                `continuity:${memoryCharacter?.evidence?.continuity ?? "mixed"}`,
            ].slice(0, 2),
            caution_posture: this._buildCautionPosture({
                supportPersistence,
                reusePressure,
                memoryCandidatePosture,
            }),
            evidence_refs: [
                "trajectory.scope",
                "trajectory.neighborhood_character.evidence",
                "trajectory.segment_character.evidence",
                "trajectory.dynamics_flags",
            ],
            explicit_non_claims: [
                "not_truth_claim",
                "not_canon",
                "not_runtime_substance",
                "not_retention_substance",
                "not_runtime_memory_substance",
                "not_identity_claim",
                "not_readiness_posture",
            ],
        };
    }

    _derivePrimaryPosture({ supportPersistence, reusePressure, memoryCandidatePosture }) {
        if (supportPersistence?.posture === "support_only") return "support_only";
        if (memoryCandidatePosture?.posture === "bounded_M2_candidate") {
            return "persistent_support_with_bounded_memory_candidate";
        }
        if (reusePressure?.posture === "elevated") return "persistent_support_under_reuse_pressure";
        return "persistent_support";
    }

    _buildCautionPosture({ supportPersistence, reusePressure, memoryCandidatePosture }) {
        if (supportPersistence?.posture === "support_only") return "support_only_non_closure";
        if (memoryCandidatePosture?.posture === "no_memory_class_claim") return "memory_not_justified";
        if (reusePressure?.posture === "elevated") return "reuse_fragility";
        return null;
    }

    // -------------------------------------------------------------------------
    // Attention character
    // -------------------------------------------------------------------------

    _interpretAttentionCharacter(base) {
        const n = base?.neighborhood_character ?? {};
        const t = base?.trajectory_character ?? {};
        const s = base?.segment_character ?? {};

        const dominantDwellShare = this._finiteOrZero(n?.evidence?.dominant_dwell_share);
        const currentDwellCount = this._finiteOrZero(n?.evidence?.current_dwell_count);
        const currentDwellDurationSec = this._finiteOrZero(n?.evidence?.current_dwell_duration_sec);
        const transitionDensityValue = this._finiteOrZero(n?.evidence?.transition_density_value);

        const occupancy = n?.occupancy ?? "sparse";
        const motion = t?.motion ?? "diffuse";
        const boundaryDensity = s?.boundary_density ?? "low";

        const concentration =
            this._labelAttentionConcentration({ dominantDwellShare, occupancy });

        const persistence =
            this._labelAttentionPersistence({ currentDwellCount, currentDwellDurationSec, occupancy });

        const volatility =
            this._labelAttentionVolatility({ transitionDensityValue, motion, boundaryDensity });

        return {
            concentration,
            persistence,
            volatility,
            evidence: {
                dominant_dwell_share: dominantDwellShare,
                current_dwell_count: currentDwellCount,
                current_dwell_duration_sec: currentDwellDurationSec,
                transition_density_value: transitionDensityValue,
                boundary_density: boundaryDensity,
                occupancy,
                motion,
            },
        };
    }

    _labelAttentionConcentration({ dominantDwellShare, occupancy }) {
        if (occupancy === "sparse") return "low";
        if (dominantDwellShare >= this.cfg.high_concentration_share) return "high";
        if (dominantDwellShare >= this.cfg.medium_concentration_share) return "medium";
        return "low";
    }

    _labelAttentionPersistence({ currentDwellCount, currentDwellDurationSec, occupancy }) {
        if (occupancy === "sparse") return "low";
        if (currentDwellCount >= this.cfg.high_persistence_dwell || currentDwellDurationSec >= 3) return "high";
        if (currentDwellCount >= this.cfg.medium_persistence_dwell || currentDwellDurationSec >= 1.5) return "medium";
        return "low";
    }

    _labelAttentionVolatility({ transitionDensityValue, motion, boundaryDensity }) {
        if (transitionDensityValue >= this.cfg.high_volatility_transition_density) return "high";
        if (boundaryDensity === "high" || motion === "transitional") return "high";
        if (transitionDensityValue >= this.cfg.medium_volatility_transition_density) return "medium";
        if (motion === "drifting" || boundaryDensity === "medium") return "medium";
        return "low";
    }

    // -------------------------------------------------------------------------
    // Memory character (compatibility heuristic only)
    // -------------------------------------------------------------------------

    _interpretMemoryCharacter(base) {
        const n = base?.neighborhood_character ?? {};
        const t = base?.trajectory_character ?? {};
        const s = base?.segment_character ?? {};

        const totalReEntries = this._finiteOrZero(n?.evidence?.total_re_entries);
        const totalNeighborhoods = this._finiteOrZero(n?.evidence?.total_neighborhoods_observed);
        const dominantDwellShare = this._finiteOrZero(n?.evidence?.dominant_dwell_share);

        const recurrenceStrengthLabel = n?.recurrence_strength ?? "low";
        const convergence = t?.convergence ?? "insufficient_data";
        const continuity = s?.continuity ?? "mixed";

        const recurrenceStrength =
            this._labelMemoryRecurrenceStrength({
                recurrenceStrengthLabel,
                totalReEntries,
                totalNeighborhoods,
            });

        const persistence =
            this._labelMemoryPersistence({
                dominantDwellShare,
                recurrenceStrength,
                continuity,
            });

        const stability =
            this._labelMemoryStability({
                convergence,
                continuity,
                recurrenceStrength,
            });

        return {
            recurrence_strength: recurrenceStrength,
            persistence,
            stability,
            evidence: {
                total_re_entries: totalReEntries,
                total_neighborhoods_observed: totalNeighborhoods,
                dominant_dwell_share: dominantDwellShare,
                base_recurrence_strength: recurrenceStrengthLabel,
                convergence,
                continuity,
            },
        };
    }

    _labelMemoryRecurrenceStrength({ recurrenceStrengthLabel, totalReEntries, totalNeighborhoods }) {
        if (recurrenceStrengthLabel === "high") return "high";
        if (recurrenceStrengthLabel === "medium") return "medium";

        const ratio = this._safeRatio(totalReEntries, totalNeighborhoods);
        if (ratio >= this.cfg.high_memory_reentry_ratio) return "high";
        if (ratio >= this.cfg.medium_memory_reentry_ratio) return "medium";
        return "low";
    }

    _labelMemoryPersistence({ dominantDwellShare, recurrenceStrength, continuity }) {
        if (continuity === "fragmented") return "low";
        if (recurrenceStrength === "high" && dominantDwellShare >= this.cfg.medium_concentration_share) return "high";
        if (recurrenceStrength === "medium" || dominantDwellShare >= this.cfg.medium_concentration_share) return "medium";
        return "low";
    }

    _labelMemoryStability({ convergence, continuity, recurrenceStrength }) {
        if (continuity === "fragmented") return "low";
        if ((convergence === "strong" || convergence === "moderate") && recurrenceStrength === "high") return "high";
        if (convergence === "weak" && recurrenceStrength === "low") return "low";
        if (convergence === "insufficient_data") return "low";
        return "medium";
    }

    // -------------------------------------------------------------------------
    // Coordination hints (compatibility heuristic only)
    // -------------------------------------------------------------------------

    _interpretCoordinationHints({ supportPersistence, reusePressure, memoryCandidatePosture }) {
        const supportPosture = supportPersistence?.posture ?? "support_only";
        const reusePosture = reusePressure?.posture ?? "low";
        const memoryCandidate = memoryCandidatePosture?.posture ?? "no_memory_class_claim";

        let preCommitment = "absent";
        if (
            supportPosture === "sustained" &&
            reusePosture !== "elevated" &&
            memoryCandidate !== "no_memory_class_claim"
        ) {
            preCommitment = "emergent";
        } else if (
            supportPosture !== "support_only" &&
            reusePosture !== "elevated"
        ) {
            preCommitment = "weak";
        }

        return {
            pre_commitment: preCommitment,
            evidence: {
                support_persistence: supportPosture,
                reuse_pressure: reusePosture,
                memory_candidate_posture: memoryCandidate,
            },
        };
    }

    // -------------------------------------------------------------------------
    // Support persistence / reuse pressure posture
    // -------------------------------------------------------------------------

    _interpretSupportPersistence({ attentionCharacter, memoryCharacter, base }) {
        const concentration = attentionCharacter?.concentration ?? "low";
        const persistence = attentionCharacter?.persistence ?? "low";
        const continuity = base?.segment_character?.continuity ?? "mixed";
        const recurrence = memoryCharacter?.recurrence_strength ?? "low";

        let posture = "support_only";
        if (
            (concentration === "high" || concentration === "medium") &&
            (persistence === "high" || persistence === "medium") &&
            continuity !== "fragmented"
        ) {
            posture = recurrence === "high" ? "sustained" : "developing";
        }

        return {
            posture,
            evidence: {
                attention_concentration: concentration,
                attention_persistence: persistence,
                recurrence_strength: recurrence,
                continuity,
            },
        };
    }

    _interpretReusePressure({ attentionCharacter, memoryCharacter, base }) {
        const volatility = attentionCharacter?.volatility ?? "low";
        const stability = memoryCharacter?.stability ?? "low";
        const continuity = base?.segment_character?.continuity ?? "mixed";

        let posture = "low";
        if (volatility === "high" || continuity === "fragmented" || continuity === "novelty-driven") {
            posture = "elevated";
        } else if (
            volatility === "medium" ||
            stability === "medium" ||
            continuity === "mixed"
        ) {
            posture = "moderate";
        }

        return {
            posture,
            evidence: {
                attention_volatility: volatility,
                support_stability: stability,
                continuity,
            },
        };
    }

    _interpretMemoryCandidatePosture({ supportPersistence, reusePressure, memoryCharacter, base }) {
        const recurrence = memoryCharacter?.recurrence_strength ?? "low";
        const persistence = memoryCharacter?.persistence ?? "low";
        const stability = memoryCharacter?.stability ?? "low";
        const continuity = base?.segment_character?.continuity ?? "mixed";

        let posture = "no_memory_class_claim";
        if (
            supportPersistence?.posture === "sustained" &&
            reusePressure?.posture !== "elevated" &&
            recurrence === "high" &&
            persistence === "high" &&
            stability === "high" &&
            continuity === "smooth"
        ) {
            posture = "bounded_M2_candidate";
        } else if (
            supportPersistence?.posture !== "support_only" &&
            (recurrence === "high" || recurrence === "medium") &&
            (persistence === "high" || persistence === "medium")
        ) {
            posture = "bounded_M1_candidate";
        }

        return {
            posture,
            evidence: {
                support_persistence: supportPersistence?.posture ?? "support_only",
                reuse_pressure: reusePressure?.posture ?? "low",
                recurrence_strength: recurrence,
                persistence,
                stability,
                continuity,
            },
        };
    }

    // -------------------------------------------------------------------------
    // Flags / notes
    // -------------------------------------------------------------------------

    _deriveOverlayFlags({
        supportPersistence,
        reusePressure,
        memoryCandidatePosture,
        attentionCharacter,
        memoryCharacter,
        coordinationHints,
    }) {
        const flags = [];

        if (attentionCharacter?.concentration === "high") flags.push("attention_concentrated");
        if (attentionCharacter?.persistence === "high") flags.push("attention_persistent");
        if (attentionCharacter?.volatility === "high") flags.push("attention_volatile");

        if (supportPersistence?.posture === "sustained") flags.push("support_persistence_sustained");
        if (supportPersistence?.posture === "developing") flags.push("support_persistence_developing");
        if (reusePressure?.posture === "elevated") flags.push("reuse_pressure_elevated");
        if (memoryCandidatePosture?.posture === "bounded_M1_candidate") flags.push("memory_candidate_m1");
        if (memoryCandidatePosture?.posture === "bounded_M2_candidate") flags.push("memory_candidate_m2");

        if (memoryCharacter?.recurrence_strength === "high") flags.push("memory_recurrent");
        if (memoryCharacter?.stability === "high") flags.push("memory_stable");

        return flags;
    }

    _buildNotes({
        supportPersistence,
        reusePressure,
        memoryCandidatePosture,
        attentionCharacter,
        memoryCharacter,
        coordinationHints,
    }) {
        const notes = [
            "Support-persistence and reuse-pressure labels are derived overlays over structural observations only.",
            "No runtime memory substance, identity closure, or trusted commitment is asserted.",
            "Any memory-class language remains bounded candidate posture only and does not by itself assert lawful memory closure.",
            "Legacy attention/memory/coordination field names remain compatibility heuristics for downstream seams and are not runtime substance.",
        ];

        if (attentionCharacter?.volatility === "high") {
            notes.push("Support persistence is under elevated reuse pressure from current transition/boundary conditions.");
        }

        if (supportPersistence?.posture === "support_only") {
            notes.push("Observed structure supports support-only posture and does not justify stronger memory-class closure.");
        }

        if (memoryCandidatePosture?.posture === "no_memory_class_claim") {
            notes.push("Current evidence does not justify even a bounded memory-class candidate above support-only posture.");
        }

        if (reusePressure?.posture === "elevated" || memoryCharacter?.stability === "low") {
            notes.push("Reuse pressure remains elevated under current recurrence, convergence, or continuity evidence.");
        }

        return notes;
    }

    // -------------------------------------------------------------------------
    // Small utilities
    // -------------------------------------------------------------------------

    _copyScope(scope) {
        return scope
            ? {
                stream_id: scope.stream_id ?? null,
                segment_ids: Array.isArray(scope.segment_ids) ? [...scope.segment_ids] : [],
                t_span: scope.t_span
                    ? {
                        t_start: scope.t_span.t_start ?? null,
                        t_end: scope.t_span.t_end ?? null,
                        duration_sec: scope.t_span.duration_sec ?? null,
                    }
                    : null,
            }
            : { stream_id: null, segment_ids: [], t_span: null };
    }

    _finiteOrZero(v) {
        return Number.isFinite(v) ? v : 0;
    }

    _safeRatio(a, b) {
        if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
        return a / b;
    }
}
