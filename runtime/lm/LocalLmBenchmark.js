import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import {
    readAndValidateWorkbenchLmInput,
    readAndValidateWorkbenchLmOutput,
} from "./WorkbenchLmWrapper.js";
import {
    validateLocalLmBenchmarkReceipt,
    validateWorkbenchLmOutput,
} from "../schema/WorkbenchLmSchemaValidators.js";

const REQUIRED_NON_CLAIMS = [
    "not canon authority.",
    "not runtime authority.",
    "not truth closure.",
    "not same-object closure.",
    "not identity closure.",
    "not promotion authority.",
];

function stableStringify(value) {
    return JSON.stringify(value, null, 2);
}

async function readJson(filePath) {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
}

async function writeJson(filePath, value) {
    await writeFile(filePath, `${stableStringify(value)}\n`, "utf8");
}

function sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

function makeRunId(now = new Date()) {
    const iso = now.toISOString().replace(/[:.]/g, "-");
    return `run_${iso}`;
}

function extractJsonObjectFromText(text) {
    const source = `${text ?? ""}`;
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];

        if (start === -1) {
            if (char === "{") {
                start = index;
                depth = 1;
            }
            continue;
        }

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === "\\") {
            escaped = true;
            continue;
        }

        if (char === "\"") {
            inString = !inString;
            continue;
        }

        if (inString) continue;

        if (char === "{") depth += 1;
        if (char === "}") depth -= 1;

        if (depth === 0) {
            const jsonText = source.slice(start, index + 1);
            return {
                ok: true,
                jsonText,
                leadingText: source.slice(0, start),
                trailingText: source.slice(index + 1),
            };
        }
    }

    return {
        ok: false,
        jsonText: null,
        leadingText: source,
        trailingText: "",
    };
}

function countDuplicateStrings(values) {
    const seen = new Set();
    let duplicates = 0;
    for (const value of values ?? []) {
        const normalized = `${value ?? ""}`.trim().toLowerCase();
        if (!normalized) continue;
        if (seen.has(normalized)) duplicates += 1;
        else seen.add(normalized);
    }
    return duplicates;
}

function countEmptyOrUselessObservations(values) {
    let count = 0;
    for (const value of values ?? []) {
        const normalized = `${value ?? ""}`.trim().toLowerCase();
        if (!normalized) {
            count += 1;
            continue;
        }
        if (normalized === "read-side observation only." || normalized === "read-side observation only") {
            count += 1;
        }
    }
    return count;
}

function countAuthorityDrift(authorityPosture) {
    if (!authorityPosture || typeof authorityPosture !== "object") return 7;
    let drift = 0;
    if (authorityPosture.read_side_only !== true) drift += 1;
    if (authorityPosture.canon_authority !== false) drift += 1;
    if (authorityPosture.runtime_authority !== false) drift += 1;
    if (authorityPosture.truth_closure !== false) drift += 1;
    if (authorityPosture.identity_closure !== false) drift += 1;
    if (authorityPosture.same_object_closure !== false) drift += 1;
    if (authorityPosture.promotion_authority !== false) drift += 1;
    return drift;
}

function hasRequiredNonClaims(nonClaims) {
    const normalized = new Set((nonClaims ?? []).map((item) => `${item}`.trim().toLowerCase()));
    return REQUIRED_NON_CLAIMS.every((claim) => normalized.has(claim));
}

function buildBenchmarkReceipt({
    benchmarkId,
    modelId,
    endpoint,
    inputPaths,
    runDir,
    runIndex,
    temperature,
    rawContent,
    parsedPayload,
    outputValidation,
    noExtraText,
    responsePaths,
    apiStats,
}) {
    const normalizedOutputHash = parsedPayload ? sha256(JSON.stringify(parsedPayload)) : null;
    const rawOutputHash = sha256(rawContent ?? "");
    const observationCount = Array.isArray(parsedPayload?.observations) ? parsedPayload.observations.length : 0;
    const questionCount = Array.isArray(parsedPayload?.questions) ? parsedPayload.questions.length : 0;
    const authorityDriftCount = countAuthorityDrift(parsedPayload?.authority_posture);

    const contractObedience = {
        json_parse_ok: !!parsedPayload,
        schema_ok: outputValidation.ok,
        no_extra_text: noExtraText,
        exact_response_type: parsedPayload?.response_type === "door_one_workbench_lm_response",
        required_non_claims_present: hasRequiredNonClaims(parsedPayload?.non_claims),
        correct_authority_posture: authorityDriftCount === 0,
        passed: false,
    };
    contractObedience.passed = Object.values(contractObedience).every((value, index) => index === 6 ? true : value === true);

    return {
        receipt_type: "lm:local_benchmark_receipt",
        receipt_version: "0.1.0",
        benchmark_id: benchmarkId,
        model_id: modelId,
        endpoint,
        threading_mode: "fresh_request",
        input_ref: {
            lm_input_path: inputPaths.lm_input_path,
            prompt_path: inputPaths.prompt_path,
        },
        run_ref: {
            run_dir: runDir,
            run_index: runIndex,
        },
        request_config: {
            temperature,
        },
        contract_obedience: contractObedience,
        repeatability_surface: {
            raw_output_hash: rawOutputHash,
            normalized_output_hash: normalizedOutputHash,
            observation_count: observationCount,
            question_count: questionCount,
        },
        usefulness: {
            observation_count: observationCount,
            question_count: questionCount,
            authority_drift_count: authorityDriftCount,
            empty_observation_count: countEmptyOrUselessObservations(parsedPayload?.observations),
            duplicate_question_count: countDuplicateStrings(parsedPayload?.questions),
        },
        response_ref: {
            raw_path: responsePaths.raw_path,
            parsed_path: responsePaths.parsed_path,
            validation_path: responsePaths.validation_path,
            benchmark_path: responsePaths.benchmark_path,
        },
        api_stats: apiStats ?? null,
    };
}

