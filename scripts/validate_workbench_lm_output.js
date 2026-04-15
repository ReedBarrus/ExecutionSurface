import { readAndValidateWorkbenchLmOutput } from "../runtime/lm/WorkbenchLmWrapper.js";

async function main() {
    const { payload, validation } = await readAndValidateWorkbenchLmOutput("./out_lm/lm_output.json");

    if (!validation.ok) {
        console.error("LM output validation failed:");
        console.error(validation.errors.join("\n"));
        process.exit(1);
    }

    console.log("LM output validates.");
    console.log(`  response_type: ${payload.response_type}`);
    console.log(`  input_stream_id: ${payload.input_stream_id ?? "-"}`);
    console.log(`  observations: ${payload.observations.length}`);
    console.log(`  questions: ${payload.questions.length}`);
    console.log(`  non_claims: ${payload.non_claims.length}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
