// runtime/DoorOneWorkbench.js
/**
 * DoorOneWorkbench
 *
 * Layer:
 *   Read-side runtime integration helper.
 *   Not a pipeline operator. Not an authority-bearing artifact.
 *
 * Purpose:
 *   Assemble a single, deterministic Door One inspection surface from already-lawful
 *   runtime outputs:
 *     - DoorOneOrchestrator result
 *     - optional CrossRunDynamicsReport or CrossRunSession
 *
 * Boundary contract:
 *   - integration view only
 *   - not canon
 *   - not promotion
 *   - not ontology
 *   - not truth
 *   - does not mutate input result or cross-run objects
 *   - does not recompute authoritative artifacts
 *   - does not mint C1
 *
 * Runtime role:
 *   - compose lawful Door One outputs into one stable workbench object
 *   - support terminal runners and future JSON-first kernel surfaces
 *   - remain below canon as an inspection/integration surface
 *
 * Inputs:
 *   - completed DoorOneOrchestrator result
 *   - optional CrossRunDynamicsReport
 *   - optional CrossRunSession
 *
 * Output:
 *   Plain-data workbench object containing:
 *     - runtime
 *     - semantic_overlay
 *     - compatibility aliases for transitional downstream consumers
 *     - optional cross_run
 *
 * Non-responsibilities:
 *   - does NOT replace DoorOneOrchestrator
 *   - does NOT perform ingestion or operator execution
 *   - does NOT define new artifact classes
 *   - does NOT activate deferred layers
 */

import { CrossRunDynamicsReport } from "./CrossRunDynamicsReport.js";

export class DoorOneWorkbench {
    constructor(opts = {}) {
        this._crossRun =
            opts.crossRunDynamicsReport ?? new CrossRunDynamicsReport();
    }

    assemble(result, opts = {}) {
        if (!result?.ok) {
            return {
                ok: false,
                error: "INVALID_INPUT",
                reasons: ["DoorOneWorkbench requires a successful DoorOneOrchestrator result"],
            };
        }

        const crossRunReport = this._resolveCrossRunReport(opts);
        const runtimeReceipt = this._copy(
            result?.runtime_receipt ?? this._buildRuntimeReceipt(result)
        );

        const runtime = {
            receipt: runtimeReceipt,
            artifacts: this._copy(result?.artifacts ?? {}),
            substrate: this._copy(result?.substrate ?? {}),
            summaries: this._copy(result?.summaries ?? {}),
            audit: this._copy(result?.audit ?? {}),
        };

        const semanticOverlay = {
            trajectory: this._copy(
                result?.semantic_overlay?.trajectory ??
                result?.interpretation?.trajectory ??
                null
            ),
            attention_memory: this._copy(
                result?.semantic_overlay?.attention_memory ??
                result?.interpretation?.attention_memory ??
                null
            ),
        };

        const compatibilityAliases = {
            interpretation: {
                trajectory: this._copy(result?.interpretation?.trajectory ?? null),
                attention_memory: this._copy(result?.interpretation?.attention_memory ?? null),
            },
        };
        const workbenchReceipt = {
            receipt_type: "runtime:door_one_workbench_receipt",
            stream_id: result?.artifacts?.a1?.stream_id ?? null,
            source_id: result?.artifacts?.a1?.source_id ?? null,
            segment_count: Array.isArray(result?.substrate?.segment_ids)
                ? result.substrate.segment_ids.length
                : 0,
            state_count: runtimeReceipt?.state_count ?? result?.substrate?.state_count ?? 0,
            basin_count: runtimeReceipt?.basin_count ?? result?.substrate?.basin_count ?? 0,
            query_present: runtimeReceipt?.query_present ?? !!result?.artifacts?.q,
            cross_run_available: !!crossRunReport,
            cross_run_run_count: crossRunReport?.scope?.run_count ?? 0,
        };

        return {
            workbench_type: "runtime:door_one_workbench",
            generated_from:
                "Door One runtime primary section, downstream semantic overlay, optional cross-run report, and interpretation compatibility aliases only; integration view, not canon",
            scope: {
                stream_id: result?.artifacts?.a1?.stream_id ?? null,
                source_id: result?.artifacts?.a1?.source_id ?? null,
                segment_ids: Array.isArray(result?.substrate?.segment_ids)
                    ? [...result.substrate.segment_ids]
                    : [],
                t_span: result?.substrate?.t_span
                    ? {
                        t_start: result.substrate.t_span.t_start ?? null,
                        t_end: result.substrate.t_span.t_end ?? null,
                        duration_sec: result.substrate.t_span.duration_sec ?? null,
                    }
                    : null,
                cross_run_context: {
                    available: !!crossRunReport,
                    run_count: crossRunReport?.scope?.run_count ?? 0,
                },
            },
            runtime,
            workbench_receipt: workbenchReceipt,
            semantic_overlay: semanticOverlay,
            compatibility_aliases: this._copy(compatibilityAliases),

            cross_run: {
                available: !!crossRunReport,
                report: crossRunReport ? this._copy(crossRunReport) : null,
            },

            interpretation: this._copy(compatibilityAliases.interpretation),

            notes: this._buildNotes(crossRunReport),
        };
    }

    _resolveCrossRunReport(opts) {
        if (opts.crossRunReport) return opts.crossRunReport;

        if (opts.crossRunSession) {
            if (typeof opts.crossRunSession.latestReport === "function") {
                const latest = opts.crossRunSession.latestReport();
                if (latest) return latest;
            }
            if (typeof opts.crossRunSession.compareAll === "function") {
                const report = opts.crossRunSession.compareAll();
                if (report && report.ok !== false) return report;
            }
        }

        return null;
    }

    _buildNotes(crossRunReport) {
        const notes = [
            "Workbench is an integration view, not canon.",
            "Structural runtime remains the primary workbench section.",
            "Semantic overlay remains removable and subordinate to the runtime surface.",
            "Cross-run output remains comparative support only and does not imply identity closure.",
            "Compatibility aliases are grouped under compatibility_aliases and mirrored at top level only as transitional downstream bridges.",
        ];

        if (!crossRunReport) {
            notes.push("No cross-run report was supplied; workbench is operating in single-run mode.");
        }

        return notes;
    }

    _buildRuntimeReceipt(result) {
        return {
            receipt_type: "runtime:door_one_orchestrator_receipt",
            stream_id: result?.artifacts?.a1?.stream_id ?? null,
            source_id: result?.artifacts?.a1?.source_id ?? null,
            state_count: result?.substrate?.state_count ?? 0,
            basin_count: result?.substrate?.basin_count ?? 0,
            segment_count: result?.substrate?.segment_count ?? 0,
            trajectory_frames: result?.substrate?.trajectory_frames ?? 0,
            segment_transition_count: Array.isArray(result?.substrate?.segment_transitions)
                ? result.substrate.segment_transitions.length
                : 0,
            h1_count: Array.isArray(result?.artifacts?.h1s) ? result.artifacts.h1s.length : 0,
            m1_count: Array.isArray(result?.artifacts?.m1s) ? result.artifacts.m1s.length : 0,
            anomaly_count: Array.isArray(result?.artifacts?.anomaly_reports)
                ? result.artifacts.anomaly_reports.length
                : 0,
            query_present: !!result?.artifacts?.q,
            skipped_window_count: Array.isArray(result?.audit?.skipped_windows)
                ? result.audit.skipped_windows.length
                : 0,
            merge_failure_count: Array.isArray(result?.audit?.merge_failures)
                ? result.audit.merge_failures.length
                : 0,
        };
    }

    _copy(v) {
        return JSON.parse(JSON.stringify(v));
    }
}
