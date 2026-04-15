import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    TinyFilesystemRunner,
    TinyFilesystemRunnerError,
} from "../../runtime/handoff/TinyFilesystemRunner.js";

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

async function withRuntime(label, fn) {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), `dme-tiny-runner-${label}-`));
    try {
        const runner = await TinyFilesystemRunner.initializeRuntime({
            rootDir,
            activeSubject: {
                subject_id: "commit_boundary_law",
                title: "Commit Boundary Law",
                layer: "L1",
                state: "seeded",
                live_surface_path: "subjects/active_subject.md",
                section_anchor: "Commit Boundary Law",
                forbidden_write_zones: ["Outside Scope"],
                admin_note: "Do not widen beyond the active section.",
            },
            subjectRegisterEntry: {
                subject_id: "commit_boundary_law",
                title: "Commit Boundary Law",
                layer: "L1",
                state: "seeded",
                parent_subject_id: null,
                eligible_next_subjects: ["contract_shape_for_commit"],
                release_criteria: ["explicit boundary", "explicit non-claims"],
                known_tensions: ["merge relation to commit timing"],
                last_role: "admin_router",
                recommended_next_role: "constructor",
                notes: "Tiny runner fixture.",
            },
            liveSurfaceText: [
                "# Runtime Surface",
                "",
                "## Commit Boundary Law",
                "Initial bounded seed.",
                "",
                "## Outside Scope",
                "Leave this untouched.",
                "",
            ].join("\n"),
        });
        await fn({ rootDir, runner });
    } finally {
        await rm(rootDir, { recursive: true, force: true });
    }
}

async function expectRunnerError(label, work, expectedCode) {
    try {
        await work();
        assert(label, false, `expected ${expectedCode}`);
    } catch (error) {
        assert(label, error instanceof TinyFilesystemRunnerError && error.code === expectedCode, `${error?.code ?? error}`);
    }
}

function makeConstructorResponse(request, overrides = {}) {
    return {
        pass_id: request.pass_id,
        role: "constructor",
        active_subject_id: request.active_subject_id,
        state_before: "seeded",
        state_after: "tension_held",
        mutated_live_surface: true,
        live_surface_patch: {
            mode: "replace_section",
            live_surface_path: "subjects/active_subject.md",
            section_anchor: "Commit Boundary Law",
            new_text: "Constructor established the bounded contract surface.",
        },
        accepted_changes: ["Added first bounded contract wording."],
        rejected_changes: ["Did not widen to downstream query posture."],
        live_tensions: ["Whether boundary wording should tighten further."],
        write_payload_notes: ["Reflector should compress phrasing before gate review."],
        cycle_log_entry: {
            pass_id: request.pass_id,
            role: "constructor",
            active_subject_id: request.active_subject_id,
            state_before: "seeded",
            state_after: "tension_held",
            accepted_changes: ["Added first bounded contract wording."],
            rejected_changes: ["Did not widen to downstream query posture."],
            live_tensions: ["Whether boundary wording should tighten further."],
            recommended_next_role: "reflector",
        },
        recommended_next_role: "reflector",
        recommended_next_state: "tension_held",
        ...overrides,
    };
}

function makeReflectorResponse(request, overrides = {}) {
    return {
        pass_id: request.pass_id,
        role: "reflector",
        active_subject_id: request.active_subject_id,
        state_before: "tension_held",
        state_after: "gate_pending",
        mutated_live_surface: true,
        live_surface_patch: {
            mode: "replace_section",
            live_surface_path: "subjects/active_subject.md",
            section_anchor: "Commit Boundary Law",
            new_text: "Reflector tightened the contract and prepared it for gate review.",
        },
        accepted_changes: ["Compressed the subject wording toward gate readiness."],
        rejected_changes: ["Did not add new architectural layers."],
        live_tensions: ["Whether the current layer should hold or release."],
        write_payload_notes: ["Gate should judge structural gain only."],
        cycle_log_entry: {
            pass_id: request.pass_id,
            role: "reflector",
            active_subject_id: request.active_subject_id,
            state_before: "tension_held",
            state_after: "gate_pending",
            accepted_changes: ["Compressed the subject wording toward gate readiness."],
            rejected_changes: ["Did not add new architectural layers."],
            live_tensions: ["Whether the current layer should hold or release."],
            recommended_next_role: "auditor_gate",
        },
        recommended_next_role: "auditor_gate",
        recommended_next_state: "gate_pending",
        ...overrides,
    };
}

