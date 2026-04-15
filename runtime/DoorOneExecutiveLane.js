// runtime/DoorOneExecutiveLane.js

/**
 * DoorOneExecutiveLane
 *
 * Layer:
 *   Read-side runtime executive coordinator.
 *   Not a pipeline operator. Not an authority-bearing artifact.
 *
 * Purpose:
 *   Provide a thin repeated-run execution lane for Door One by coordinating:
 *     - DoorOneOrchestrator
 *     - CrossRunSession
 *     - DoorOneWorkbench
 *
 * Boundary contract:
 *   - integration / execution lane only
 *   - not canon
 *   - not promotion
 *   - not ontology
 *   - not truth
 *   - does not mint C1
 *   - does not mutate raw input or completed run results
 *   - does not bypass DoorOneOrchestrator
 */

import { DoorOneOrchestrator } from "./DoorOneOrchestrator.js";
import { CrossRunSession } from "./CrossRunSession.js";
import { DoorOneWorkbench } from "./DoorOneWorkbench.js";

export class DoorOneExecutiveLane {
    /**
     * @param {Object} [opts]
     * @param {Object} [opts.policies]
     * @param {Object} [opts.querySpec]
     * @param {Object} [opts.queryPolicy]
     * @param {number} [opts.max_runs=25]
     * @param {string} [opts.session_id="door-one-executive-session"]
     * @param {Function} [opts.orchestratorFactory]
     * @param {CrossRunSession} [opts.crossRunSession]
     * @param {DoorOneWorkbench} [opts.workbench]
     */
    constructor(opts = {}) {
        this.policies = this._copy(opts.policies ?? {});
        this.querySpec = this._copy(opts.querySpec ?? null);
        this.queryPolicy = this._copy(opts.queryPolicy ?? null);

        this._orchestratorFactory =
            opts.orchestratorFactory ??
            ((ctx = {}) =>
                new DoorOneOrchestrator({
                    policies: this.policies,
                    substrate_id: ctx.substrate_id ?? "door_one_executive_substrate",
                }));

        this._session =
            opts.crossRunSession ??
            new CrossRunSession({
                session_id: opts.session_id ?? "door-one-executive-session",
                max_runs: opts.max_runs ?? 25,
            });

        this._workbench = opts.workbench ?? new DoorOneWorkbench();

        this._run_index = 0;
        this._latest_run_result = null;
        this._latest_workbench = null;
        this._latest_cross_run_report = null;
    }

    /**
     * Ingest one raw Door One input and advance the executive lane.
     *
     * @param {Object} rawInput
     * @param {Object} [opts]
     * @param {string} [opts.run_label]
     * @param {string} [opts.substrate_id]
     * @param {Object} [opts.query_spec]
     * @param {Object} [opts.query_policy]
     * @returns {Object}
     */
    ingest(rawInput, opts = {}) {
        const normalizedInput = this._normalizeRawInput(rawInput);
        if (!normalizedInput.ok) return normalizedInput;

        const inputCheck = this._validateRawInput(normalizedInput.raw_input);
        if (!inputCheck.ok) return inputCheck;

        const runIndex = this._run_index + 1;
        const runLabel = opts.run_label ?? `executive_run_${runIndex}`;

        const orchestrator = this._orchestratorFactory({
            substrate_id: opts.substrate_id ?? `door_one_executive_substrate_${runIndex}`,
            run_index: runIndex,
            run_label: runLabel,
        });

        const runResult = orchestrator.runBatch(normalizedInput.raw_input, {
            query_spec: this._copy(opts.query_spec ?? this.querySpec),
            query_policy: this._copy(opts.query_policy ?? this.queryPolicy),
        });

        if (!runResult?.ok) {
            return {
                ok: false,
                error: "RUN_FAILED",
                reasons: ["DoorOneOrchestrator runBatch failed"],
                run_result: runResult,
            };
        }

        runResult.run_label = runLabel;

        const addRes = this._session.addRun(runResult, { run_label: runLabel });
        if (!addRes?.ok) {
            return {
                ok: false,
                error: "SESSION_ADD_FAILED",
                reasons: addRes?.reasons ?? ["CrossRunSession failed to store run"],
                run_result: runResult,
            };
        }

        const crossRunReport = this._session.compareAll();
        const lawfulCrossRunReport =
            crossRunReport && crossRunReport.ok !== false ? crossRunReport : null;

        const workbench = this._workbench.assemble(runResult, {
            crossRunReport: lawfulCrossRunReport,
        });

        if (!workbench?.workbench_type) {
            return {
                ok: false,
                error: "WORKBENCH_ASSEMBLY_FAILED",
                reasons: ["DoorOneWorkbench failed to assemble"],
                run_result: runResult,
                cross_run_report: lawfulCrossRunReport,
                workbench,
            };
        }

        this._run_index = runIndex;
        this._latest_run_result = this._copy(runResult);
        this._latest_cross_run_report = this._copy(lawfulCrossRunReport);
        this._latest_workbench = this._copy(workbench);

        return {
            ok: true,
            run_result: this._copy(runResult),
            workbench: this._copy(workbench),
            cross_run_report: this._copy(lawfulCrossRunReport),
            session_summary: this.sessionSummary(),
        };
    }

