// runtime/reconstruction/ProvenanceReconstructionPipeline.js
//
// Provenance Reconstruction Pipeline - support-trace class, Tier 0/Tier 1
//
// Constitutional posture:
//   - Replay is lens-bound support, not truth restoration.
//   - This pipeline produces support-trace reconstruction only.
//   - It does NOT re-run DoorOneOrchestrator or any Door One operator.
//   - It does NOT restore raw source signal.
//   - It does NOT infer missing evidence.
//   - It does NOT widen beyond replayRequest.retained_tier_used.
//   - It does NOT invent higher-tier replay support.
//   - It does NOT call any review or promotion layer.
//   - It does NOT mint C1.
//   - Failure is explicit and local - no fake results.
//
// Reconstruction class: support-trace reconstruction
//   (README.DeterministicInvarianceThreshold.md §9.1)
//   Reconstructs support lineage from retained evidence and declared lens/tier context.
//   Does not imply raw source restoration or full operator reversal.
//
// Fractal-local principle:
//   Reconstruction obeys the same local deterministic principle the original
//   runtime obeyed, within the declared lens and retained-tier boundary.
//   (README.DeterministicInvarianceThreshold.md §4)
//
// Retained tiers in v0:
//   - Tier 0 (live working state): positive path via live runtime support-trace artifacts
//   - Tier 1 (durable receipts): positive path via receipt-backed lineage support
//   - Tier 2-4: explicit downgrade / insufficiency posture only
//
// Seam rule: no hud/ imports. Declared lens / tier fields pass through
//   replayRequest.declared_lens and replayRequest.retained_tier_used.
//
// References:
//   README.DeterministicInvarianceThreshold.md
//   README.DeclaredVsMechanizedAudit.md
//   README.ReconstructionReplaySurface.md
//   README_ContinuousIngestRetentionLadder.md
//   README_DoorOneRuntimeBoundary.md

"use strict";

import {
    deriveReplayFidelityPosture,
    deriveReplayThresholdPosture,
} from "./ReplaySupportPosture.js";

const STEP = {
    REPLAY_REQUEST_RECEIVED: "replay_request_received",
    TARGET_RESOLVED: "target_resolved",
    LENS_DECLARED: "lens_declared",
    RETAINED_TIER_DECLARED: "retained_tier_declared",
    LINEAGE_BOUND: "lineage_bound",
    RUNTIME_SUPPORT_COLLECTED: "runtime_support_collected",
    RECEIPT_SUPPORT_COLLECTED: "receipt_support_collected",
    INTERPRETIVE_SUPPORT_COLLECTED: "interpretive_support_collected",
    SCALE_LATENCY_DECLARED: "scale_latency_declared",
    REQUEST_CONTEXT_BOUND: "request_context_bound",
    REQUEST_CONTEXT_ABSENT: "request_context_absent",
    RECONSTRUCTION_DOWNGRADED: "reconstruction_downgraded",
    RECONSTRUCTION_COMPLETED: "reconstruction_completed",
    RECONSTRUCTION_FAILED: "reconstruction_failed",
};

const DOWNGRADE = {
    NARROWED_SCOPE: "narrowed_scope",
    UNRESOLVED: "unresolved",
    SUPPORT_DEGRADED: "support_degraded",
    RETAINED_TIER_INSUFFICIENT: "retained_tier_insufficient",
    RECONSTRUCTION_NOT_JUSTIFIED: "reconstruction_not_justified",
    NEW_IDENTITY_REQUIRED: "new_identity_required",
};

const NON_CLAIMS = [
    "not raw restoration",
    "not truth",
    "not canon",
    "not promotion",
    "not ontology",
    "not equivalent to original source signal",
    "not operator reversal",
    "not source-adjacent reconstitution",
];

function makeTraceStep({
    stepIndex,
    stepType,
    status = "ok",
    label,
    detail,
    evidenceRef = null,
    retainedTier = "Tier 0 - live working state",
    lensBound = true,
    nonAuthorityNote = "lens-bound support - not authority",
}) {
    return {
        step_index: stepIndex,
        step_type: stepType,
        status,
        label,
        detail,
        evidence_ref: evidenceRef,
        retained_tier: retainedTier,
        lens_bound: lensBound,
        non_authority_note: nonAuthorityNote,
    };
}

