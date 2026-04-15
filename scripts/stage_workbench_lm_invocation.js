import { stageWorkbenchLmInvocation } from "../runtime/lm/WorkbenchLmWrapper.js";

async function main() {
    const staged = await stageWorkbenchLmInvocation({
        workbenchPath: "./out_workbench/workbench.json",
        outputDir: "./out_lm",
    });

    console.log("Workbench LM invocation staged.");
    console.log(`  read: ./out_workbench/workbench.json`);
    console.log(`  wrote: ${staged.paths.lm_input}`);
    console.log(`  wrote: ${staged.paths.lm_prompt}`);
    console.log(`  wrote: ${staged.paths.lm_wrapper_contract}`);
    console.log(`  wrote: ${staged.paths.lm_output_template}`);
    console.log(`  expected manual output: ${staged.paths.lm_output}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
