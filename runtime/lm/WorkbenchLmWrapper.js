import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
    validateWorkbenchLmInput,
    validateWorkbenchLmOutput,
} from "../schema/WorkbenchLmSchemaValidators.js";

export const WORKBENCH_LM_WRAPPER_CONTRACT = {
    contract_type: "execution_surface:workbench_lm_wrapper_contract",
    contract_version: "0.1.0",
    reads: ["out_workbench/workbench.json"],
    writes: [
        "out_lm/lm_input.json",
        "out_lm/lm_prompt.txt",
        "out_lm/lm_wrapper_contract.json",
        "out_lm/lm_output.template.json",
    ],
    accepts_manual_output: "out_lm/lm_output.json",
    invocation_step: "manual_local_model_invocation",
    forbidden: [
        "auto_commit",
        "auto_promote",
        "runtime_mutation",
        "substrate_writeback",
        "memory_writeback",
        "canon_authority",
        "truth_closure",
        "same_object_closure",
        "identity_closure",
    ],
};

function stableStringify(value) {
    return JSON.stringify(value, null, 2);
}

const MAX_RECENT_COMMITTED_HANDLE_PAIRS = 3;

async function readJson(filePath) {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
}

async function writeJson(filePath, value) {
    await writeFile(filePath, `${stableStringify(value)}\n`, "utf8");
}

export function extractWorkbenchLmInputView(workbench) {
    const substrateHandles = extractSubstrateHandles(workbench);
    return {
        input_type: "door_one_workbench_lm_view",
        workbench_type: workbench?.workbench_type ?? "runtime:door_one_workbench",
        scope: {
            stream_id: workbench?.scope?.stream_id ?? null,
            source_id: workbench?.scope?.source_id ?? null,
            segment_ids: Array.isArray(workbench?.scope?.segment_ids) ? [...workbench.scope.segment_ids] : [],
            cross_run_available: !!workbench?.scope?.cross_run_context?.available,
            run_count: workbench?.scope?.cross_run_context?.run_count ?? 0,
        },
        runtime_receipt: {
            state_count: workbench?.runtime?.receipt?.state_count ?? 0,
            basin_count: workbench?.runtime?.receipt?.basin_count ?? 0,
            segment_count: workbench?.runtime?.receipt?.segment_count ?? 0,
            trajectory_frames: workbench?.runtime?.receipt?.trajectory_frames ?? 0,
            segment_transition_count: workbench?.runtime?.receipt?.segment_transition_count ?? 0,
            h1_count: workbench?.runtime?.receipt?.h1_count ?? 0,
            m1_count: workbench?.runtime?.receipt?.m1_count ?? 0,
            anomaly_count: workbench?.runtime?.receipt?.anomaly_count ?? 0,
            query_present: !!workbench?.runtime?.receipt?.query_present,
            skipped_window_count: workbench?.runtime?.receipt?.skipped_window_count ?? 0,
            merge_failure_count: workbench?.runtime?.receipt?.merge_failure_count ?? 0,
        },
        substrate_handles: substrateHandles,
        claim_posture: {
            authority: "read_side_only",
            forbidden: [
                "canon",
                "truth",
                "same_object_closure",
                "identity_closure",
                "promotion",
                "runtime_writeback",
            ],
        },
    };
}

export function buildWorkbenchLmOutputTemplate(inputStreamId = null) {
    return {
        response_type: "door_one_workbench_lm_response",
        input_stream_id: inputStreamId,
        observations: [
            " "
        ],
        questions: [
            " "
        ],
        non_claims: [
            "Not canon authority.",
            "Not runtime authority.",
            "Not truth closure.",
            "Not same-object closure.",
            "Not identity closure.",
            "Not promotion authority."
        ],
        authority_posture: {
            read_side_only: true,
            canon_authority: false,
            runtime_authority: false,
            truth_closure: false,
            identity_closure: false,
            same_object_closure: false,
            promotion_authority: false,
        },
    };
}

export function buildWorkbenchLmPrompt(lmInput) {
    const outputTemplate = buildWorkbenchLmOutputTemplate(lmInput?.scope?.stream_id ?? null);
    return [
        "You are reading a bounded Door One workbench LM input view.",
        "Operate in read-side-only mode.",
        "Return JSON only.",
        "Use exactly these top-level keys: response_type, input_stream_id, observations, questions, non_claims, authority_posture.",
        "Do not add any other keys.",
        "Do not wrap the JSON in markdown fences.",
        "Do not use a code block.",
        "The first character of your response must be {.",
        "The last character of your response must be }.",
        "observations must be an array of strings.",
        "questions must be an array of strings.",
        "non_claims must be an array of strings.",
        "authority_posture must exactly match the required booleans shown below.",
        "substrate_handles are typed read-side refs only.",
        "Do not treat substrate_handles as runtime authority.",
        "Do not infer payload contents beyond the supplied typed refs.",
        "Do not claim canon authority.",
        "Do not claim runtime authority.",
        "Do not claim truth closure.",
        "Do not claim same-object closure.",
        "Do not claim identity closure.",
        "Do not claim promotion authority.",
        "Do not write back into runtime or substrate state.",
        "",
        "Return JSON matching this template:",
        stableStringify(outputTemplate),
        "",
        "LM input follows:",
        stableStringify(lmInput),
    ].join("\n");
}