function getTierNumber(replayRequest) {
    return Number(replayRequest?.retained_tier_used?.tier_used ?? 0);
}

function getTierLabel(replayRequest) {
    return replayRequest?.retained_tier_used?.tier_label ?? "Tier 0 - live working state";
}

function extractReplayTarget(replayRequest) {
    if (!replayRequest) return null;
    return {
        type: replayRequest.replay_target_type ?? "unknown",
        ref: replayRequest.replay_target_ref ?? null,
        family: replayRequest.source_family ?? "unspecified",
        run: replayRequest.run_label ?? null,
        stream: replayRequest.stream_id ?? null,
        source: replayRequest.source_id ?? null,
    };
}

function collectRuntimeSupport(runResult, workbench) {
    if (!runResult?.ok) return { available: false, refs: [], counts: {} };
    const arts = runResult.artifacts ?? {};
    const runtimeRefs = [];
    const contextualRefs = [];
    const counts = {};

    if (arts.a1) {
        counts.a1 = 1;
        runtimeRefs.push("a1_ingest_artifact");
    }
    if (Array.isArray(arts.h1s) && arts.h1s.length) {
        counts.h1s = arts.h1s.length;
        runtimeRefs.push("h1s_harmonic_states");
    }
    if (Array.isArray(arts.m1s) && arts.m1s.length) {
        counts.m1s = arts.m1s.length;
        runtimeRefs.push("m1s_merged_states");
    }
    if (Array.isArray(arts.anomaly_reports) && arts.anomaly_reports.length) {
        counts.anomaly_reports = arts.anomaly_reports.length;
        runtimeRefs.push("anomaly_reports");
    }
    if (arts.q) {
        counts.q = 1;
        runtimeRefs.push("q_query_result");
    }

    if (runResult?.runtime_receipt) contextualRefs.push("runtime_receipt");
    if (workbench?.scope) contextualRefs.push("workbench_scope");
    if (workbench?.runtime) contextualRefs.push("workbench_runtime");

    return {
        available: runtimeRefs.length > 0,
        refs: [...runtimeRefs, ...contextualRefs],
        runtime_refs: runtimeRefs,
        contextual_refs: contextualRefs,
        counts,
        runtime_receipt: runResult?.runtime_receipt ?? null,
    };
}

function collectReceiptSupport(replayRequest) {
    const receiptSupport = replayRequest?.receipt_support ?? null;
    const receiptRefs = Array.isArray(receiptSupport?.receipt_refs)
        ? receiptSupport.receipt_refs.filter(Boolean)
        : [];
    const lineageRefs = Array.isArray(receiptSupport?.receipt_lineage)
        ? receiptSupport.receipt_lineage.filter(Boolean)
        : [];
    const refs = [...receiptRefs, ...lineageRefs].filter((v, i, a) => a.indexOf(v) === i);

    return {
        available:
            refs.length > 0 &&
            receiptSupport?.provenance_complete === true &&
            receiptSupport?.replayable_support_present === true,
        refs,
        receipt_count: Number(receiptSupport?.receipt_count ?? refs.length ?? 0),
        provenance_complete: receiptSupport?.provenance_complete === true,
        replayable_support_present: receiptSupport?.replayable_support_present === true,
        lineage_summary: receiptSupport?.lineage_summary ?? null,
    };
}

function collectInterpretiveSupport(workbench) {
    if (!workbench) return { available: false, refs: [] };
    const refs = [];
    if (workbench.workbench_receipt) refs.push("workbench_receipt");
    if (workbench.interpretation) refs.push("workbench_interpretation");
    return {
        available: refs.length > 0,
        refs,
        workbench_receipt: workbench?.workbench_receipt ?? null,
    };
}

