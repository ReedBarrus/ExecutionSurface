import { runLocalLmBenchmark } from "../runtime/lm/LocalLmBenchmark.js";

const ENDPOINT = process.env.LM_STUDIO_ENDPOINT ?? "http://10.2.0.2:1234";
const MODEL = process.env.LM_STUDIO_MODEL ?? "meta-llama-3.1-8b-instruct";
const REPEAT_COUNT = Number.parseInt(process.env.LM_BENCH_REPEAT_COUNT ?? "3", 10);
const TEMPERATURE = Number.parseFloat(process.env.LM_BENCH_TEMPERATURE ?? "0");

async function main() {
    const result = await runLocalLmBenchmark({
        endpoint: ENDPOINT,
        model: MODEL,
        lmInputPath: "./out_lm/lm_input.json",
        promptPath: "./out_lm/lm_prompt.txt",
        resultsRoot: "./benchmarks/results",
        repeatCount: Number.isFinite(REPEAT_COUNT) ? REPEAT_COUNT : 3,
        temperature: Number.isFinite(TEMPERATURE) ? TEMPERATURE : 0,
    });

    console.log("Local LM benchmark completed.");
    console.log(`  benchmark_run_id: ${result.benchmarkRunId}`);
    console.log(`  results_dir: ${result.benchmarkDir}`);
    console.log(`  pass_count: ${result.summary.pass_count}`);
    console.log(`  fail_count: ${result.summary.fail_count}`);
    console.log(`  unique_normalized_output_hashes: ${result.summary.unique_normalized_output_hashes}`);
    console.log(`  observation_count_stable: ${result.summary.observation_count_stable}`);
    console.log(`  question_count_stable: ${result.summary.question_count_stable}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
