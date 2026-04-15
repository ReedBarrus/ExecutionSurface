// scripts/run_door_one_provenance_digest.js
//
// Door One provenance digest runner
//
// Purpose:
//   - read durable live provenance receipts from ./out_provenance/live/
//   - build a bounded digest over structural receipt history
//   - write a non-canonical digest summary back to provenance storage

import { mkdir, readdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_PROVENANCE_ROOT = "./out_provenance/live";
export const DEFAULT_DIGEST_FILENAME = "live_digest.json";
export const RECEIPT_FILE_RE = /^receipt_cycle_(\d+)_.*\.json$/;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readJson(filePath) {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
}

async function writeJson(filePath, data) {
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function basename(filePath) {
    return path.basename(filePath);
}

function parseReceiptCycleIndexFromName(name) {
    const m = String(name).match(RECEIPT_FILE_RE);
    if (!m) return null;
    const n = Number.parseInt(m[1], 10);
    return Number.isFinite(n) ? n : null;
}

function countBy(values) {
    const out = {};
    for (const v of values) {
        const key = v == null || v === "" ? "unknown" : String(v);
        out[key] = (out[key] ?? 0) + 1;
    }
    return out;
}

function uniqSorted(values) {
    return [...new Set(values.map((v) => (v == null ? "unknown" : String(v))))].sort();
}

function sortTimelineRows(rows) {
    return [...rows].sort((a, b) => Number(a.cycle_index ?? 0) - Number(b.cycle_index ?? 0));
}

async function pathExistsAsDirectory(dirPath) {
    try {
        const info = await stat(dirPath);
        return info.isDirectory();
    } catch (err) {
        if (err && err.code === "ENOENT") return false;
        throw err;
    }
}

export async function listReceiptFiles(provenanceRoot = DEFAULT_PROVENANCE_ROOT) {
    const exists = await pathExistsAsDirectory(provenanceRoot);
    if (!exists) return [];

    const entries = await readdir(provenanceRoot, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && RECEIPT_FILE_RE.test(entry.name))
        .map((entry) => path.join(provenanceRoot, entry.name))
        .sort((a, b) => {
            const ai = parseReceiptCycleIndexFromName(path.basename(a)) ?? 0;
            const bi = parseReceiptCycleIndexFromName(path.basename(b)) ?? 0;
            return ai - bi;
        });
}

export async function loadProvenanceReceipts(provenanceRoot = DEFAULT_PROVENANCE_ROOT) {
    const files = await listReceiptFiles(provenanceRoot);
    const receipts = [];

    for (const filePath of files) {
        const receipt = await readJson(filePath);
        receipts.push({
            file_path: filePath,
            file_name: basename(filePath),
            receipt,
        });
    }

    return receipts;
}

export function buildProvenanceDigest({
    loadedReceipts,
    provenanceRoot = DEFAULT_PROVENANCE_ROOT,
} = {}) {
    const rows = asArray(loadedReceipts)
        .filter((entry) => isObject(entry?.receipt))
        .map((entry) => {
            const receipt = entry.receipt;
            return {
                file_name: entry.file_name ?? basename(entry.file_path ?? ""),
                file_path: entry.file_path ?? null,
                cycle_index:
                    receipt?.cycle?.cycle_index ??
                    parseReceiptCycleIndexFromName(entry.file_name ?? "") ??
                    null,
                cycle_dir: receipt?.cycle?.cycle_dir ?? null,
                run_label: receipt?.cycle?.run_label ?? null,
                stream_id: receipt?.scope?.stream_id ?? null,
                source_mode: receipt?.scope?.source_mode ?? null,
                source_id: receipt?.scope?.source_id ?? null,
                channel: receipt?.scope?.channel ?? null,
                modality: receipt?.scope?.modality ?? null,
                state_count: receipt?.structural_summary?.state_count ?? 0,
                basin_count: receipt?.structural_summary?.basin_count ?? 0,
                segment_count: receipt?.structural_summary?.segment_count ?? 0,
                convergence: receipt?.structural_summary?.convergence ?? "unknown",
                motion: receipt?.structural_summary?.motion ?? "unknown",
                occupancy: receipt?.structural_summary?.occupancy ?? "unknown",
                recurrence: receipt?.structural_summary?.recurrence ?? "unknown",
                continuity: receipt?.structural_summary?.continuity ?? "unknown",
                cross_run_available: !!receipt?.cross_run_context?.available,
                cross_run_count: receipt?.cross_run_context?.run_count ?? 0,
                live_cycle_dir: receipt?.references?.live_cycle_dir ?? null,
            };
        });

    const timeline = sortTimelineRows(rows);

    let state_count_changed_count = 0;
    let recurrence_changed_count = 0;
    let convergence_changed_count = 0;
    let stream_switch_count = 0;

    for (let i = 1; i < timeline.length; i += 1) {
        const prev = timeline[i - 1];
        const cur = timeline[i];

        if (cur.state_count !== prev.state_count) state_count_changed_count += 1;
        if (cur.recurrence !== prev.recurrence) recurrence_changed_count += 1;
        if (cur.convergence !== prev.convergence) convergence_changed_count += 1;
        if (cur.stream_id !== prev.stream_id) stream_switch_count += 1;
    }

    return {
        digest_type: "runtime:door_one_live_provenance_digest",
        digest_version: "0.1.0",
        generated_from:
            "Door One durable structural provenance receipts only; derived replay/digest surface, not canon, not promotion",
        written_at: new Date().toISOString(),
        scope: {
            provenance_root: provenanceRoot,
            receipt_count: timeline.length,
            cycle_index_min:
                timeline.length > 0 ? Math.min(...timeline.map((r) => Number(r.cycle_index ?? 0))) : null,
            cycle_index_max:
                timeline.length > 0 ? Math.max(...timeline.map((r) => Number(r.cycle_index ?? 0))) : null,
            run_labels: uniqSorted(timeline.map((r) => r.run_label)),
            source_modes: uniqSorted(timeline.map((r) => r.source_mode)),
            stream_ids: uniqSorted(timeline.map((r) => r.stream_id)),
        },
        aggregates: {
            recurrence_counts: countBy(timeline.map((r) => r.recurrence)),
            convergence_counts: countBy(timeline.map((r) => r.convergence)),
            motion_counts: countBy(timeline.map((r) => r.motion)),
            occupancy_counts: countBy(timeline.map((r) => r.occupancy)),
            continuity_counts: countBy(timeline.map((r) => r.continuity)),
            source_mode_counts: countBy(timeline.map((r) => r.source_mode)),
        },
        changes: {
            state_count_changed_count,
            recurrence_changed_count,
            convergence_changed_count,
            stream_switch_count,
        },
        timelines: {
            cycle_rows: timeline.map((row) => clone(row)),
        },
        references: {
            durable_surface: `${provenanceRoot}/receipt_cycle_*.json`,
            receipt_files: timeline.map((r) => r.file_name),
            latest_live_dir: "./out_live",
            latest_workbench: "./out_live/latest_workbench.json",
            latest_run_result: "./out_live/latest_run_result.json",
            latest_cross_run_report: "./out_live/latest_cross_run_report.json",
            latest_session_summary: "./out_live/session_summary.json",
        },
    };
}

export async function writeProvenanceDigest({
    provenanceRoot = DEFAULT_PROVENANCE_ROOT,
    digest,
    filename = DEFAULT_DIGEST_FILENAME,
} = {}) {
    await mkdir(provenanceRoot, { recursive: true });
    const filePath = path.join(provenanceRoot, filename);
    await writeJson(filePath, digest);
    return filePath;
}

export async function runProvenanceDigest({
    provenanceRoot = DEFAULT_PROVENANCE_ROOT,
    filename = DEFAULT_DIGEST_FILENAME,
} = {}) {
    const loadedReceipts = await loadProvenanceReceipts(provenanceRoot);
    const digest = buildProvenanceDigest({
        loadedReceipts,
        provenanceRoot,
    });

    const filePath = await writeProvenanceDigest({
        provenanceRoot,
        digest,
        filename,
    });

    return {
        ok: true,
        digest,
        file_path: filePath,
        receipt_count: digest?.scope?.receipt_count ?? 0,
    };
}

async function main() {
    const res = await runProvenanceDigest({
        provenanceRoot: process.env.DOOR_ONE_PROVENANCE_ROOT ?? DEFAULT_PROVENANCE_ROOT,
        filename: process.env.DOOR_ONE_PROVENANCE_DIGEST_FILENAME ?? DEFAULT_DIGEST_FILENAME,
    });

    console.log("");
    console.log("Door One Provenance Digest");
    console.log(`  receipts: ${res.receipt_count}`);
    console.log(`  file: ${res.file_path}`);
    console.log(`  cycles: ${res.digest?.scope?.cycle_index_min ?? "-"} -> ${res.digest?.scope?.cycle_index_max ?? "-"}`);
    console.log(`  recurrence counts: ${JSON.stringify(res.digest?.aggregates?.recurrence_counts ?? {})}`);
    console.log(`  convergence counts: ${JSON.stringify(res.digest?.aggregates?.convergence_counts ?? {})}`);
    console.log("");
}

const thisFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFilePath) {
    main().catch((err) => {
        console.error("Door One provenance digest failed.");
        console.error(err);
        process.exit(1);
    });
}