function buildSupportSummary({
    runtimeSupport = null,
    receiptSupport = null,
    interpretiveSupport = null,
} = {}) {
    return {
        runtime: {
            available: runtimeSupport?.available === true,
            runtime_ref_count: runtimeSupport?.runtime_refs?.length ?? 0,
            contextual_ref_count: runtimeSupport?.contextual_refs?.length ?? 0,
            artifact_counts: runtimeSupport?.counts ?? {},
            receipt: runtimeSupport?.runtime_receipt ?? null,
        },
        receipts: {
            available: receiptSupport?.available === true,
            ref_count: receiptSupport?.refs?.length ?? 0,
            receipt_count: receiptSupport?.receipt_count ?? 0,
            provenance_complete: receiptSupport?.provenance_complete === true,
            replayable_support_present: receiptSupport?.replayable_support_present === true,
            lineage_summary: receiptSupport?.lineage_summary ?? null,
        },
        interpretive: {
            available: interpretiveSupport?.available === true,
            ref_count: interpretiveSupport?.refs?.length ?? 0,
            receipt: interpretiveSupport?.workbench_receipt ?? null,
        },
    };
}

function buildReconstructionReceipt({
    replayRequest = null,
    target = null,
    reconstructionStatus = "unknown",
    supportBasis = [],
    thresholdPosture = null,
    supportSummary = null,
    mechanizationStatus = "unknown",
} = {}) {
    return {
        receipt_type: "runtime:provenance_reconstruction_receipt",
        replay_request_id: replayRequest?.replay_request_id ?? null,
        replay_type: replayRequest?.replay_type ?? "unknown",
        reconstruction_status: reconstructionStatus,
        target_type: target?.type ?? replayRequest?.replay_target_type ?? null,
        retained_tier: getTierLabel(replayRequest),
        support_basis_count: supportBasis.length,
        runtime_support_available: supportSummary?.runtime?.available === true,
        receipt_support_available: supportSummary?.receipts?.available === true,
        interpretive_support_available: supportSummary?.interpretive?.available === true,
        threshold_outcome: thresholdPosture?.threshold_outcome ?? null,
        downgrade_output: thresholdPosture?.downgrade_output ?? null,
        mechanization_status: mechanizationStatus,
    };
}

function determineMechanizationStatus({ failed = false, tierNum = 0, downgradeOutput = null } = {}) {
    if (failed) return "failed";
    if (downgradeOutput) return "partially_mechanized";
    return tierNum <= 1 ? "mechanized" : "partially_mechanized";
}

function evaluateThresholdPosture({
    failed = false,
    tierUsed = 0,
    tierLabel = null,
    hasRunResult = false,
    hasWorkbench = false,
    hasRuntimeSupport = false,
    hasReceiptSupport = false,
    isRequestReplay = false,
    targetRequestPresent = false,
} = {}) {
    const resolvedTierLabel = tierLabel ?? `Tier ${tierUsed}`;

    if (failed) {
        return {
            local_invariance: "unknown",
            compression_survival: "unknown",
            distortion_posture: "fail",
            retained_tier_sufficiency: "fail",
            query_equivalence: "not_applicable",
            downgrade_output: DOWNGRADE.RECONSTRUCTION_NOT_JUSTIFIED,
            threshold_outcome: DOWNGRADE.RECONSTRUCTION_NOT_JUSTIFIED,
            failure_posture: "reconstruction failed before a lawful replay-support basis was established",
            notes: "reconstruction failed - threshold evaluation could not be completed",
        };
    }

    const tier0Supported = tierUsed === 0 && hasRunResult && hasWorkbench && hasRuntimeSupport;
    const tier1Supported = tierUsed === 1 && hasReceiptSupport;
    const supported = tier0Supported || tier1Supported;

    let downgradeOutput = null;
    let failurePosture = "";

    if (isRequestReplay && !targetRequestPresent) {
        downgradeOutput = DOWNGRADE.SUPPORT_DEGRADED;
        failurePosture = "request-support replay is missing the original request context";
    } else if (tierUsed >= 2) {
        downgradeOutput = DOWNGRADE.RETAINED_TIER_INSUFFICIENT;
        failurePosture = `${resolvedTierLabel} replay remains an explicit downgrade/insufficiency surface in v0`;
    } else if (tierUsed === 1 && !hasReceiptSupport) {
        downgradeOutput = DOWNGRADE.RETAINED_TIER_INSUFFICIENT;
        failurePosture = "Tier 1 replay requires receipt-backed lineage support";
    } else if (tierUsed === 0 && (!hasRunResult || !hasRuntimeSupport)) {
        downgradeOutput = DOWNGRADE.RECONSTRUCTION_NOT_JUSTIFIED;
        failurePosture = "Tier 0 replay requires live runtime support-trace artifacts";
    }

    return {
        local_invariance: supported ? "pass" : "unknown",
        compression_survival: (hasRuntimeSupport || hasReceiptSupport) ? "pass" : "unknown",
        distortion_posture: supported ? "pass" : "warning",
        retained_tier_sufficiency: tierUsed >= 2 ? "fail" : supported ? "pass" : "unknown",
        query_equivalence: "not_applicable",
        downgrade_output: downgradeOutput,
        threshold_outcome: downgradeOutput ?? (supported ? "bounded_supported" : "support_unresolved"),
        failure_posture: failurePosture,
        notes:
            tierUsed === 0
                ? "Tier 0 live working state - session-scoped only"
                : tierUsed === 1
                    ? "Tier 1 durable receipt lineage - receipt-backed support only"
                    : `${resolvedTierLabel} replay not yet wired in v0; downgrade/insufficiency posture remains explicit`,
    };
}