function makeGateDecision(request, overrides = {}) {
    return {
        pass_id: request.pass_id,
        role: "auditor_gate",
        active_subject_id: request.active_subject_id,
        structural_gain_judgment: "metastable_hold",
        decision: "hold",
        next_layer: "same",
        next_active_subject_id: request.active_subject_id,
        reason: "Further descent would buy wording more than control.",
        state_transition: {
            from: "gate_pending",
            to: "metastable_hold",
        },
        subject_register_update: {
            subject_id: request.active_subject_id,
            state: "metastable_hold",
            notes: "Held at the current layer.",
        },
        ...overrides,
    };
}

async function runHappyPathCycle({ rootDir, runner, labels }) {
    const dispatchOne = await runner.dispatchNextPass();
    const requestOne = await runner.readAndValidatePassRequest();
    assert(`${labels.prefix} constructor request dispatched`, dispatchOne.request.role === "constructor");
    assert(`${labels.prefix} constructor request validates on read`, requestOne.role === "constructor" && requestOne.state_before === "seeded");

    const constructorResponse = makeConstructorResponse(requestOne);
    await runner.writeRoleResponse(constructorResponse);
    const constructorResponsePath = path.join(rootDir, "inbox", "constructor_response.json");
    const constructorReadback = await runner.readAndValidateRoleResponse(constructorResponsePath);
    assert(`${labels.prefix} constructor response validates on read`, constructorReadback.pass_id === requestOne.pass_id);
    await runner.consumeExpectedResponse();

    const checkpointAfterConstructor = await runner.readCheckpoint();
    const registerAfterConstructor = await runner.readSubjectRegister();
    assert(`${labels.prefix} constructor moved checkpoint to reflector`, checkpointAfterConstructor.expected_role === "reflector");
    assert(`${labels.prefix} constructor updated subject register state`, registerAfterConstructor[0].state === "tension_held");

    const dispatchTwo = await runner.dispatchNextPass();
    const requestTwo = await runner.readAndValidatePassRequest();
    assert(`${labels.prefix} reflector request dispatched`, dispatchTwo.request.role === "reflector");
    assert(`${labels.prefix} reflector request validates on read`, requestTwo.role === "reflector" && requestTwo.state_before === "tension_held");

    const reflectorResponse = makeReflectorResponse(requestTwo);
    await runner.writeRoleResponse(reflectorResponse);
    const reflectorResponsePath = path.join(rootDir, "inbox", "reflector_response.json");
    const reflectorReadback = await runner.readAndValidateRoleResponse(reflectorResponsePath);
    assert(`${labels.prefix} reflector response validates on read`, reflectorReadback.pass_id === requestTwo.pass_id);
    await runner.consumeExpectedResponse();

    const checkpointAfterReflector = await runner.readCheckpoint();
    assert(`${labels.prefix} reflector moved checkpoint to auditor_gate`, checkpointAfterReflector.expected_role === "auditor_gate");

    const dispatchThree = await runner.dispatchNextPass();
    const requestThree = await runner.readAndValidatePassRequest();
    assert(`${labels.prefix} gate request dispatched`, dispatchThree.request.role === "auditor_gate");
    assert(`${labels.prefix} gate request validates on read`, requestThree.role === "auditor_gate" && requestThree.state_before === "gate_pending");

    const gateDecision = makeGateDecision(requestThree);
    await runner.writeGateDecision(gateDecision);
    const gateDecisionPath = path.join(rootDir, "inbox", "auditor_gate_decision.json");
    const gateReadback = await runner.readAndValidateGateDecision(gateDecisionPath);
    assert(`${labels.prefix} gate decision validates on read`, gateReadback.pass_id === requestThree.pass_id);
    await runner.consumeExpectedResponse();

    const checkpoint = await runner.readCheckpoint();
    const register = await runner.readSubjectRegister();
    const cycleLog = await readFile(path.join(rootDir, "active/cycle_log.jsonl"), "utf8");
    const surface = await readFile(path.join(rootDir, "subjects/active_subject.md"), "utf8");
    const cycleEntries = cycleLog.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));

    assert(`${labels.prefix} runner completes after gate decision`, checkpoint.runner_status === "completed");
    assert(`${labels.prefix} subject register updated on gate state change`, register[0].state === "metastable_hold" && register[0].last_role === "auditor_gate");
    assert(`${labels.prefix} cycle log appended three entries`, cycleEntries.length === 3);
    assert(`${labels.prefix} live surface reflects final bounded text`, surface.includes("Reflector tightened the contract") && surface.includes("Leave this untouched."));

    return {
        requests: [requestOne, requestTwo, requestThree],
        responses: [constructorResponse, reflectorResponse, gateDecision],
        cycleEntries,
        checkpoint: {
            runner_status: checkpoint.runner_status,
            current_state: checkpoint.current_state,
            expected_role: checkpoint.expected_role,
            pass_index: checkpoint.pass_index,
            last_pass_id: checkpoint.last_pass_id,
        },
        register,
        surface,
    };
}

