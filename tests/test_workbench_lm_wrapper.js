import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    WORKBENCH_LM_WRAPPER_CONTRACT,
    buildWorkbenchLmOutputTemplate,
    extractWorkbenchLmInputView,
    readAndValidateWorkbenchLmInput,
    readAndValidateWorkbenchLmOutput,
    stageWorkbenchLmInvocation,
} from "../runtime/lm/WorkbenchLmWrapper.js";
import {
    validateWorkbenchLmInput,
    validateWorkbenchLmOutput,
} from "../runtime/schema/WorkbenchLmSchemaValidators.js";

let PASS = 0;
let FAIL = 0;

function ok(condition, label) {
    if (condition) {
        PASS += 1;
        console.log(`  ok ${label}`);
    } else {
        FAIL += 1;
        console.error(`  not ok ${label}`);
    }
}

function eq(actual, expected, label) {
    ok(Object.is(actual, expected), `${label}${Object.is(actual, expected) ? "" : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`}`);
}

function section(title) {
    console.log(`\n-- ${title} --`);
}

const workbenchFixture = {
    workbench_type: "runtime:door_one_workbench",
    scope: {
        stream_id: "STR:test:ch0:voltage:arb:8",
        source_id: "test_source",
        segment_ids: [
            "seg:STR:test:ch0:voltage:arb:8:0",
            "seg:STR:test:ch0:voltage:arb:8:1",
        ],
        cross_run_context: {
            available: true,
            run_count: 3,
        },
    },
    runtime: {
        receipt: {
            state_count: 9,
            basin_count: 2,
            segment_count: 2,
            trajectory_frames: 9,
            segment_transition_count: 1,
            h1_count: 7,
            m1_count: 2,
            anomaly_count: 1,
            query_present: true,
            skipped_window_count: 0,
            merge_failure_count: 0,
        },
        artifacts: {
            a1: {
                timestamps: [0, 1, 2],
            },
        },
    },
    semantic_overlay: {
        trajectory: {
            convergence: "insufficient_data",
        },
    },
};

section("A. LM input extraction");
const lmInput = extractWorkbenchLmInputView(workbenchFixture);
const lmInputValidation = await validateWorkbenchLmInput(lmInput);
eq(lmInputValidation.ok, true, `A1: extracted LM input validates${lmInputValidation.ok ? "" : ` ${lmInputValidation.errors.join("; ")}`}`);
eq(lmInput.input_type, "door_one_workbench_lm_view", "A2: input type preserved");
eq(lmInput.workbench_type, "runtime:door_one_workbench", "A3: workbench type preserved");
eq(Array.isArray(lmInput.scope.segment_ids), true, "A4: segment_ids preserved");
eq("artifacts" in lmInput, false, "A5: raw artifacts are not forwarded");
eq(JSON.stringify(lmInput).includes("timestamps"), false, "A6: raw primary arrays are not forwarded");
eq(lmInput.claim_posture.authority, "read_side_only", "A7: claim posture is read-side only");

section("B. Wrapper contract");
eq(WORKBENCH_LM_WRAPPER_CONTRACT.contract_type, "execution_surface:workbench_lm_wrapper_contract", "B1: wrapper contract type explicit");
ok(WORKBENCH_LM_WRAPPER_CONTRACT.forbidden.includes("runtime_mutation"), "B2: wrapper forbids runtime mutation");
ok(WORKBENCH_LM_WRAPPER_CONTRACT.forbidden.includes("auto_promote"), "B3: wrapper forbids promotion");
ok(WORKBENCH_LM_WRAPPER_CONTRACT.writes.includes("out_lm/lm_output.template.json"), "B4: wrapper stages an LM output template");

section("C. Staged invocation and IO validation");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "dme-workbench-lm-"));
try {
    const workbenchPath = path.join(tempDir, "workbench.json");
    const outputDir = path.join(tempDir, "out_lm");
    await writeFile(workbenchPath, `${JSON.stringify(workbenchFixture, null, 2)}\n`, "utf8");

    const staged = await stageWorkbenchLmInvocation({
        workbenchPath,
        outputDir,
    });

    const stagedInput = await readAndValidateWorkbenchLmInput(staged.paths.lm_input);
    eq(stagedInput.validation.ok, true, `C1: staged LM input validates on read${stagedInput.validation.ok ? "" : ` ${stagedInput.validation.errors.join("; ")}`}`);

    const promptText = await readFile(staged.paths.lm_prompt, "utf8");
    ok(promptText.includes("read-side-only mode"), "C2: prompt enforces read-side-only posture");
    ok(promptText.includes("Do not claim canon authority."), "C3: prompt forbids canon authority");
    ok(promptText.includes("response_type"), "C3b: prompt includes exact output shape");

    const contractRaw = await readFile(staged.paths.lm_wrapper_contract, "utf8");
    ok(contractRaw.includes("manual_local_model_invocation"), "C4: staged contract names manual invocation step");

    const outputTemplateRaw = await readFile(staged.paths.lm_output_template, "utf8");
    const outputTemplate = JSON.parse(outputTemplateRaw);
    const outputTemplateValidation = await validateWorkbenchLmOutput(outputTemplate);
    eq(outputTemplateValidation.ok, true, `C4b: staged LM output template validates${outputTemplateValidation.ok ? "" : ` ${outputTemplateValidation.errors.join("; ")}`}`);

    const lmOutput = {
        response_type: "door_one_workbench_lm_response",
        input_stream_id: staged.lmInput.scope.stream_id,
        observations: [
            "State count exceeds basin count, which suggests multiple states per structural grouping.",
            "Cross-run context is available, but this response remains single-run read-side only.",
        ],
        questions: [
            "Does anomaly_count stay stable across repeated workbench runs?"
        ],
        non_claims: [
            "Not canon.",
            "Not runtime authority.",
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

    const lmOutputPath = path.join(outputDir, "lm_output.json");
    await writeFile(lmOutputPath, `${JSON.stringify(lmOutput, null, 2)}\n`, "utf8");

    const stagedOutput = await readAndValidateWorkbenchLmOutput(lmOutputPath);
    eq(stagedOutput.validation.ok, true, `C5: staged LM output validates on read${stagedOutput.validation.ok ? "" : ` ${stagedOutput.validation.errors.join("; ")}`}`);
    eq(stagedOutput.payload.authority_posture.runtime_authority, false, "C6: LM output denies runtime authority");
    eq(stagedOutput.payload.authority_posture.canon_authority, false, "C7: LM output denies canon authority");
} finally {
    await rm(tempDir, { recursive: true, force: true });
}

section("D. Output boundary integrity");
const validOutput = buildWorkbenchLmOutputTemplate("STR:test:ch0:voltage:arb:8");
const validOutputValidation = await validateWorkbenchLmOutput(validOutput);
eq(validOutputValidation.ok, true, `D1: happy-path LM output validates${validOutputValidation.ok ? "" : ` ${validOutputValidation.errors.join("; ")}`}`);

console.log(`\n${PASS} passed   ${FAIL} failed`);
if (FAIL > 0) process.exit(1);