function declareScaleLatencyFidelity(runtimeSupport, receiptSupport, tierNum) {
    if (tierNum === 1 && receiptSupport.available) {
        return {
            latency_posture: "Tier 1 durable receipt lineage - bounded by retained receipt access rather than live session state",
            fidelity_posture: `support-trace class - receipt-backed lineage - ${receiptSupport.receipt_count} durable receipt reference${receiptSupport.receipt_count !== 1 ? "s" : ""} - not source restoration`,
        };
    }
    if (!runtimeSupport.available) {
        return {
            latency_posture: "not_applicable - no runtime support",
            fidelity_posture: "support-trace declared but no runtime evidence available - fidelity unknown",
        };
    }
    const stateCount = (runtimeSupport.counts.h1s ?? 0) + (runtimeSupport.counts.m1s ?? 0);
    return {
        latency_posture: "Tier 0 live working state - session-scoped - reconstruction available only while the active session remains available",
        fidelity_posture: `support-trace class - ${stateCount} harmonic/merged state${stateCount !== 1 ? "s" : ""} referenced - lens-bound - not raw restoration`,
    };
}

function buildReplayFidelityRecord({
    replayRequest = null,
    supportBasis = [],
    reconstructionTrace = [],
    fidelityPosture = "",
    latencyPosture = "",
    thresholdPosture = null,
    reconstructionSummary = null,
    failurePosture = "",
    mechanizationStatus = "partially_mechanized",
} = {}) {
    const explicitNonClaims = [
        ...(replayRequest?.explicit_non_claims ?? []),
        ...NON_CLAIMS.filter((claim) => !(replayRequest?.explicit_non_claims ?? []).includes(claim)),
    ];
    const boundedQuestion = replayRequest?.replay_type === "request_support_replay"
        ? "Can this replay surface still support bounded request-context inspection under the declared lens and retained tier?"
        : "Can this replay surface still support bounded replay reconstruction inspection under the declared lens and retained tier?";

    return {
        bounded_question: boundedQuestion,
        reconstruction_class: reconstructionSummary?.reconstruction_class ?? "support_trace",
        declared_lens: replayRequest?.declared_lens ?? null,
        retained_tier: getTierLabel(replayRequest),
        support_basis: supportBasis,
        reconstruction_trace: reconstructionTrace.map((step) => ({
            step_index: step.step_index,
            step_type: step.step_type,
            status: step.status,
        })),
        mechanization_status: mechanizationStatus,
        fidelity_posture: fidelityPosture,
        threshold_outcome: thresholdPosture?.threshold_outcome ?? "",
        downgrade_posture: thresholdPosture?.downgrade_output ?? "",
        latency_posture: latencyPosture,
        reconstruction_summary:
            reconstructionSummary?.summary_text ??
            reconstructionSummary?.non_authority_note ??
            "support-trace replay record emitted",
        explicit_non_claims: explicitNonClaims,
        failure_posture: failurePosture || thresholdPosture?.failure_posture || "",
    };
}

