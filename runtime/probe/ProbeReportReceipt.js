import { readFile, writeFile } from "node:fs/promises";

import { validateProbeReportReceipt } from "../schema/ExecutionSurfaceReceiptValidators.js";

function resolveRowSurface(report) {
    if (Array.isArray(report?.per_run_rows)) {
        return { path: "per_run_rows", rows: report.per_run_rows };
    }
    if (Array.isArray(report?.per_cohort_rows)) {
        return { path: "per_cohort_rows", rows: report.per_cohort_rows };
    }
    if (Array.isArray(report?.labeled_replay?.per_run_rows)) {
        return { path: "labeled_replay.per_run_rows", rows: report.labeled_replay.per_run_rows };
    }
    return { path: "none", rows: [] };
}

function resolveSummarySurface(report) {
    if (report?.probe_summary && typeof report.probe_summary === "object") {
        return { path: "probe_summary", available: true };
    }
    if (report?.replay_summary && typeof report.replay_summary === "object") {
        return { path: "replay_summary", available: true };
    }
    if (report?.labeled_replay?.replay_summary && typeof report.labeled_replay.replay_summary === "object") {
        return { path: "labeled_replay.replay_summary", available: true };
    }
    if (report?.cross_family_summary && typeof report.cross_family_summary === "object") {
        return { path: "cross_family_summary", available: true };
    }
    return { path: "none", available: false };
}

function readBooleanEvidence(report, paths) {
    for (const path of paths) {
        const value = path.split(".").reduce((acc, key) => acc?.[key], report);
        if (value === true) return true;
    }
    return false;
}

export function deriveProbeReportReceipt(report, opts = {}) {
    const rowSurface = resolveRowSurface(report);
    const summarySurface = resolveSummarySurface(report);

    return {
        receipt_type: "runtime:probe_report_receipt",
        receipt_version: "0.1.0",
        probe_type: report?.probe_type ?? "unknown_probe_report",
        row_surface: {
            path: rowSurface.path,
            row_count: rowSurface.rows.length,
        },
        summary_surface: summarySurface,
        posture_flags: {
            has_constitutional_posture: !!report?.constitutional_posture,
            has_disclaimers: !!report?.disclaimers,
            not_canon_evidence: readBooleanEvidence(report, [
                "disclaimers.not_canon",
                "replay_summary.not_canon",
                "labeled_replay.replay_summary.not_canon",
                "cross_family_summary.not_canon",
            ]),
            not_prediction_evidence: readBooleanEvidence(report, [
                "replay_summary.not_prediction",
                "labeled_replay.replay_summary.not_prediction",
                "cross_family_summary.not_prediction",
                "constitutional_posture.no_prediction_claims",
            ]),
        },
        authority_posture: {
            advisory_only: true,
            read_side_only: true,
            runtime_authority: false,
            canon_authority: false,
        },
        counts: {
            comparison_count: Array.isArray(report?.comparisons) ? report.comparisons.length : 0,
            family_summary_count: Array.isArray(report?.family_summaries) ? report.family_summaries.length : 0,
        },
        report_ref: {
            report_path: opts.report_path ?? null,
        },
    };
}

export function deriveAndValidateProbeReportReceipt(report, opts = {}) {
    const receipt = deriveProbeReportReceipt(report, opts);
    return {
        receipt,
        validation: validateProbeReportReceipt(receipt),
    };
}

export async function writeValidatedProbeReportReceipt(outputPath, report, opts = {}) {
    const { receipt, validation } = deriveAndValidateProbeReportReceipt(report, opts);
    if (!validation.ok) {
        const error = new Error(`Invalid probe report receipt: ${validation.errors.join("; ")}`);
        error.code = "INVALID_PROBE_REPORT_RECEIPT";
        throw error;
    }
    await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    return receipt;
}

export async function readAndValidateProbeReportReceipt(receiptPath) {
    const raw = await readFile(receiptPath, "utf8");
    const receipt = JSON.parse(raw);
    const validation = validateProbeReportReceipt(receipt);
    return {
        receipt,
        validation,
    };
}