section("A. Happy path loop");
await withRuntime("happy", async ({ rootDir, runner }) => {
    await runHappyPathCycle({
        rootDir,
        runner,
        labels: {
            prefix: "A",
        },
    });
});

section("B. Repeated happy-path cycles stay deterministic");
const repeatedSnapshots = [];
for (let index = 0; index < 3; index += 1) {
    await withRuntime(`repeat-${index + 1}`, async ({ rootDir, runner }) => {
        const snapshot = await runHappyPathCycle({
            rootDir,
            runner,
            labels: {
                prefix: `B${index + 1}`,
            },
        });
        repeatedSnapshots.push(snapshot);
    });
}
assert("B4: repeated run request payloads are identical", JSON.stringify(repeatedSnapshots[0].requests) === JSON.stringify(repeatedSnapshots[1].requests) && JSON.stringify(repeatedSnapshots[1].requests) === JSON.stringify(repeatedSnapshots[2].requests));
assert("B5: repeated run response payloads are identical", JSON.stringify(repeatedSnapshots[0].responses) === JSON.stringify(repeatedSnapshots[1].responses) && JSON.stringify(repeatedSnapshots[1].responses) === JSON.stringify(repeatedSnapshots[2].responses));
assert("B6: repeated run cycle logs are identical", JSON.stringify(repeatedSnapshots[0].cycleEntries) === JSON.stringify(repeatedSnapshots[1].cycleEntries) && JSON.stringify(repeatedSnapshots[1].cycleEntries) === JSON.stringify(repeatedSnapshots[2].cycleEntries));
assert("B7: repeated run checkpoints are identical", JSON.stringify(repeatedSnapshots[0].checkpoint) === JSON.stringify(repeatedSnapshots[1].checkpoint) && JSON.stringify(repeatedSnapshots[1].checkpoint) === JSON.stringify(repeatedSnapshots[2].checkpoint));
assert("B8: repeated run subject registers are identical", JSON.stringify(repeatedSnapshots[0].register) === JSON.stringify(repeatedSnapshots[1].register) && JSON.stringify(repeatedSnapshots[1].register) === JSON.stringify(repeatedSnapshots[2].register));
assert("B9: repeated run live surfaces are identical", repeatedSnapshots[0].surface === repeatedSnapshots[1].surface && repeatedSnapshots[1].surface === repeatedSnapshots[2].surface);

section("C. Invalid response schema stops on write");
await withRuntime("schema-stop", async ({ runner }) => {
    const dispatch = await runner.dispatchNextPass();
    await expectRunnerError(
        "C1: missing required response field halts runner",
        async () => runner.writeRoleResponse({
            pass_id: dispatch.request.pass_id,
            role: "constructor",
            active_subject_id: dispatch.request.active_subject_id,
            state_before: "seeded",
            state_after: "tension_held",
            mutated_live_surface: false,
            live_surface_patch: null,
            accepted_changes: [],
            rejected_changes: [],
            live_tensions: [],
            write_payload_notes: [],
            cycle_log_entry: {
                pass_id: dispatch.request.pass_id,
                role: "constructor",
                active_subject_id: dispatch.request.active_subject_id,
                state_before: "seeded",
                state_after: "tension_held",
                accepted_changes: [],
                rejected_changes: [],
                live_tensions: [],
                recommended_next_role: "reflector",
            },
            recommended_next_role: "reflector",
        }),
        "INVALID_RESPONSE_SCHEMA"
    );
    const checkpoint = await runner.readCheckpoint();
    assert("C2: checkpoint recorded halted state", checkpoint.runner_status === "halted");
});

section("D. Illegal state transition halts on consume");
await withRuntime("illegal-transition", async ({ runner }) => {
    const dispatch = await runner.dispatchNextPass();
    await runner.writeRoleResponse(makeConstructorResponse(dispatch.request, {
        state_after: "released",
        mutated_live_surface: false,
        live_surface_patch: null,
        accepted_changes: ["Tried to skip the reflector and gate."],
        rejected_changes: [],
        live_tensions: [],
        write_payload_notes: [],
        cycle_log_entry: {
            pass_id: dispatch.request.pass_id,
            role: "constructor",
            active_subject_id: dispatch.request.active_subject_id,
            state_before: "seeded",
            state_after: "released",
            accepted_changes: ["Tried to skip the reflector and gate."],
            rejected_changes: [],
            live_tensions: [],
            recommended_next_role: "admin_router",
        },
        recommended_next_role: "admin_router",
        recommended_next_state: "released",
    }));
    await expectRunnerError(
        "D1: illegal transition is rejected",
        async () => runner.consumeExpectedResponse(),
        "ILLEGAL_STATE_TRANSITION"
    );
});

