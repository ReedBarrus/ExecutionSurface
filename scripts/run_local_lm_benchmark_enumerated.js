import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { stageWorkbenchLmInvocation } from "../runtime/lm/WorkbenchLmWrapper.js";
import { runLocalLmBenchmark } from "../runtime/lm/LocalLmBenchmark.js";

const ENDPOINT = process.env.LM_STUDIO_ENDPOINT ?? "http://10.2.0.2:1234";
const MODEL = process.env.LM_STUDIO_MODEL ?? "meta-llama-3.1-8b-instruct";
const REPEAT_COUNT = Number.parseInt(process.env.LM_BENCH_REPEAT_COUNT ?? "3", 10);
const TEMPERATURE = Number.parseFloat(process.env.LM_BENCH_TEMPERATURE ?? "0");
const WORKBENCH_ROOT = process.env.WORKBENCH_ROOT ?? "./out_workbench";
const STAGED_ROOT = process.env.LM_STAGED_ROOT ?? "./out_lm";
const RESULTS_ROOT = process.env.LM_BENCH_RESULTS_ROOT ?? "./benchmarks/results";
const CASE_FILTER = new Set(
    `${process.env.WORKBENCH_CASES ?? ""}`
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
);

async function exists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

function stableStringify(value) {
    return JSON.stringify(value, null, 2);
}

async function writeJson(filePath, value) {
    await writeFile(filePath, `${stableStringify(value)}\n`, "utf8");
}

async function enumerateWorkbenchBundles(workbenchRoot) {
    const bundles = [];
    const legacyWorkbenchPath = path.join(workbenchRoot, "workbench.json");

    if (await exists(legacyWorkbenchPath)) {
        bundles.push({
            case_name: "default",
            workbench_path: legacyWorkbenchPath,
        });
    }

    const entries = await readdir(workbenchRoot, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const workbenchPath = path.join(workbenchRoot, entry.name, "workbench.json");
        if (!(await exists(workbenchPath))) continue;
        bundles.push({
            case_name: entry.name,
            workbench_path: workbenchPath,
        });
    }

    bundles.sort((a, b) => a.case_name.localeCompare(b.case_name));
    return bundles;
}

async function main() {
    await mkdir(STAGED_ROOT, { recursive: true });
    await mkdir(RESULTS_ROOT, { recursive: true });

    const discoveredBundles = await enumerateWorkbenchBundles(WORKBENCH_ROOT);
    const selectedBundles = discoveredBundles.filter((bundle) => CASE_FILTER.size === 0 || CASE_FILTER.has(bundle.case_name));

    if (selectedBundles.length === 0) {
        throw new Error(`No workbench bundles found under ${WORKBENCH_ROOT}${CASE_FILTER.size > 0 ? ` for cases: ${Array.from(CASE_FILTER).join(", ")}` : ""}`);
    }

    const aggregate = [];

    for (const bundle of selectedBundles) {
        const stageDir = path.join(STAGED_ROOT, bundle.case_name);
        const caseResultsRoot = path.join(RESULTS_ROOT, bundle.case_name);

        const staged = await stageWorkbenchLmInvocation({
            workbenchPath: bundle.workbench_path,
            outputDir: stageDir,
        });

        const result = await runLocalLmBenchmark({
            endpoint: ENDPOINT,
            model: MODEL,
            lmInputPath: staged.paths.lm_input,
            promptPath: staged.paths.lm_prompt,
            resultsRoot: caseResultsRoot,
            repeatCount: Number.isFinite(REPEAT_COUNT) ? REPEAT_COUNT : 3,
            temperature: Number.isFinite(TEMPERATURE) ? TEMPERATURE : 0,
        });

        aggregate.push({
            case_name: bundle.case_name,
            workbench_path: bundle.workbench_path,
            staged_dir: stageDir,
            benchmark_run_id: result.benchmarkRunId,
            benchmark_dir: result.benchmarkDir,
            summary: result.summary,
        });

        console.log(`[${bundle.case_name}] benchmark completed.`);
        console.log(`  workbench: ${bundle.workbench_path}`);
        console.log(`  staged_dir: ${stageDir}`);
        console.log(`  benchmark_run_id: ${result.benchmarkRunId}`);
        console.log(`  benchmark_dir: ${result.benchmarkDir}`);
        console.log(`  pass_count: ${result.summary.pass_count}`);
        console.log(`  fail_count: ${result.summary.fail_count}`);
        console.log(`  unique_normalized_output_hashes: ${result.summary.unique_normalized_output_hashes}`);
        console.log(`  observation_count_stable: ${result.summary.observation_count_stable}`);
        console.log(`  question_count_stable: ${result.summary.question_count_stable}`);
    }

    const aggregateSummary = {
        summary_type: "lm:enumerated_local_benchmark_summary",
        summary_version: "0.1.0",
        endpoint: ENDPOINT,
        model: MODEL,
        workbench_root: WORKBENCH_ROOT,
        staged_root: STAGED_ROOT,
        results_root: RESULTS_ROOT,
        case_count: aggregate.length,
        cases: aggregate,
    };

    const summaryPath = path.join(RESULTS_ROOT, "enumerated_benchmark_summary.json");
    await writeJson(summaryPath, aggregateSummary);

    console.log("Enumerated local LM benchmark completed.");
    console.log(`  case_count: ${aggregate.length}`);
    console.log(`  aggregate_summary: ${summaryPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
