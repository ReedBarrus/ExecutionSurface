import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
    validateCycleLogEntry,
    validateGateDecision,
    validatePassRequest,
    validateRoleResponse,
    validateSubjectRegisterEntry,
} from "../schema/HandoffSchemaValidators.js";

const STATE_VOCAB = new Set([
    "seeded",
    "tension_held",
    "compressed",
    "gate_pending",
    "released",
    "hold",
    "metastable_hold",
    "deferred",
    "downgraded",
    "rebound",
    "archived",
]);

const TERMINAL_STATES = new Set(["released", "metastable_hold", "deferred", "downgraded", "archived", "hold"]);

const NEXT_ROLE_BY_STATE = {
    seeded: "constructor",
    rebound: "constructor",
    tension_held: "reflector",
    compressed: "reflector",
    gate_pending: "auditor_gate",
};

const ROLE_PERMISSIONS = {
    constructor: {
        mayMutate: true,
        allowedStateTransitions: {
            seeded: ["tension_held", "compressed", "gate_pending"],
            rebound: ["tension_held", "compressed", "gate_pending"],
        },
    },
    reflector: {
        mayMutate: true,
        allowedStateTransitions: {
            tension_held: ["tension_held", "compressed", "gate_pending"],
            compressed: ["compressed", "gate_pending"],
        },
    },
    creative: {
        mayMutate: false,
        allowedStateTransitions: {
            tension_held: ["tension_held", "gate_pending"],
            compressed: ["compressed", "gate_pending"],
        },
    },
    auditor_gate: {
        mayMutate: false,
        allowedStateTransitions: {
            gate_pending: ["released", "metastable_hold", "deferred", "rebound", "compressed", "hold"],
        },
    },
};

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(value) {
    return JSON.stringify(value, null, 2);
}

function uniqueStrings(values) {
    return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value.length > 0))];
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function defaultPurposeForRole(role) {
    switch (role) {
        case "constructor":
            return "Write the first bounded subject-surface draft inside the allowed section only.";
        case "reflector":
            return "Tighten the active section without widening scope and prepare a gate-ready surface.";
        case "auditor_gate":
            return "Judge structural gain and emit a bounded gate decision over the current subject.";
        default:
            return "Execute one bounded role pass over the active subject.";
    }
}

function defaultRequiredKeysForRole(role) {
    if (role === "auditor_gate") {
        return [
            "structural_gain_judgment",
            "decision",
            "next_layer",
            "next_active_subject_id",
            "reason",
            "state_transition",
        ];
    }
    return [
        "state_after",
        "mutated_live_surface",
        "accepted_changes",
        "rejected_changes",
        "live_tensions",
        "write_payload_notes",
        "cycle_log_entry",
        "recommended_next_role",
        "recommended_next_state",
    ];
}

function inferNextRole(stateAfter) {
    if (TERMINAL_STATES.has(stateAfter)) return "admin_router";
    return NEXT_ROLE_BY_STATE[stateAfter] ?? null;
}

async function ensureDir(dirPath) {
    await mkdir(dirPath, { recursive: true });
}

async function readJson(filePath) {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
}

async function writeJson(filePath, value) {
    await writeFile(filePath, `${stableStringify(value)}\n`, "utf8");
}

async function pathExists(targetPath) {
    try {
        await stat(targetPath);
        return true;
    } catch {
        return false;
    }
}

function resolveWithinRoot(rootDir, relativePath) {
    const resolved = path.resolve(rootDir, relativePath);
    const relative = path.relative(rootDir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return null;
    }
    return resolved;
}