function failReplay(replayRequest, trace, reason) {
    const tierNum = getTierNumber(replayRequest);
    const thresholdPosture = evaluateThresholdPosture({
        failed: true,
        tierUsed: tierNum,
        tierLabel: getTierLabel(replayRequest),
    });

    trace.push(makeTraceStep({
        stepIndex: trace.length,
        stepType: STEP.RECONSTRUCTION_FAILED,
        status: "failed",
        label: "reconstruction failed",
        detail: reason,
        lensBound: false,
        nonAuthorityNote: "explicit failure - no invented support",
    }));
    const supportSummary = buildSupportSummary({});
    const replayFidelityRecord = buildReplayFidelityRecord({
        replayRequest,
        supportBasis: [],
        reconstructionTrace: trace,
        thresholdPosture,
        reconstructionSummary: {
            reconstruction_class: "support_trace",
            summary_text: "replay reconstruction failed before a lawful support-trace result could be produced",
        },
        failurePosture: reason,
        mechanizationStatus: determineMechanizationStatus({ failed: true, tierNum }),
    });
    const replayPreview = {
        reconstruction_status: "failed",
        retained_tier_used: replayRequest?.retained_tier_used ?? null,
        threshold_posture: thresholdPosture,
        replay_fidelity_record_v0: replayFidelityRecord,
    };
    const readsidePosture = {
        threshold: deriveReplayThresholdPosture(replayPreview),
        fidelity: deriveReplayFidelityPosture(replayPreview),
    };
    const reconstructionReceipt = buildReconstructionReceipt({
        replayRequest,
        reconstructionStatus: "failed",
        supportBasis: [],
        thresholdPosture,
        supportSummary,
        mechanizationStatus: replayFidelityRecord.mechanization_status,
    });

    return {
        ok: false,
        reconstruction_type: replayRequest?.replay_type ?? "unknown",
        reconstruction_status: "failed",
        replay_request_id: replayRequest?.replay_request_id ?? null,
        target: null,
        declared_lens: replayRequest?.declared_lens ?? null,
        retained_tier_used: replayRequest?.retained_tier_used ?? null,
        support_basis: [],
        explicit_non_claims: [
            ...(replayRequest?.explicit_non_claims ?? []),
            ...NON_CLAIMS.filter((claim) => !(replayRequest?.explicit_non_claims ?? []).includes(claim)),
        ],
        derived_vs_durable: "failed - no support derived",
        latency_posture: null,
        fidelity_posture: null,
        threshold_posture: thresholdPosture,
        support_summary: supportSummary,
        reconstruction_trace: trace,
        reconstruction_summary: {
            reconstruction_class: "support_trace",
            step_count: trace.length,
            evidence_refs: 0,
            failure_reason: reason,
            summary_text: "replay reconstruction failed before a lawful support-trace result could be produced",
        },
        replay_fidelity_record_v0: replayFidelityRecord,
        readside_posture: readsidePosture,
        reconstruction_receipt: reconstructionReceipt,
        notes: null,
        failure_reason: reason,
        failure_posture: reason,
    };
}