section("E. Wrong section anchor halts on consume");
await withRuntime("wrong-anchor", async ({ runner }) => {
    const dispatch = await runner.dispatchNextPass();
    await runner.writeRoleResponse(makeConstructorResponse(dispatch.request, {
        live_surface_patch: {
            mode: "replace_section",
            live_surface_path: "subjects/active_subject.md",
            section_anchor: "Outside Scope",
            new_text: "Illegal anchor write.",
        },
    }));
    await expectRunnerError(
        "E1: wrong section anchor is rejected",
        async () => runner.consumeExpectedResponse(),
        "FORBIDDEN_WRITE_ZONE"
    );
});

section("F. Subject mismatch halts on consume");
await withRuntime("subject-mismatch", async ({ runner }) => {
    const dispatch = await runner.dispatchNextPass();
    await runner.writeRoleResponse(makeConstructorResponse(dispatch.request, {
        active_subject_id: "wrong_subject",
        cycle_log_entry: {
            pass_id: dispatch.request.pass_id,
            role: "constructor",
            active_subject_id: "wrong_subject",
            state_before: "seeded",
            state_after: "tension_held",
            accepted_changes: ["Wrong subject id supplied."],
            rejected_changes: [],
            live_tensions: [],
            recommended_next_role: "reflector",
        },
    }));
    await expectRunnerError(
        "F1: subject mismatch is rejected",
        async () => runner.consumeExpectedResponse(),
        "SUBJECT_MISMATCH"
    );
});

section("G. Malformed gate decision halts on write");
await withRuntime("malformed-gate-clean", async ({ runner }) => {
    const dispatchOne = await runner.dispatchNextPass();
    await runner.writeRoleResponse(makeConstructorResponse(dispatchOne.request));
    await runner.consumeExpectedResponse();
    const dispatchTwo = await runner.dispatchNextPass();
    await runner.writeRoleResponse(makeReflectorResponse(dispatchTwo.request));
    await runner.consumeExpectedResponse();
    const dispatchThree = await runner.dispatchNextPass();
    await expectRunnerError(
        "G1: malformed gate decision is rejected on write",
        async () => runner.writeGateDecision({
            pass_id: dispatchThree.request.pass_id,
            role: "auditor_gate",
            active_subject_id: dispatchThree.request.active_subject_id,
            structural_gain_judgment: "metastable_hold",
            decision: "hold",
            next_layer: "same",
            next_active_subject_id: dispatchThree.request.active_subject_id,
            state_transition: {
                from: "gate_pending",
                to: "metastable_hold",
            },
        }),
        "INVALID_GATE_SCHEMA"
    );
});

section("H. Forbidden write target halts on consume");
await withRuntime("forbidden-write", async ({ runner }) => {
    const dispatch = await runner.dispatchNextPass();
    await runner.writeRoleResponse(makeConstructorResponse(dispatch.request, {
        live_surface_patch: {
            mode: "replace_section",
            live_surface_path: "subjects/other_subject.md",
            section_anchor: "Commit Boundary Law",
            new_text: "Illegal cross-zone write.",
        },
        accepted_changes: ["Tried to write to the wrong surface."],
        cycle_log_entry: {
            pass_id: dispatch.request.pass_id,
            role: "constructor",
            active_subject_id: dispatch.request.active_subject_id,
            state_before: "seeded",
            state_after: "tension_held",
            accepted_changes: ["Tried to write to the wrong surface."],
            rejected_changes: [],
            live_tensions: [],
            recommended_next_role: "reflector",
        },
    }));
    await expectRunnerError(
        "H1: forbidden write target is rejected",
        async () => runner.consumeExpectedResponse(),
        "FORBIDDEN_WRITE_ZONE"
    );
});

section("I. Interrupt and resume");
await withRuntime("interrupt", async ({ runner }) => {
    await runner.interrupt("manual checkpoint");
    await expectRunnerError(
        "I1: interrupt blocks dispatch",
        async () => runner.dispatchNextPass(),
        "RUNNER_INTERRUPTED"
    );
    await runner.resume();
    const dispatch = await runner.dispatchNextPass();
    assert("I2: resume restores dispatchability", dispatch.request.role === "constructor");
});

console.log(`\n${passed} passed   ${failed} failed`);
if (failures.length > 0) {
    console.log("\nFailed:");
    for (const failure of failures) console.log(failure);
    process.exit(1);
}