function replaceMarkdownSection(surfaceText, anchor, newText) {
    const headingRegex = new RegExp(`^(#{1,6})\\s+${escapeRegex(anchor)}\\s*$`, "m");
    const match = headingRegex.exec(surfaceText);
    if (!match) {
        return {
            ok: false,
            error: `section anchor not found: ${anchor}`,
        };
    }

    const headingLevel = match[1].length;
    const headingLineBreakIndex = surfaceText.indexOf("\n", match.index);
    const bodyStart = headingLineBreakIndex === -1 ? surfaceText.length : headingLineBreakIndex + 1;
    const remainder = surfaceText.slice(bodyStart);
    const nextHeadingRegex = new RegExp(`^#{1,${headingLevel}}\\s+`, "m");
    const nextHeadingMatch = nextHeadingRegex.exec(remainder);
    const sectionEnd = nextHeadingMatch ? bodyStart + nextHeadingMatch.index : surfaceText.length;
    const nextBody = `${newText.replace(/\s+$/, "")}\n`;

    return {
        ok: true,
        updatedText: `${surfaceText.slice(0, bodyStart)}${nextBody}${surfaceText.slice(sectionEnd)}`,
    };
}

export class TinyFilesystemRunnerError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "TinyFilesystemRunnerError";
        this.code = code;
    }
}

export class TinyFilesystemRunner {
    constructor({ rootDir }) {
        this.rootDir = path.resolve(rootDir);
        this.activeDir = path.join(this.rootDir, "active");
        this.inboxDir = path.join(this.rootDir, "inbox");
        this.outboxDir = path.join(this.rootDir, "outbox");
        this.activeSubjectPath = path.join(this.activeDir, "active_subject.json");
        this.subjectRegisterPath = path.join(this.activeDir, "subject_register.json");
        this.cycleLogPath = path.join(this.activeDir, "cycle_log.jsonl");
        this.checkpointPath = path.join(this.activeDir, "checkpoint.json");
    }

    static async initializeRuntime({
        rootDir,
        activeSubject,
        subjectRegisterEntry,
        liveSurfaceText,
    }) {
        const runner = new TinyFilesystemRunner({ rootDir });
        await ensureDir(runner.activeDir);
        await ensureDir(runner.inboxDir);
        await ensureDir(runner.outboxDir);

        await runner.#validateActiveSubject(activeSubject);
        await runner.#validateRegisterEntry(subjectRegisterEntry);

        const surfacePath = resolveWithinRoot(runner.rootDir, activeSubject.live_surface_path);
        if (!surfacePath) {
            throw new TinyFilesystemRunnerError(
                "FORBIDDEN_WRITE_ZONE",
                `live surface path escapes runtime root: ${activeSubject.live_surface_path}`
            );
        }
        await ensureDir(path.dirname(surfacePath));

        await writeJson(runner.activeSubjectPath, activeSubject);
        await writeJson(runner.subjectRegisterPath, [subjectRegisterEntry]);
        await writeFile(runner.cycleLogPath, "", "utf8");
        await writeJson(runner.checkpointPath, {
            runner_status: "ready",
            active_subject_id: activeSubject.subject_id,
            current_state: activeSubject.state,
            expected_role: inferNextRole(activeSubject.state),
            pass_index: 0,
            last_pass_id: null,
            last_written_request_path: null,
            last_written_response_path: null,
            last_consumed_response_path: null,
            halt_reason: null,
        });
        await writeFile(surfacePath, liveSurfaceText, "utf8");
        return runner;
    }

    async readActiveSubject() {
        return readJson(this.activeSubjectPath);
    }

    async readCheckpoint() {
        return readJson(this.checkpointPath);
    }

    async readSubjectRegister() {
        return readJson(this.subjectRegisterPath);
    }

    async readAndValidatePassRequest(filePath = path.join(this.outboxDir, "current_request.json")) {
        const payload = await readJson(filePath);
        const validation = await validatePassRequest(payload);
        if (!validation.ok) {
            throw new TinyFilesystemRunnerError("INVALID_REQUEST_SCHEMA", validation.errors.join("; "));
        }
        return payload;
    }

    async readAndValidateRoleResponse(filePath) {
        const payload = await readJson(filePath);
        const validation = await validateRoleResponse(payload);
        if (!validation.ok) {
            throw new TinyFilesystemRunnerError("INVALID_RESPONSE_SCHEMA", validation.errors.join("; "));
        }
        return payload;
    }