export function reconstructFromReplayRequest({
    replayRequest = null,
    runResult = null,
    workbench = null,
} = {}) {
    const trace = [];

    if (!replayRequest || typeof replayRequest !== "object") {
        return failReplay(null, trace, "replayRequest is null or not an object");
    }
    if (replayRequest.request_status === "failed") {
        return failReplay(
            replayRequest,
            trace,
            `replayRequest has status 'failed': ${replayRequest.failure_reason ?? "no reason recorded"}`
        );
    }

    trace.push(makeTraceStep({
        stepIndex: 0,
        stepType: STEP.REPLAY_REQUEST_RECEIVED,
        label: "replay request received",
        detail: `id=${replayRequest.replay_request_id} type=${replayRequest.replay_type} status=${replayRequest.request_status}`,
        evidenceRef: replayRequest.replay_request_id,
    }));

    const target = extractReplayTarget(replayRequest);
    if (!target || !target.type || target.type === "unknown") {
        return failReplay(replayRequest, trace, "replay target type cannot be resolved from replayRequest");
    }

    trace.push(makeTraceStep({
        stepIndex: 1,
        stepType: STEP.TARGET_RESOLVED,
        label: "target resolved",
        detail: `type=${target.type} ref=${target.ref ?? "-"} family=${target.family} run=${target.run ?? "-"}`,
        evidenceRef: target.ref,
    }));

    const lens = replayRequest.declared_lens ?? null;
    trace.push(makeTraceStep({
        stepIndex: 2,
        stepType: STEP.LENS_DECLARED,
        status: lens ? "ok" : "warning",
        label: "lens declared",
        detail: lens
            ? `${lens.transform_family ?? "?"} - N=${lens.window_N ?? "?"} - hop=${lens.hop_N ?? "?"} - Fs=${lens.Fs_target ?? "?"}`
            : "no declared lens",
        nonAuthorityNote: "declared lens only - not re-run from raw source",
    }));

    const tier = replayRequest.retained_tier_used ?? null;
    const tierNum = getTierNumber(replayRequest);
    const tierLabel = getTierLabel(replayRequest);
    trace.push(makeTraceStep({
        stepIndex: 3,
        stepType: STEP.RETAINED_TIER_DECLARED,
        status: tierNum <= 1 ? "ok" : "warning",
        label: "retained tier declared",
        detail: `${tierLabel} - honest_posture=${tier?.honest_posture ?? "unspecified"}`,
        retainedTier: tierLabel,
        nonAuthorityNote:
            tierNum >= 2
                ? `${tierLabel} remains downgrade/insufficiency only in v0`
                : `${tierLabel} remains bounded support, not restoration`,
    }));

    const hasLineage = !!(target.stream || target.run || target.source);
    trace.push(makeTraceStep({
        stepIndex: 4,
        stepType: STEP.LINEAGE_BOUND,
        status: hasLineage ? "ok" : "warning",
        label: "lineage bound",
        detail: `stream=${target.stream ?? "-"} run=${target.run ?? "-"} source=${target.source ?? "-"}`,
        evidenceRef: target.stream ?? target.run,
        retainedTier: tierLabel,
        nonAuthorityNote: "lineage stays bounded to declared replay request fields",
    }));

    const runtimeSupport = collectRuntimeSupport(runResult, workbench);
    trace.push(makeTraceStep({
        stepIndex: 5,
        stepType: STEP.RUNTIME_SUPPORT_COLLECTED,
        status: runtimeSupport.available ? "ok" : "warning",
        label: "runtime support collected",
        detail: runtimeSupport.available
            ? `runtime_refs=[${runtimeSupport.runtime_refs.join(", ")}] context_refs=[${runtimeSupport.contextual_refs.join(", ")}] counts=${JSON.stringify(runtimeSupport.counts)}`
            : "no meaningful runtime support available",
        evidenceRef: runtimeSupport.runtime_refs[0] ?? runtimeSupport.contextual_refs[0] ?? null,
        retainedTier: tierLabel,
        nonAuthorityNote: "runtime artifacts referenced by type only - not source restoration",
    }));

    const receiptSupport = collectReceiptSupport(replayRequest);
    trace.push(makeTraceStep({
        stepIndex: 6,
        stepType: STEP.RECEIPT_SUPPORT_COLLECTED,
        status: receiptSupport.available ? "ok" : "warning",
        label: "receipt support collected",
        detail: receiptSupport.available
            ? `receipt_refs=[${receiptSupport.refs.join(", ")}] provenance_complete=${receiptSupport.provenance_complete} replayable_support_present=${receiptSupport.replayable_support_present}`
            : "no durable receipt lineage supplied",
        evidenceRef: receiptSupport.refs[0] ?? null,
        retainedTier: tierLabel,
        nonAuthorityNote:
            tierNum === 1
                ? "receipt-backed lineage only - not source restoration"
                : "receipt support absent or not required for this tier",
    }));

    const interpretiveSupport = collectInterpretiveSupport(workbench);
    trace.push(makeTraceStep({
        stepIndex: 7,
        stepType: STEP.INTERPRETIVE_SUPPORT_COLLECTED,
        status: interpretiveSupport.available ? "ok" : "warning",
        label: "interpretive support collected",
        detail: interpretiveSupport.available
            ? `refs=[${interpretiveSupport.refs.join(", ")}]`
            : "no interpretive support available",
        evidenceRef: interpretiveSupport.refs[0] ?? null,
        retainedTier: tierLabel,
        nonAuthorityNote: "interpretive support is read-side only - not canon",
    }));

    if (tierNum === 0 && !runtimeSupport.available) {
        return failReplay(
            replayRequest,
            trace,
            "runtime_reconstruction replay requires meaningful live runtime support artifacts"
        );
    }
    if (tierNum === 1 && !receiptSupport.available) {
        return failReplay(
            replayRequest,
            trace,
            "Tier 1 replay requires receipt-backed lineage support"
        );
    }

    const { latency_posture, fidelity_posture } = declareScaleLatencyFidelity(
        runtimeSupport,
        receiptSupport,
        tierNum
    );
    trace.push(makeTraceStep({
        stepIndex: 8,
        stepType: STEP.SCALE_LATENCY_DECLARED,
        label: "scale / latency / fidelity declared",
        detail: `latency=${latency_posture} | fidelity=${fidelity_posture}`,
        retainedTier: tierLabel,
        nonAuthorityNote: "fidelity posture is declared support posture, not source equivalence",
    }));

    const isRequestReplay = replayRequest.replay_type === "request_support_replay";
    const requestContextPresent = isRequestReplay
        ? !!(replayRequest.replay_target_ref && replayRequest.target_request_type)
        : true;
    trace.push(makeTraceStep({
        stepIndex: 9,
        stepType: requestContextPresent ? STEP.REQUEST_CONTEXT_BOUND : STEP.REQUEST_CONTEXT_ABSENT,
        status: requestContextPresent ? "ok" : "warning",
        label: requestContextPresent ? "request context bound" : "request context absent",
        detail: requestContextPresent
            ? `target_ref=${replayRequest.replay_target_ref ?? "-"} target_type=${replayRequest.target_request_type ?? replayRequest.replay_target_type ?? "-"}`
            : "no target request reference found",
        evidenceRef: replayRequest.replay_target_ref ?? null,
        retainedTier: tierLabel,
        nonAuthorityNote: isRequestReplay
            ? "request-support replay - original request is not fulfilled by replay"
            : "runtime reconstruction requires no external request context",
    }));

    const thresholdPosture = evaluateThresholdPosture({
        tierUsed: tierNum,
        tierLabel,
        hasRunResult: !!runResult?.ok,
        hasWorkbench: !!workbench,
        hasRuntimeSupport: runtimeSupport.available,
        hasReceiptSupport: receiptSupport.available,
        isRequestReplay,
        targetRequestPresent: requestContextPresent,
    });

    const allRefs = [
        ...runtimeSupport.refs,
        ...receiptSupport.refs,
        ...interpretiveSupport.refs,
    ].filter((v, i, a) => a.indexOf(v) === i);

    const finalStepType = thresholdPosture.downgrade_output
        ? STEP.RECONSTRUCTION_DOWNGRADED
        : STEP.RECONSTRUCTION_COMPLETED;
    const finalLabel = thresholdPosture.downgrade_output
        ? "reconstruction downgraded"
        : "reconstruction completed";
    const finalStatus = thresholdPosture.downgrade_output ? "warning" : "ok";
    const finalDetail = thresholdPosture.downgrade_output
        ? `support-trace replay remains explicit but downgraded - downgrade=${thresholdPosture.downgrade_output} - ${tierLabel}`
        : `support-trace replay completed with ${allRefs.length} evidence ref${allRefs.length !== 1 ? "s" : ""} - ${tierLabel}`;

    trace.push(makeTraceStep({
        stepIndex: 10,
        stepType: finalStepType,
        status: finalStatus,
        label: finalLabel,
        detail: finalDetail,
        evidenceRef: allRefs[0] ?? null,
        retainedTier: tierLabel,
        nonAuthorityNote: thresholdPosture.downgrade_output
            ? "explicit downgrade posture - not stronger continuity than support justifies"
            : "support-trace reconstruction complete - not raw restoration - not truth",
    }));

    const supportBasis = [
        ...(replayRequest.support_basis ?? []),
        ...runtimeSupport.refs,
        ...receiptSupport.refs,
        ...interpretiveSupport.refs,
    ].filter((v, i, a) => a.indexOf(v) === i);

    const reconstructionSummary = {
        reconstruction_class: "support_trace",
        replay_type: replayRequest.replay_type,
        step_count: trace.length,
        evidence_refs: allRefs.length,
        support_basis_count: supportBasis.length,
        runtime_available: runtimeSupport.available,
        receipt_lineage_available: receiptSupport.available,
        interpretive_available: interpretiveSupport.available,
        tier_used: tierNum,
        tier_label: tierLabel,
        lens_declared: !!lens,
        lineage_bound: hasLineage,
        threshold_outcome: thresholdPosture.threshold_outcome,
        downgrade_output: thresholdPosture.downgrade_output,
        failure_posture: thresholdPosture.failure_posture,
        summary_text: thresholdPosture.downgrade_output
            ? `support-trace replay stayed explicit but was downgraded at ${tierLabel}`
            : tierNum === 1
                ? "receipt-backed support-trace replay completed under Tier 1 lineage posture"
                : "live support-trace replay completed under Tier 0 posture",
        non_authority_note: `support-trace only - ${tierLabel} - lens-bound - not raw restoration - not canon`,
    };

    const replayFidelityRecord = buildReplayFidelityRecord({
        replayRequest,
        supportBasis,
        reconstructionTrace: trace,
        fidelityPosture: fidelity_posture,
        latencyPosture: latency_posture,
        thresholdPosture,
        reconstructionSummary,
        failurePosture: thresholdPosture.failure_posture,
        mechanizationStatus: determineMechanizationStatus({
            tierNum,
            downgradeOutput: thresholdPosture.downgrade_output,
        }),
    });
    const supportSummary = buildSupportSummary({
        runtimeSupport,
        receiptSupport,
        interpretiveSupport,
    });
    const replayPreview = {
        reconstruction_status: thresholdPosture.downgrade_output ? "downgraded" : "completed",
        retained_tier_used: tier,
        threshold_posture: thresholdPosture,
        replay_fidelity_record_v0: replayFidelityRecord,
    };
    const readsidePosture = {
        threshold: deriveReplayThresholdPosture(replayPreview),
        fidelity: deriveReplayFidelityPosture(replayPreview),
    };
    const reconstructionReceipt = buildReconstructionReceipt({
        replayRequest,
        target,
        reconstructionStatus: thresholdPosture.downgrade_output ? "downgraded" : "completed",
        supportBasis,
        thresholdPosture,
        supportSummary,
        mechanizationStatus: replayFidelityRecord.mechanization_status,
    });

    return {
        ok: true,
        reconstruction_type: "support_trace",
        reconstruction_status: thresholdPosture.downgrade_output ? "downgraded" : "completed",
        replay_request_id: replayRequest.replay_request_id,
        target,
        declared_lens: lens,
        retained_tier_used: tier,
        support_basis: supportBasis,
        explicit_non_claims: replayFidelityRecord.explicit_non_claims,
        derived_vs_durable: replayRequest.derived_vs_durable ?? "derived - not durable",
        latency_posture,
        fidelity_posture,
        threshold_posture: thresholdPosture,
        support_summary: supportSummary,
        reconstruction_trace: trace,
        reconstruction_summary: reconstructionSummary,
        replay_fidelity_record_v0: replayFidelityRecord,
        readside_posture: readsidePosture,
        reconstruction_receipt: reconstructionReceipt,
        notes: replayRequest.notes ?? null,
        failure_reason: null,
        failure_posture: thresholdPosture.failure_posture,
    };
}
