// runtime/reconstruction/ReplaySupportPosture.js
//
// Compact read-side posture helpers for replay / reconstruction outputs.
//
// Purpose:
//   - derive small explicit classification records from replay outputs
//   - keep reconstruction posture logic local to the execution surface
//   - avoid depending on removed HUD-era helpers

function getTierLabel(replay = {}) {
    const retainedTier = replay?.retained_tier_used ?? {};
    return retainedTier?.tier_label ?? (
        Number.isFinite(retainedTier?.tier_used)
            ? `Tier ${retainedTier.tier_used}`
            : "tier_unspecified"
    );
}

function getThresholdOutcome(replay = {}) {
    return (
        replay?.threshold_posture?.threshold_outcome ??
        replay?.replay_fidelity_record_v0?.threshold_outcome ??
        ""
    );
}

function getDowngradePosture(replay = {}) {
    return (
        replay?.threshold_posture?.downgrade_output ??
        replay?.replay_fidelity_record_v0?.downgrade_posture ??
        ""
    );
}

function getMechanizationStatus(replay = {}) {
    return replay?.replay_fidelity_record_v0?.mechanization_status ?? "unknown";
}

export function deriveReplayThresholdPosture(replay = {}) {
    const reconstructionStatus = replay?.reconstruction_status ?? replay?.request_status ?? "unknown";
    const downgradePosture = getDowngradePosture(replay);
    const thresholdOutcome = getThresholdOutcome(replay);
    const tierLabel = getTierLabel(replay);

    if (reconstructionStatus === "failed" || replay?.request_status === "failed") {
        return {
            classCode: "failed",
            threshold_outcome: thresholdOutcome || "reconstruction_not_justified",
            downgrade_posture: downgradePosture || "reconstruction_not_justified",
            retained_tier: tierLabel,
            mechanization_status: getMechanizationStatus(replay),
            note: "replay reconstruction failed before a lawful support basis could be established",
        };
    }

    if (downgradePosture === "support_degraded") {
        return {
            classCode: "degraded",
            threshold_outcome: thresholdOutcome || "support_unresolved",
            downgrade_posture: downgradePosture,
            retained_tier: tierLabel,
            mechanization_status: getMechanizationStatus(replay),
            note: "support is degraded relative to the declared replay question",
        };
    }

    if (downgradePosture === "retained_tier_insufficient") {
        return {
            classCode: "insufficient",
            threshold_outcome: thresholdOutcome || "support_unresolved",
            downgrade_posture: downgradePosture,
            retained_tier: tierLabel,
            mechanization_status: getMechanizationStatus(replay),
            note: `${tierLabel} does not justify lawful replay legitimacy`,
        };
    }

    if (downgradePosture === "reconstruction_not_justified") {
        return {
            classCode: "not_justified",
            threshold_outcome: thresholdOutcome || "reconstruction_not_justified",
            downgrade_posture: downgradePosture,
            retained_tier: tierLabel,
            mechanization_status: getMechanizationStatus(replay),
            note: "replay support remained too weak to justify bounded reconstruction",
        };
    }

    if (thresholdOutcome === "support_unresolved" || reconstructionStatus === "prepared") {
        return {
            classCode: "unresolved",
            threshold_outcome: thresholdOutcome || "support_unresolved",
            downgrade_posture: downgradePosture || "",
            retained_tier: tierLabel,
            mechanization_status: getMechanizationStatus(replay),
            note: "the replay support question remains open at this seam",
        };
    }

    return {
        classCode: "supported",
        threshold_outcome: thresholdOutcome || "bounded_supported",
        downgrade_posture: downgradePosture || "",
        retained_tier: tierLabel,
        mechanization_status: getMechanizationStatus(replay),
        note: "bounded replay support is explicit and sufficient for this seam",
    };
}

export function deriveReplayFidelityPosture(replay = {}) {
    const threshold = deriveReplayThresholdPosture(replay);
    const mechanizationStatus = getMechanizationStatus(replay);

    if (threshold.classCode === "failed") {
        return {
            classCode: "failed_support_trace",
            retained_tier: threshold.retained_tier,
            mechanization_status: mechanizationStatus,
            note: "support-trace fidelity failed before a lawful replay result could be emitted",
        };
    }

    if (threshold.classCode === "degraded") {
        return {
            classCode: "degraded_support_trace",
            retained_tier: threshold.retained_tier,
            mechanization_status: mechanizationStatus,
            note: "degraded remains distinct from insufficient and unresolved support-trace fidelity",
        };
    }

    if (threshold.classCode === "insufficient") {
        return {
            classCode: "insufficient_support_trace",
            retained_tier: threshold.retained_tier,
            mechanization_status: mechanizationStatus,
            note: "support-trace fidelity is not enough to justify lawful replay / reconstruction quality",
        };
    }

    if (threshold.classCode === "not_justified") {
        return {
            classCode: "not_justified_support_trace",
            retained_tier: threshold.retained_tier,
            mechanization_status: mechanizationStatus,
            note: "support-trace posture stayed below a justified bounded reconstruction basis",
        };
    }

    if (threshold.classCode === "unresolved") {
        return {
            classCode: "unresolved_support_trace",
            retained_tier: threshold.retained_tier,
            mechanization_status: mechanizationStatus,
            note: "unresolved is distinct from degraded and insufficient support-trace fidelity",
        };
    }

    return {
        classCode: "bounded_support_trace",
        retained_tier: threshold.retained_tier,
        mechanization_status: mechanizationStatus,
        note: "support-trace fidelity remains bounded and explicit under the declared replay seam",
    };
}

export const deriveOperatorThresholdPosture = deriveReplayThresholdPosture;
export const deriveOperatorFidelityPosture = deriveReplayFidelityPosture;