    latestRunResult() {
        return this._copy(this._latest_run_result);
    }

    latestWorkbench() {
        return this._copy(this._latest_workbench);
    }

    latestCrossRunReport() {
        return this._copy(this._latest_cross_run_report);
    }

    sessionSummary() {
        const runs = this._session.listRuns();
        const latestReport = this._session.latestReport();

        return {
            run_count: runs.length,
            runs: this._copy(runs),
            cross_run_available: !!latestReport,
            cross_run_run_count: latestReport?.scope?.run_count ?? 0,
        };
    }

    reset() {
        this._session.clear();
        this._run_index = 0;
        this._latest_run_result = null;
        this._latest_workbench = null;
        this._latest_cross_run_report = null;

        return { ok: true };
    }

    _normalizeRawInput(input) {
        if (!input || typeof input !== "object") {
            return {
                ok: false,
                error: "INVALID_INPUT",
                reasons: ["DoorOneExecutiveLane requires a raw input object or sampler flush result"],
            };
        }

        if (Array.isArray(input.timestamps) || Array.isArray(input.values)) {
            return {
                ok: true,
                raw_input: this._copy(input),
                input_kind: "raw_input",
            };
        }

        if ("ingest_input" in input) {
            if (input.ok !== true) {
                return {
                    ok: false,
                    error: "INVALID_INPUT",
                    reasons: input?.reasons?.length
                        ? this._copy(input.reasons)
                        : ["sampler flush result was not ok"],
                };
            }

            if (!input.ingest_input || typeof input.ingest_input !== "object") {
                return {
                    ok: false,
                    error: "INVALID_INPUT",
                    reasons: ["sampler flush result must include ingest_input"],
                };
            }

            return {
                ok: true,
                raw_input: this._copy(input.ingest_input),
                input_kind: "sampler_flush",
            };
        }

        return {
            ok: false,
            error: "INVALID_INPUT",
            reasons: [
                "DoorOneExecutiveLane input must be a raw ingest object or AnalogSamplerOp flush result",
            ],
        };
    }

    _validateRawInput(rawInput) {
        if (!rawInput || typeof rawInput !== "object") {
            return {
                ok: false,
                error: "INVALID_INPUT",
                reasons: ["DoorOneExecutiveLane requires a raw input object"],
            };
        }

        if (!Array.isArray(rawInput.timestamps) || rawInput.timestamps.length === 0) {
            return {
                ok: false,
                error: "INVALID_INPUT",
                reasons: ["rawInput.timestamps must be a non-empty array"],
            };
        }

        if (!Array.isArray(rawInput.values) || rawInput.values.length === 0) {
            return {
                ok: false,
                error: "INVALID_INPUT",
                reasons: ["rawInput.values must be a non-empty array"],
            };
        }

        if (rawInput.timestamps.length !== rawInput.values.length) {
            return {
                ok: false,
                error: "INVALID_INPUT",
                reasons: ["rawInput.timestamps and rawInput.values must have the same length"],
            };
        }

        if (typeof rawInput.stream_id !== "string" || rawInput.stream_id.trim() === "") {
            return {
                ok: false,
                error: "INVALID_INPUT",
                reasons: ["rawInput.stream_id must be a non-empty string"],
            };
        }

        if (typeof rawInput.source_id !== "string" || rawInput.source_id.trim() === "") {
            return {
                ok: false,
                error: "INVALID_INPUT",
                reasons: ["rawInput.source_id must be a non-empty string"],
            };
        }

        if (typeof rawInput.channel !== "string" || rawInput.channel.trim() === "") {
            return {
                ok: false,
                error: "INVALID_INPUT",
                reasons: ["rawInput.channel must be a non-empty string"],
            };
        }

        if (typeof rawInput.modality !== "string" || rawInput.modality.trim() === "") {
            return {
                ok: false,
                error: "INVALID_INPUT",
                reasons: ["rawInput.modality must be a non-empty string"],
            };
        }

        if (typeof rawInput.clock_policy_id !== "string" || rawInput.clock_policy_id.trim() === "") {
            return {
                ok: false,
                error: "INVALID_INPUT",
                reasons: ["rawInput.clock_policy_id must be a non-empty string"],
            };
        }

        return { ok: true };
    }

    _copy(v) {
        return v == null ? v : JSON.parse(JSON.stringify(v));
    }
}