    async readAndValidateGateDecision(filePath) {
        const payload = await readJson(filePath);
        const validation = await validateGateDecision(payload);
        if (!validation.ok) {
            throw new TinyFilesystemRunnerError("INVALID_GATE_SCHEMA", validation.errors.join("; "));
        }
        return payload;
    }

    async interrupt(reason = "manual interrupt") {
        const checkpoint = await this.readCheckpoint();
        checkpoint.runner_status = "interrupted";
        checkpoint.halt_reason = reason;
        await writeJson(this.checkpointPath, checkpoint);
        return checkpoint;
    }

    async resume() {
        const checkpoint = await this.readCheckpoint();
        if (checkpoint.runner_status === "halted") {
            throw new TinyFilesystemRunnerError("RUNNER_HALTED", "cannot resume a halted runner");
        }
        if (checkpoint.runner_status === "completed") {
            throw new TinyFilesystemRunnerError("RUNNER_COMPLETED", "cannot resume a completed runner");
        }
        checkpoint.runner_status = "ready";
        checkpoint.halt_reason = null;
        await writeJson(this.checkpointPath, checkpoint);
        return checkpoint;
    }

    async dispatchNextPass() {
        const activeSubject = await this.readActiveSubject();
        const checkpoint = await this.readCheckpoint();
        await this.#validateActiveSubject(activeSubject);
        await this.#validateCheckpoint(checkpoint, activeSubject.subject_id);

        if (checkpoint.runner_status === "halted") {
            throw new TinyFilesystemRunnerError("RUNNER_HALTED", checkpoint.halt_reason ?? "runner is halted");
        }
        if (checkpoint.runner_status === "completed") {
            throw new TinyFilesystemRunnerError("RUNNER_COMPLETED", "runner already completed");
        }
        if (checkpoint.runner_status === "interrupted") {
            throw new TinyFilesystemRunnerError("RUNNER_INTERRUPTED", checkpoint.halt_reason ?? "runner is interrupted");
        }
        if (checkpoint.runner_status !== "ready") {
            throw new TinyFilesystemRunnerError(
                "RUNNER_NOT_READY",
                `runner status must be ready before dispatch, got ${checkpoint.runner_status}`
            );
        }
        if (!checkpoint.expected_role) {
            throw new TinyFilesystemRunnerError("NO_EXPECTED_ROLE", "no expected role is available for dispatch");
        }

        const passId = `pass_${String(checkpoint.pass_index + 1).padStart(3, "0")}`;
        const request = await this.#buildRequest({ activeSubject, checkpoint, passId });
        const requestValidation = await validatePassRequest(request);
        if (!requestValidation.ok) {
            await this.#halt("INVALID_REQUEST_SCHEMA", requestValidation.errors.join("; "));
        }

        const roleRequestPath = path.join(this.outboxDir, `${request.role}_request.json`);
        const currentRequestPath = path.join(this.outboxDir, "current_request.json");
        await writeJson(roleRequestPath, request);
        await writeJson(currentRequestPath, request);

        checkpoint.runner_status = "awaiting_response";
        checkpoint.pass_index += 1;
        checkpoint.last_pass_id = passId;
        checkpoint.last_written_request_path = path.relative(this.rootDir, roleRequestPath);
        await writeJson(this.checkpointPath, checkpoint);

        return {
            ok: true,
            request,
            requestPath: roleRequestPath,
        };
    }