export async function stageWorkbenchLmInvocation({
    workbenchPath,
    outputDir,
}) {
    const workbench = await readJson(workbenchPath);
    const lmInput = extractWorkbenchLmInputView(workbench);
    const inputValidation = await validateWorkbenchLmInput(lmInput);
    if (!inputValidation.ok) {
        const error = new Error(`Invalid workbench LM input: ${inputValidation.errors.join("; ")}`);
        error.code = "INVALID_WORKBENCH_LM_INPUT";
        throw error;
    }

    await mkdir(outputDir, { recursive: true });

    const lmInputPath = path.join(outputDir, "lm_input.json");
    const promptPath = path.join(outputDir, "lm_prompt.txt");
    const contractPath = path.join(outputDir, "lm_wrapper_contract.json");
    const outputTemplatePath = path.join(outputDir, "lm_output.template.json");
    const lmOutputTemplate = buildWorkbenchLmOutputTemplate(lmInput.scope.stream_id);

    await writeJson(lmInputPath, lmInput);
    await writeJson(contractPath, WORKBENCH_LM_WRAPPER_CONTRACT);
    await writeJson(outputTemplatePath, lmOutputTemplate);
    await writeFile(promptPath, `${buildWorkbenchLmPrompt(lmInput)}\n`, "utf8");

    return {
        lmInput,
        inputValidation,
        paths: {
            lm_input: lmInputPath,
            lm_prompt: promptPath,
            lm_wrapper_contract: contractPath,
            lm_output_template: outputTemplatePath,
            lm_output: path.join(outputDir, "lm_output.json"),
        },
    };
}

export async function readAndValidateWorkbenchLmInput(inputPath) {
    const payload = await readJson(inputPath);
    const validation = await validateWorkbenchLmInput(payload);
    return {
        payload,
        validation,
    };
}

export async function readAndValidateWorkbenchLmOutput(outputPath) {
    const payload = await readJson(outputPath);
    const validation = await validateWorkbenchLmOutput(payload);
    return {
        payload,
        validation,
    };
}

function extractSubstrateHandles(workbench) {
    const substrate = workbench?.runtime?.substrate ?? {};
    const recentPairs = collectRecentCommittedHandlePairs(substrate);
    const latestPair = recentPairs.length > 0 ? recentPairs[recentPairs.length - 1] : null;

    return {
        latest_committed_state_id:
            substrate?.latest_committed_state_id ??
            latestPair?.state_id ??
            null,
        latest_committed_memory_object_id:
            substrate?.latest_committed_memory_object_id ??
            latestPair?.memory_object_id ??
            null,
        recent_committed_handle_pairs: recentPairs,
        handle_authority: "typed_refs_only_read_side",
        payload_included: false,
    };
}

function collectRecentCommittedHandlePairs(substrate) {
    const directPairs = Array.isArray(substrate?.recent_committed_handle_pairs)
        ? substrate.recent_committed_handle_pairs
        : [];
    const trajectoryFrames = Array.isArray(substrate?.trajectory_frames)
        ? substrate.trajectory_frames
        : [];

    const sourcePairs = directPairs.length > 0
        ? directPairs
        : trajectoryFrames.map((frame) => ({
            state_id: frame?.state_id ?? null,
            memory_object_id: frame?.memory_object_id ?? null,
            artifact_class: frame?.artifact_class ?? null,
            segment_id: frame?.segment_id ?? null,
            t_start: frame?.t_start ?? null,
            t_end: frame?.t_end ?? null,
        }));

    return sourcePairs
        .map(normalizeCommittedHandlePair)
        .filter(Boolean)
        .slice(-MAX_RECENT_COMMITTED_HANDLE_PAIRS);
}

function normalizeCommittedHandlePair(pair) {
    if (!pair || typeof pair !== "object") return null;
    if (typeof pair.state_id !== "string" || pair.state_id.length === 0) return null;
    if (pair.memory_object_id !== null && pair.memory_object_id !== undefined &&
        (typeof pair.memory_object_id !== "string" || pair.memory_object_id.length === 0)) {
        return null;
    }
    if (pair.artifact_class !== "H1" && pair.artifact_class !== "M1") return null;

    return {
        state_id: pair.state_id,
        memory_object_id: pair.memory_object_id ?? null,
        artifact_class: pair.artifact_class,
        segment_id: typeof pair.segment_id === "string" ? pair.segment_id : null,
        t_start: Number.isFinite(pair.t_start) ? pair.t_start : null,
        t_end: Number.isFinite(pair.t_end) ? pair.t_end : null,
    };
}
