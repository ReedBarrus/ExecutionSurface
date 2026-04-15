import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildWorkbenchLmOutputTemplate } from "../runtime/lm/WorkbenchLmWrapper.js";
import { runLocalLmBenchmark } from "../runtime/lm/LocalLmBenchmark.js";
import { validateLocalLmBenchmarkReceipt } from "../runtime/schema/WorkbenchLmSchemaValidators.js";

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

const lmInput = {
    input_type: "door_one_workbench_lm_view",
    workbench_type: "runtime:door_one_workbench",
    scope: {
        stream_id: "STR:test:ch0:voltage:arb:8",
        source_id: "test_source",
        segment_ids: ["seg:STR:test:0"],
        cross_run_available: true,
        run_count: 3,
    },
    runtime_receipt: {
        state_count: 9,
        basin_count: 2,
        segment_count: 1,
        trajectory_frames: 9,
        segment_transition_count: 1,
        h1_count: 7,
        m1_count: 2,
        anomaly_count: 1,
        query_present: true,
        skipped_window_count: 0,
        merge_failure_count: 0,
    },
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

section("A. Repeated benchmark run");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "dme-local-lm-bench-"));
try {
    const lmInputPath = path.join(tempDir, "lm_input.json");
    const promptPath = path.join(tempDir, "lm_prompt.txt");
    const resultsRoot = path.join(tempDir, "results");
    await writeFile(lmInputPath, `${JSON.stringify(lmInput, null, 2)}\n`, "utf8");
    await writeFile(promptPath, "Return JSON only.\n", "utf8");

    const responder = async () => {
        const payload = buildWorkbenchLmOutputTemplate(lmInput.scope.stream_id);
        payload.observations = [
            "State count exceeds basin count, which suggests multiple states per grouping.",
            "Cross-run context is available, but this remains read-side only.",
        ];
        payload.questions = [
            "Does anomaly_count remain stable across repeated runs?"
        ];
        return {
            output: [
                {
                    type: "message",
                    content: JSON.stringify(payload, null, 2),
                },
            ],
            stats: {
                input_tokens: 10,
                total_output_tokens: 20,
            },
        };
    };

    const result = await runLocalLmBenchmark({
        endpoint: "http://local.test:1234",
        model: "meta-llama-3.1-8b-instruct",
        lmInputPath,
        promptPath,
        resultsRoot,
        repeatCount: 3,
        temperature: 0,
        invokeFn: responder,
        now: new Date("2026-04-14T12:00:00.000Z"),
    });

    eq(result.receipts.length, 3, "A1: three receipts written");
    eq(result.summary.pass_count, 3, "A2: all repeated runs passed");
    eq(result.summary.unique_normalized_output_hashes, 1, "A3: normalized output hash is stable across runs");
    eq(result.summary.observation_count_stable, true, "A4: observation counts are stable");
    eq(result.summary.question_count_stable, true, "A5: question counts are stable");

    const summaryRaw = JSON.parse(await readFile(result.summaryPath, "utf8"));
    eq(summaryRaw.summary_type, "lm:local_benchmark_summary", "A6: summary written to disk");

    const firstReceiptRaw = JSON.parse(await readFile(path.join(result.benchmarkDir, "attempt_001", "benchmark.json"), "utf8"));
    const firstReceiptValidation = await validateLocalLmBenchmarkReceipt(firstReceiptRaw);
    eq(firstReceiptValidation.ok, true, `A7: benchmark receipt validates${firstReceiptValidation.ok ? "" : ` ${firstReceiptValidation.errors.join("; ")}`}`);
    eq(firstReceiptRaw.contract_obedience.passed, true, "A8: contract obedience passes");
} finally {
    await rm(tempDir, { recursive: true, force: true });
}

section("B. Extra text is measured as obedience drift");
const tempDirDrift = await mkdtemp(path.join(os.tmpdir(), "dme-local-lm-bench-drift-"));
try {
    const lmInputPath = path.join(tempDirDrift, "lm_input.json");
    const promptPath = path.join(tempDirDrift, "lm_prompt.txt");
    const resultsRoot = path.join(tempDirDrift, "results");
    await writeFile(lmInputPath, `${JSON.stringify(lmInput, null, 2)}\n`, "utf8");
    await writeFile(promptPath, "Return JSON only.\n", "utf8");

    const responder = async () => {
        const payload = buildWorkbenchLmOutputTemplate(lmInput.scope.stream_id);
        return {
            output: [
                {
                    type: "message",
                    content: `Here is the JSON you asked for:\n${JSON.stringify(payload, null, 2)}`,
                },
            ],
            stats: {},
        };
    };

    const result = await runLocalLmBenchmark({
        endpoint: "http://local.test:1234",
        model: "meta-llama-3.1-8b-instruct",
        lmInputPath,
        promptPath,
        resultsRoot,
        repeatCount: 1,
        temperature: 0,
        invokeFn: responder,
        now: new Date("2026-04-14T12:10:00.000Z"),
    });

    eq(result.receipts[0].contract_obedience.no_extra_text, false, "B1: extra text is detected");
    eq(result.receipts[0].contract_obedience.schema_ok, true, "B2: schema can still pass after extraction");
    eq(result.receipts[0].contract_obedience.passed, false, "B3: obedience fails when extra text is present");
} finally {
    await rm(tempDirDrift, { recursive: true, force: true });
}

console.log(`\n${PASS} passed   ${FAIL} failed`);
if (FAIL > 0) process.exit(1);
