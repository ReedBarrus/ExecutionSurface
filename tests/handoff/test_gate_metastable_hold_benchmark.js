import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateGateDecision } from "../../runtime/schema/HandoffSchemaValidators.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const FIXTURE_PATH = path.join(ROOT, "fixtures/handoff/metastable_hold_benchmark_case.json");

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, detail = "") {
    if (condition) {
        console.log(`  ok ${label}`);
        passed += 1;
    } else {
        const message = `  not ok ${label}${detail ? ` - ${detail}` : ""}`;
        console.error(message);
        failures.push(message);
        failed += 1;
    }
}

function section(name) {
    console.log(`\n-- ${name} --`);
}

function makeDecision(candidate, { decision, stateTo, structuralGainJudgment }) {
    return {
        pass_id: "pass_benchmark_001",
        role: "auditor_gate",
        active_subject_id: candidate.active_subject.subject_id,
        structural_gain_judgment: structuralGainJudgment,
        decision,
        next_layer: "same",
        next_active_subject_id: candidate.active_subject.subject_id,
        reason: candidate.candidate_summary,
        state_transition: {
            from: candidate.active_subject.state,
            to: stateTo,
        },
        subject_register_update: {
            subject_id: candidate.active_subject.subject_id,
            state: stateTo,
            notes: "Benchmark fixture evaluation only.",
        },
    };
}

function evaluateDecision(candidate, decisionEnvelope) {
    const expected = candidate.expected_correct_decision;
    const explicitlyWrong = new Set(candidate.expected_incorrect_decisions.map((entry) => entry.decision));

    return {
        isSchemaValid: true,
        isCorrectDecision: decisionEnvelope.decision === expected.decision,
        hasCorrectState: decisionEnvelope.state_transition.to === expected.state_to,
        hasCorrectJudgment: decisionEnvelope.structural_gain_judgment === expected.structural_gain_judgment,
        isExplicitlyWrong: explicitlyWrong.has(decisionEnvelope.decision),
    };
}

section("A. Fixture shape");
const candidate = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
assert("A1: benchmark case id present", typeof candidate.benchmark_case_id === "string" && candidate.benchmark_case_id.length > 0);
assert("A2: candidate summary present", typeof candidate.candidate_summary === "string" && candidate.candidate_summary.length > 0);
assert("A3: expected correct decision is hold", candidate.expected_correct_decision.decision === "hold");
assert("A4: expected incorrect decisions include release", candidate.expected_incorrect_decisions.some((entry) => entry.decision === "release"));
assert("A5: expected incorrect decisions include compress_upward", candidate.expected_incorrect_decisions.some((entry) => entry.decision === "compress_upward"));

section("B. Correct hold posture");
const holdDecision = makeDecision(candidate, {
    decision: "hold",
    stateTo: "metastable_hold",
    structuralGainJudgment: "metastable_hold",
});
const holdValidation = await validateGateDecision(holdDecision);
const holdEvaluation = evaluateDecision(candidate, holdDecision);
assert("B1: hold gate envelope validates", holdValidation.ok, holdValidation.errors.join("; "));
assert("B2: hold is the correct decision", holdEvaluation.isCorrectDecision);
assert("B3: hold uses the correct state target", holdEvaluation.hasCorrectState);
assert("B4: hold uses the correct structural gain judgment", holdEvaluation.hasCorrectJudgment);
assert("B5: hold is not marked explicitly wrong", !holdEvaluation.isExplicitlyWrong);

section("C. Release is wrong");
const releaseDecision = makeDecision(candidate, {
    decision: "release",
    stateTo: "released",
    structuralGainJudgment: "released",
});
const releaseValidation = await validateGateDecision(releaseDecision);
const releaseEvaluation = evaluateDecision(candidate, releaseDecision);
assert("C1: release gate envelope still validates structurally", releaseValidation.ok, releaseValidation.errors.join("; "));
assert("C2: release is not the correct decision", !releaseEvaluation.isCorrectDecision);
assert("C3: release is explicitly wrong for this fixture", releaseEvaluation.isExplicitlyWrong);
assert("C4: release does not carry the expected hold state", !releaseEvaluation.hasCorrectState);

section("D. Compress-up is wrong");
const compressDecision = makeDecision(candidate, {
    decision: "compress_upward",
    stateTo: "compressed",
    structuralGainJudgment: "compressed",
});
const compressValidation = await validateGateDecision(compressDecision);
const compressEvaluation = evaluateDecision(candidate, compressDecision);
assert("D1: compress-up gate envelope validates structurally", compressValidation.ok, compressValidation.errors.join("; "));
assert("D2: compress-up is not the correct decision", !compressEvaluation.isCorrectDecision);
assert("D3: compress-up is explicitly wrong for this fixture", compressEvaluation.isExplicitlyWrong);
assert("D4: compress-up does not carry the expected hold state", !compressEvaluation.hasCorrectState);

console.log(`\n${passed} passed   ${failed} failed`);
if (failures.length > 0) {
    console.log("\nFailed:");
    for (const failure of failures) console.log(failure);
    process.exit(1);
}
