
// runtime/CrossRunSession.js

import { CrossRunDynamicsReport } from "./CrossRunDynamicsReport.js";

export class CrossRunSession {
    constructor(opts = {}) {
        this.session_id = opts.session_id ?? "cross-run-session";
        this.max_runs = Number.isFinite(opts.max_runs) ? opts.max_runs : 25;
        this._reporter = opts.crossRunReport ?? new CrossRunDynamicsReport();

        this._runs = [];
        this._latest_report = null;
    }

    addRun(result, meta = {}) {
        if (!this._isValidRun(result)) {
            return { ok: false, error: "INVALID_RUN", reasons: ["CrossRunSession requires a successful DoorOneOrchestrator result with interpretation overlays"] };
        }

        const runLabel = this._resolveRunLabel(result, meta);

        if (this._runs.some(r => r.run_label === runLabel)) {
            return { ok: false, error: "DUPLICATE_RUN_LABEL", reasons: [`Run label already exists: ${runLabel}`] };
        }

        this._runs.push({
            run_label: runLabel,
            added_at: new Date().toISOString(),
            result,
            meta: this._copy(meta),
        });

        if (this._runs.length > this.max_runs) {
            this._runs.shift();
        }

        return {
            ok: true,
            run_label: runLabel,
            run_count: this._runs.length,
        };
    }

    listRuns() {
        return this._runs.map(r => ({
            run_label: r.run_label,
            added_at: r.added_at,
            stream_id: r.result?.artifacts?.a1?.stream_id ?? null,
            state_count: r.result?.substrate?.state_count ?? 0,
            basin_count: r.result?.substrate?.basin_count ?? 0,
            segment_count: r.result?.substrate?.segment_count ?? 0,
        }));
    }

    getRun(runLabel) {
        const found = this._runs.find(r => r.run_label === runLabel);
        return found ? this._copy(found) : null;
    }

    latestRun() {
        if (this._runs.length === 0) return null;
        return this._copy(this._runs[this._runs.length - 1]);
    }

    compareAll(opts = {}) {
        return this._compareEntries(this._runs, opts);
    }

    compare(runLabels, opts = {}) {
        if (!Array.isArray(runLabels) || runLabels.length === 0) {
            return { ok: false, error: "INVALID_SELECTION", reasons: ["compare(runLabels) requires a non-empty label array"] };
        }

        const selected = runLabels
            .map(label => this._runs.find(r => r.run_label === label))
            .filter(Boolean);

        if (selected.length !== runLabels.length) {
            return { ok: false, error: "UNKNOWN_RUN_LABEL", reasons: ["One or more requested run labels were not found"] };
        }

        return this._compareEntries(selected, { ...opts, run_labels: runLabels });
    }

    latestReport() {
        return this._latest_report ? this._copy(this._latest_report) : null;
    }

    clear() {
        this._runs = [];
        this._latest_report = null;
        return { ok: true };
    }

    _compareEntries(entries, opts = {}) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return { ok: false, error: "EMPTY_SESSION", reasons: ["No runs available for cross-run comparison"] };
        }

        const runResults = entries.map(e => e.result);
        const runLabels = entries.map(e => e.run_label);

        const report = this._reporter.compare(runResults, {
            ...opts,
            run_labels: runLabels,
        });

        if (report?.ok === false) {
            return report;
        }

        this._latest_report = this._copy(report);
        return report;
    }

    _isValidRun(result) {
        return !!(
            result?.ok &&
            result?.interpretation?.trajectory &&
            result?.interpretation?.attention_memory
        );
    }

    _resolveRunLabel(result, meta) {
        return (
            meta?.run_label ??
            result?.run_label ??
            result?.meta?.run_label ??
            `run_${this._runs.length + 1}`
        );
    }

    _copy(v) {
        return JSON.parse(JSON.stringify(v));
    }
}