    async writeRoleResponse(payload) {
        const checkpoint = await this.readCheckpoint();
        if (checkpoint.expected_role !== payload?.role) {
            await this.#halt(
                "UNEXPECTED_ROLE_RESPONSE",
                `expected role ${checkpoint.expected_role ?? "none"}, got ${payload?.role ?? "unknown"}`
            );
        }
        const validation = await validateRoleResponse(payload);
        if (!validation.ok) {
            await this.#halt("INVALID_RESPONSE_SCHEMA", validation.errors.join("; "));
        }
        const responsePath = path.join(this.inboxDir, `${payload.role}_response.json`);
        await writeJson(responsePath, payload);
        checkpoint.last_written_response_path = path.relative(this.rootDir, responsePath);
        await writeJson(this.checkpointPath, checkpoint);
        return {
            ok: true,
            responsePath,
        };
    }

    async writeGateDecision(payload) {
        const checkpoint = await this.readCheckpoint();
        if (checkpoint.expected_role !== "auditor_gate") {
            await this.#halt(
                "UNEXPECTED_GATE_DECISION",
                `expected role ${checkpoint.expected_role ?? "none"}, got auditor_gate`
            );
        }
        const validation = await validateGateDecision(payload);
        if (!validation.ok) {
            await this.#halt("INVALID_GATE_SCHEMA", validation.errors.join("; "));
        }
        const responsePath = path.join(this.inboxDir, "auditor_gate_decision.json");
        await writeJson(responsePath, payload);
        checkpoint.last_written_response_path = path.relative(this.rootDir, responsePath);
        await writeJson(this.checkpointPath, checkpoint);
        return {
            ok: true,
            responsePath,
        };
    }

    async consumeExpectedResponse() {
        const activeSubject = await this.readActiveSubject();
        const checkpoint = await this.readCheckpoint();
        await this.#validateActiveSubject(activeSubject);
        await this.#validateCheckpoint(checkpoint, activeSubject.subject_id);

        if (checkpoint.runner_status !== "awaiting_response") {
            throw new TinyFilesystemRunnerError(
                "RUNNER_NOT_AWAITING_RESPONSE",
                `runner must be awaiting_response, got ${checkpoint.runner_status}`
            );
        }

        if (checkpoint.expected_role === "auditor_gate") {
            return this.#consumeGateDecision(activeSubject, checkpoint);
        }
        return this.#consumeRoleResponse(activeSubject, checkpoint);
    }

    async #consumeRoleResponse(activeSubject, checkpoint) {
        const responsePath = path.join(this.inboxDir, `${checkpoint.expected_role}_response.json`);
        if (!(await pathExists(responsePath))) {
            throw new TinyFilesystemRunnerError(
                "MISSING_RESPONSE",
                `expected inbox payload at ${path.relative(this.rootDir, responsePath)}`
            );
        }

        const payload = await readJson(responsePath);
        const validation = await validateRoleResponse(payload);
        if (!validation.ok) {
            await this.#halt("INVALID_RESPONSE_SCHEMA", validation.errors.join("; "));
        }

        await this.#validateRoleEnvelope(payload, activeSubject, checkpoint);
        await this.#applyLiveSurfacePatchIfPresent(payload, activeSubject, checkpoint.expected_role);
        await this.#appendCycleLog(payload.cycle_log_entry);

        const nextRole = inferNextRole(payload.state_after);
        if (payload.recommended_next_role !== nextRole) {
            await this.#halt(
                "ILLEGAL_NEXT_ROLE",
                `expected recommended_next_role ${nextRole ?? "null"}, got ${payload.recommended_next_role}`
            );
        }

        await this.#updateSubjectRegisterFromRoleResponse(payload, nextRole);

        checkpoint.current_state = payload.state_after;
        checkpoint.expected_role = nextRole;
        checkpoint.runner_status = nextRole ? "ready" : "completed";
        checkpoint.last_consumed_response_path = path.relative(this.rootDir, responsePath);
        checkpoint.halt_reason = null;
        await writeJson(this.checkpointPath, checkpoint);

        return {
            ok: true,
            consumed: payload,
            responsePath,
        };
    }

    async #consumeGateDecision(activeSubject, checkpoint) {
        const responsePath = path.join(this.inboxDir, "auditor_gate_decision.json");
        if (!(await pathExists(responsePath))) {
            throw new TinyFilesystemRunnerError(
                "MISSING_GATE_DECISION",
                `expected inbox payload at ${path.relative(this.rootDir, responsePath)}`
            );
        }

        const payload = await readJson(responsePath);
        const validation = await validateGateDecision(payload);
        if (!validation.ok) {
            await this.#halt("INVALID_GATE_SCHEMA", validation.errors.join("; "));
        }

        await this.#validateGateEnvelope(payload, activeSubject, checkpoint);

        const cycleLogEntry = {
            pass_id: payload.pass_id,
            role: payload.role,
            active_subject_id: payload.active_subject_id,
            state_before: payload.state_transition.from,
            state_after: payload.state_transition.to,
            accepted_changes: [`gate decision: ${payload.decision}`],
            rejected_changes: [],
            live_tensions: [payload.reason],
            recommended_next_role: "admin_router",
        };
        await this.#appendCycleLog(cycleLogEntry);
        await this.#updateSubjectRegisterFromGateDecision(payload);

        checkpoint.current_state = payload.state_transition.to;
        checkpoint.expected_role = null;
        checkpoint.runner_status = "completed";
        checkpoint.last_consumed_response_path = path.relative(this.rootDir, responsePath);
        checkpoint.halt_reason = null;
        await writeJson(this.checkpointPath, checkpoint);

        return {
            ok: true,
            consumed: payload,
            responsePath,
        };
    }

    async #buildRequest({ activeSubject, checkpoint, passId }) {
        const liveSurfacePath = resolveWithinRoot(this.rootDir, activeSubject.live_surface_path);
        if (!liveSurfacePath) {
            await this.#halt(
                "FORBIDDEN_WRITE_ZONE",
                `live surface path escapes runtime root: ${activeSubject.live_surface_path}`
            );
        }
        const liveSurfaceText = await readFile(liveSurfacePath, "utf8");

        return {
            pass_id: passId,
            role: checkpoint.expected_role,
            active_subject_id: activeSubject.subject_id,
            state_before: checkpoint.current_state,
            purpose: defaultPurposeForRole(checkpoint.expected_role),
            scope: {
                live_surface_path: activeSubject.live_surface_path,
                section_anchor: activeSubject.section_anchor,
                forbidden: Array.isArray(activeSubject.forbidden_write_zones) ? activeSubject.forbidden_write_zones : [],
            },
            inputs: {
                current_candidate_text: this.#extractSectionText(liveSurfaceText, activeSubject.section_anchor),
                admin_transfer_note: activeSubject.admin_note ?? null,
                checkpoint: {
                    pass_index: checkpoint.pass_index + 1,
                    runner_status: checkpoint.runner_status,
                },
            },
            required_output_keys: defaultRequiredKeysForRole(checkpoint.expected_role),
        };
    }

    #extractSectionText(surfaceText, anchor) {
        const headingRegex = new RegExp(`^(#{1,6})\\s+${escapeRegex(anchor)}\\s*$`, "m");
        const match = headingRegex.exec(surfaceText);
        if (!match) return "";

        const headingLevel = match[1].length;
        const headingLineBreakIndex = surfaceText.indexOf("\n", match.index);
        const bodyStart = headingLineBreakIndex === -1 ? surfaceText.length : headingLineBreakIndex + 1;
        const remainder = surfaceText.slice(bodyStart);
        const nextHeadingRegex = new RegExp(`^#{1,${headingLevel}}\\s+`, "m");
        const nextHeadingMatch = nextHeadingRegex.exec(remainder);
        const sectionEnd = nextHeadingMatch ? bodyStart + nextHeadingMatch.index : surfaceText.length;
        return surfaceText.slice(bodyStart, sectionEnd).trim();
    }

    async #validateRoleEnvelope(payload, activeSubject, checkpoint) {
        if (payload.pass_id !== checkpoint.last_pass_id) {
            await this.#halt("PASS_ID_MISMATCH", `expected pass_id ${checkpoint.last_pass_id}, got ${payload.pass_id}`);
        }
        if (payload.role !== checkpoint.expected_role) {
            await this.#halt("ROLE_MISMATCH", `expected role ${checkpoint.expected_role}, got ${payload.role}`);
        }
        if (payload.active_subject_id !== activeSubject.subject_id) {
            await this.#halt(
                "SUBJECT_MISMATCH",
                `expected active_subject_id ${activeSubject.subject_id}, got ${payload.active_subject_id}`
            );
        }
        if (payload.state_before !== checkpoint.current_state) {
            await this.#halt(
                "STATE_BEFORE_MISMATCH",
                `expected state_before ${checkpoint.current_state}, got ${payload.state_before}`
            );
        }
        if (!STATE_VOCAB.has(payload.state_after)) {
            await this.#halt("ILLEGAL_STATE", `state_after is not in vocabulary: ${payload.state_after}`);
        }

        const allowed = ROLE_PERMISSIONS[payload.role]?.allowedStateTransitions?.[payload.state_before] ?? [];
        if (!allowed.includes(payload.state_after)) {
            await this.#halt(
                "ILLEGAL_STATE_TRANSITION",
                `${payload.role} may not transition ${payload.state_before} -> ${payload.state_after}`
            );
        }

        const cycleValidation = await validateCycleLogEntry(payload.cycle_log_entry);
        if (!cycleValidation.ok) {
            await this.#halt("INVALID_CYCLE_LOG", cycleValidation.errors.join("; "));
        }

        const cycleEntry = payload.cycle_log_entry;
        if (cycleEntry.pass_id !== payload.pass_id) {
            await this.#halt("CYCLE_LOG_MISMATCH", "cycle_log_entry.pass_id must match response pass_id");
        }
        if (cycleEntry.role !== payload.role) {
            await this.#halt("CYCLE_LOG_MISMATCH", "cycle_log_entry.role must match response role");
        }
        if (cycleEntry.active_subject_id !== payload.active_subject_id) {
            await this.#halt("CYCLE_LOG_MISMATCH", "cycle_log_entry.active_subject_id must match response active_subject_id");
        }
        if (cycleEntry.state_before !== payload.state_before) {
            await this.#halt("CYCLE_LOG_MISMATCH", "cycle_log_entry.state_before must match response state_before");
        }
        if (cycleEntry.state_after !== payload.state_after) {
            await this.#halt("CYCLE_LOG_MISMATCH", "cycle_log_entry.state_after must match response state_after");
        }
        if (cycleEntry.recommended_next_role !== payload.recommended_next_role) {
            await this.#halt("CYCLE_LOG_MISMATCH", "cycle_log_entry.recommended_next_role must match response recommended_next_role");
        }
    }

    async #validateGateEnvelope(payload, activeSubject, checkpoint) {
        if (payload.pass_id !== checkpoint.last_pass_id) {
            await this.#halt("PASS_ID_MISMATCH", `expected pass_id ${checkpoint.last_pass_id}, got ${payload.pass_id}`);
        }
        if (payload.role !== "auditor_gate") {
            await this.#halt("ROLE_MISMATCH", `expected role auditor_gate, got ${payload.role}`);
        }
        if (payload.active_subject_id !== activeSubject.subject_id) {
            await this.#halt(
                "SUBJECT_MISMATCH",
                `expected active_subject_id ${activeSubject.subject_id}, got ${payload.active_subject_id}`
            );
        }
        if (payload.state_transition.from !== checkpoint.current_state) {
            await this.#halt(
                "STATE_BEFORE_MISMATCH",
                `expected state_transition.from ${checkpoint.current_state}, got ${payload.state_transition.from}`
            );
        }
        if (!STATE_VOCAB.has(payload.state_transition.to)) {
            await this.#halt("ILLEGAL_STATE", `state_transition.to is not in vocabulary: ${payload.state_transition.to}`);
        }
        const allowed = ROLE_PERMISSIONS.auditor_gate.allowedStateTransitions[payload.state_transition.from] ?? [];
        if (!allowed.includes(payload.state_transition.to)) {
            await this.#halt(
                "ILLEGAL_STATE_TRANSITION",
                `auditor_gate may not transition ${payload.state_transition.from} -> ${payload.state_transition.to}`
            );
        }
        if (payload.next_active_subject_id !== activeSubject.subject_id) {
            await this.#halt(
                "SUBJECT_MISMATCH",
                `expected next_active_subject_id ${activeSubject.subject_id}, got ${payload.next_active_subject_id}`
            );
        }
    }

    async #applyLiveSurfacePatchIfPresent(payload, activeSubject, role) {
        if (!payload.mutated_live_surface) {
            if (payload.live_surface_patch !== null && payload.live_surface_patch !== undefined) {
                await this.#halt("ILLEGAL_MUTATION", "live_surface_patch must be null when mutated_live_surface=false");
            }
            return;
        }

        if (!ROLE_PERMISSIONS[role]?.mayMutate) {
            await this.#halt("ILLEGAL_MUTATION", `${role} may not mutate the live surface`);
        }
        if (!isObject(payload.live_surface_patch)) {
            await this.#halt("INVALID_PATCH", "live_surface_patch must be an object when mutated_live_surface=true");
        }

        const patch = payload.live_surface_patch;
        if (patch.mode !== "replace_section") {
            await this.#halt("INVALID_PATCH_MODE", `unsupported patch mode: ${patch.mode ?? "unknown"}`);
        }
        if (patch.section_anchor !== activeSubject.section_anchor) {
            await this.#halt(
                "FORBIDDEN_WRITE_ZONE",
                `patch section_anchor ${patch.section_anchor ?? "unknown"} is outside the active subject anchor ${activeSubject.section_anchor}`
            );
        }
        if (typeof patch.new_text !== "string" || patch.new_text.length === 0) {
            await this.#halt("INVALID_PATCH", "replace_section patch requires non-empty new_text");
        }

        const targetRelativePath = patch.live_surface_path ?? activeSubject.live_surface_path;
        if (targetRelativePath !== activeSubject.live_surface_path) {
            await this.#halt(
                "FORBIDDEN_WRITE_ZONE",
                `patch target ${targetRelativePath} does not match active live surface ${activeSubject.live_surface_path}`
            );
        }
        if ((activeSubject.forbidden_write_zones ?? []).includes(patch.section_anchor)) {
            await this.#halt("FORBIDDEN_WRITE_ZONE", `section anchor ${patch.section_anchor} is forbidden`);
        }

        const absoluteTargetPath = resolveWithinRoot(this.rootDir, targetRelativePath);
        if (!absoluteTargetPath) {
            await this.#halt("FORBIDDEN_WRITE_ZONE", `patch target escapes runtime root: ${targetRelativePath}`);
        }

        const currentText = await readFile(absoluteTargetPath, "utf8");
        const replacement = replaceMarkdownSection(currentText, patch.section_anchor, patch.new_text);
        if (!replacement.ok) {
            await this.#halt("PATCH_APPLY_FAILED", replacement.error);
        }
        await writeFile(absoluteTargetPath, replacement.updatedText, "utf8");
    }

    async #appendCycleLog(entry) {
        const validation = await validateCycleLogEntry(entry);
        if (!validation.ok) {
            await this.#halt("INVALID_CYCLE_LOG", validation.errors.join("; "));
        }
        const existing = await readFile(this.cycleLogPath, "utf8");
        await writeFile(this.cycleLogPath, `${existing}${JSON.stringify(entry)}\n`, "utf8");
    }

    async #updateSubjectRegisterFromRoleResponse(payload, nextRole) {
        const register = await this.readSubjectRegister();
        const nextRegister = register.map((entry) => {
            if (entry.subject_id !== payload.active_subject_id) return entry;
            return {
                ...entry,
                state: payload.state_after,
                last_role: payload.role,
                recommended_next_role: nextRole ?? "admin_router",
                known_tensions: uniqueStrings(payload.live_tensions),
            };
        });
        await this.#writeValidatedSubjectRegister(nextRegister);
    }

    async #updateSubjectRegisterFromGateDecision(payload) {
        const update = payload.subject_register_update;
        if (update !== null && update !== undefined && !isObject(update)) {
            await this.#halt("INVALID_REGISTER_UPDATE", "subject_register_update must be an object or null");
        }

        const allowedKeys = new Set(["subject_id", "state", "recommended_next_role", "known_tensions", "notes"]);
        if (isObject(update)) {
            for (const key of Object.keys(update)) {
                if (!allowedKeys.has(key)) {
                    await this.#halt("INVALID_REGISTER_UPDATE", `unsupported subject_register_update key: ${key}`);
                }
            }
        }

        const register = await this.readSubjectRegister();
        const nextRegister = register.map((entry) => {
            if (entry.subject_id !== payload.active_subject_id) return entry;
            return {
                ...entry,
                ...(update ?? {}),
                state: update?.state ?? payload.state_transition.to,
                last_role: "auditor_gate",
                recommended_next_role: update?.recommended_next_role ?? "admin_router",
                known_tensions: uniqueStrings(update?.known_tensions ?? [payload.reason]),
            };
        });
        await this.#writeValidatedSubjectRegister(nextRegister);
    }

    async #writeValidatedSubjectRegister(entries) {
        if (!Array.isArray(entries) || entries.length === 0) {
            await this.#halt("INVALID_SUBJECT_REGISTER", "subject_register must be a non-empty array");
        }
        for (const [index, entry] of entries.entries()) {
            const validation = await validateSubjectRegisterEntry(entry);
            if (!validation.ok) {
                await this.#halt("INVALID_SUBJECT_REGISTER", `entry ${index}: ${validation.errors.join("; ")}`);
            }
        }
        await writeJson(this.subjectRegisterPath, entries);
    }

    async #validateRegisterEntry(entry) {
        const validation = await validateSubjectRegisterEntry(entry);
        if (!validation.ok) {
            throw new TinyFilesystemRunnerError("INVALID_SUBJECT_REGISTER", validation.errors.join("; "));
        }
    }

    async #validateActiveSubject(activeSubject) {
        if (!isObject(activeSubject)) {
            throw new TinyFilesystemRunnerError("INVALID_ACTIVE_SUBJECT", "active_subject must be an object");
        }
        for (const field of ["subject_id", "title", "layer", "state", "live_surface_path", "section_anchor"]) {
            if (typeof activeSubject[field] !== "string" || activeSubject[field].length === 0) {
                throw new TinyFilesystemRunnerError("INVALID_ACTIVE_SUBJECT", `active_subject.${field} must be a non-empty string`);
            }
        }
        if (!STATE_VOCAB.has(activeSubject.state)) {
            throw new TinyFilesystemRunnerError("INVALID_ACTIVE_SUBJECT", `active_subject.state is not in vocabulary: ${activeSubject.state}`);
        }
        if (activeSubject.forbidden_write_zones !== undefined && !Array.isArray(activeSubject.forbidden_write_zones)) {
            throw new TinyFilesystemRunnerError("INVALID_ACTIVE_SUBJECT", "active_subject.forbidden_write_zones must be an array when present");
        }
    }

    async #validateCheckpoint(checkpoint, activeSubjectId) {
        if (!isObject(checkpoint)) {
            throw new TinyFilesystemRunnerError("INVALID_CHECKPOINT", "checkpoint must be an object");
        }
        const statuses = new Set(["ready", "awaiting_response", "interrupted", "halted", "completed"]);
        if (!statuses.has(checkpoint.runner_status)) {
            throw new TinyFilesystemRunnerError("INVALID_CHECKPOINT", `unknown runner_status: ${checkpoint.runner_status}`);
        }
        if (checkpoint.active_subject_id !== activeSubjectId) {
            throw new TinyFilesystemRunnerError(
                "INVALID_CHECKPOINT",
                `checkpoint.active_subject_id ${checkpoint.active_subject_id} does not match ${activeSubjectId}`
            );
        }
        if (!STATE_VOCAB.has(checkpoint.current_state)) {
            throw new TinyFilesystemRunnerError("INVALID_CHECKPOINT", `checkpoint.current_state is not in vocabulary: ${checkpoint.current_state}`);
        }
    }

    async #halt(code, message) {
        const checkpoint = await this.readCheckpoint();
        checkpoint.runner_status = "halted";
        checkpoint.halt_reason = `${code}: ${message}`;
        await writeJson(this.checkpointPath, checkpoint);
        throw new TinyFilesystemRunnerError(code, message);
    }
}