function buildBenchmarkSummary(receipts) {
    const passCount = receipts.filter((receipt) => receipt.contract_obedience.passed).length;
    const failCount = receipts.length - passCount;
    const normalizedHashes = new Set(receipts.map((receipt) => receipt.repeatability_surface.normalized_output_hash).filter(Boolean));
    const observationCounts = new Set(receipts.map((receipt) => receipt.repeatability_surface.observation_count));
    const questionCounts = new Set(receipts.map((receipt) => receipt.repeatability_surface.question_count));

    return {
        summary_type: "lm:local_benchmark_summary",
        summary_version: "0.1.0",
        run_count: receipts.length,
        pass_count: passCount,
        fail_count: failCount,
        unique_normalized_output_hashes: normalizedHashes.size,
        observation_count_stable: observationCounts.size <= 1,
        question_count_stable: questionCounts.size <= 1,
        threading_mode: "fresh_request",
    };
}

export async function invokeLocalLmChat({
    endpoint,
    model,
    prompt,
    temperature = 0,
    fetchImpl = fetch,
}) {
    const response = await fetchImpl(`${endpoint.replace(/\/$/, "")}/api/v1/chat`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model,
            input: prompt,
            temperature,
        }),
    });

    const raw = await response.text();
    if (!response.ok) {
        const error = new Error(`Local LM request failed: ${response.status} ${raw}`);
        error.code = "LOCAL_LM_REQUEST_FAILED";
        throw error;
    }
    return JSON.parse(raw);
}

export async function runLocalLmBenchmark({
    endpoint,
    model,
    lmInputPath,
    promptPath,
    resultsRoot,
    repeatCount = 3,
    temperature = 0,
    invokeFn = invokeLocalLmChat,
    now = new Date(),
}) {
    const inputReadback = await readAndValidateWorkbenchLmInput(lmInputPath);
    if (!inputReadback.validation.ok) {
        const error = new Error(`LM input failed validation: ${inputReadback.validation.errors.join("; ")}`);
        error.code = "INVALID_WORKBENCH_LM_INPUT";
        throw error;
    }
    const prompt = await readFile(promptPath, "utf8");

    const benchmarkRunId = makeRunId(now);
    const benchmarkDir = path.join(resultsRoot, benchmarkRunId);
    await mkdir(benchmarkDir, { recursive: true });

    const receipts = [];

    for (let index = 1; index <= repeatCount; index += 1) {
        const attemptDir = path.join(benchmarkDir, `attempt_${String(index).padStart(3, "0")}`);
        await mkdir(attemptDir, { recursive: true });

        const apiResponse = await invokeFn({
            endpoint,
            model,
            prompt,
            temperature,
        });

        const rawContent = Array.isArray(apiResponse?.output)
            ? apiResponse.output.map((entry) => entry?.content ?? "").join("\n")
            : "";
        const extraction = extractJsonObjectFromText(rawContent);
        let parsedPayload = null;
        let outputValidation = { ok: false, errors: ["no JSON object extracted"] };

        if (extraction.ok) {
            parsedPayload = JSON.parse(extraction.jsonText);
            outputValidation = await validateWorkbenchLmOutput(parsedPayload);
        }

        const noExtraText = extraction.ok
            ? extraction.leadingText.trim().length === 0 && extraction.trailingText.trim().length === 0
            : false;

        const rawPath = path.join(attemptDir, "raw.txt");
        const parsedPath = path.join(attemptDir, "parsed.json");
        const validationPath = path.join(attemptDir, "validation.json");
        const benchmarkPath = path.join(attemptDir, "benchmark.json");

        await writeFile(rawPath, `${rawContent}\n`, "utf8");
        await writeJson(parsedPath, parsedPayload ?? { parse_status: "failed", extraction });
        await writeJson(validationPath, {
            extraction,
            validation: outputValidation,
        });

        const receipt = buildBenchmarkReceipt({
            benchmarkId: benchmarkRunId,
            modelId: model,
            endpoint,
            inputPaths: {
                lm_input_path: lmInputPath,
                prompt_path: promptPath,
            },
            runDir: attemptDir,
            runIndex: index,
            temperature,
            rawContent,
            parsedPayload,
            outputValidation,
            noExtraText,
            responsePaths: {
                raw_path: rawPath,
                parsed_path: parsedPath,
                validation_path: validationPath,
                benchmark_path: benchmarkPath,
            },
            apiStats: apiResponse?.stats ?? null,
        });

        const receiptValidation = await validateLocalLmBenchmarkReceipt(receipt);
        if (!receiptValidation.ok) {
            const error = new Error(`Local LM benchmark receipt invalid: ${receiptValidation.errors.join("; ")}`);
            error.code = "INVALID_LOCAL_LM_BENCHMARK_RECEIPT";
            throw error;
        }

        await writeJson(benchmarkPath, receipt);
        receipts.push(receipt);
    }

    const summary = buildBenchmarkSummary(receipts);
    const summaryPath = path.join(benchmarkDir, "benchmark_summary.json");
    await writeJson(summaryPath, summary);

    return {
        benchmarkRunId,
        benchmarkDir,
        receipts,
        summary,
        summaryPath,
    };
}
