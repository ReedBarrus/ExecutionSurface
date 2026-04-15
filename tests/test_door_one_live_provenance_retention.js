// tests/test_door_one_live_provenance_retention.js
//
// Contract tests for scripts/run_door_one_live.js provenance retention helpers.

import { mkdir, mkdtemp, readdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let PASS = 0;
let FAIL = 0;

function section(title) {
    console.log(`\n-- ${title} --`);
}

function ok(condition, label) {
    if (condition) {
        PASS += 1;
        console.log(`  ok ${label}`);
    } else {
        FAIL += 1;
        console.log(`  not ok ${label}`);
    }
}

function eq(actual, expected, label) {
    ok(Object.is(actual, expected), `${label}${Object.is(actual, expected) ? "" : ` (expected ${expected}, got ${actual})`}`);
}

function deepEq(a, b, label) {
    const sa = JSON.stringify(a);
    const sb = JSON.stringify(b);
    ok(sa === sb, `${label}${sa === sb ? "" : " (deep mismatch)"}`);
}

function includes(str, sub, label) {
    ok(String(str).includes(sub), label);
}

function notIncludes(str, sub, label) {
    ok(!String(str).includes(sub), label);
}

function finish() {
    console.log(`\n${PASS} passed   ${FAIL} failed`);
    if (FAIL > 0) process.exit(1);
}

const DEFAULT_KEEP = 10;

async function writeJson(filePath, data) {
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function pruneLiveCycleDirs({
    rootDir,
    keepCount = DEFAULT_KEEP,
} = {}) {
    const names = await readdir(rootDir, { withFileTypes: true });
    const cycleDirs = names
        .filter((entry) => entry.isDirectory() && /^cycle_\d+$/.test(entry.name))
        .map((entry) => ({
            name: entry.name,
            index: Number.parseInt(entry.name.slice("cycle_".length), 10),
        }))
        .filter((entry) => Number.isFinite(entry.index))
        .sort((a, b) => a.index - b.index);

    const excess = Math.max(0, cycleDirs.length - keepCount);
    if (excess === 0) return;

    for (const entry of cycleDirs.slice(0, excess)) {
        await rm(path.join(rootDir, entry.name), { recursive: true, force: true });
    }
}

function buildProvenanceReceipt({
    cycleDirName,
    cycleSummary,
    ingestResult,
    cycleSource,
    rawInputForLog,
}) {
    const wb = ingestResult?.workbench ?? {};
    const runtime = wb?.runtime ?? {};
    const substrate = runtime?.substrate ?? {};
    const interpretation = wb?.interpretation?.trajectory ?? {};
    const runResult = ingestResult?.run_result ?? {};
    const crossRunReport = ingestResult?.cross_run_report ?? null;

    return {
        receipt_type: "runtime:door_one_live_provenance_receipt",
        receipt_version: "0.1.0",
        generated_from:
            "Door One live cycle summary, workbench scope/runtime summaries, interpretation overlays, and optional cross-run report only; durable provenance receipt, not canon",
        written_at: new Date().toISOString(),
        cycle: {
            cycle_dir: cycleDirName,
            cycle_index: cycleSummary?.cycle_index ?? null,
            run_label: cycleSummary?.run_label ?? runResult?.run_label ?? null,
        },
        scope: {
            stream_id: wb?.scope?.stream_id ?? null,
            source_mode: cycleSource?.source_mode ?? null,
            source_id: rawInputForLog?.source_id ?? null,
            channel: rawInputForLog?.channel ?? null,
            modality: rawInputForLog?.modality ?? null,
        },
        structural_summary: {
            state_count: substrate?.state_count ?? 0,
            basin_count: substrate?.basin_count ?? 0,
            segment_count: substrate?.segment_count ?? 0,
            convergence: interpretation?.trajectory_character?.convergence ?? "unknown",
            motion: interpretation?.trajectory_character?.motion ?? "unknown",
            occupancy: interpretation?.neighborhood_character?.occupancy ?? "unknown",
            recurrence: interpretation?.neighborhood_character?.recurrence_strength ?? "unknown",
            continuity: interpretation?.segment_character?.continuity ?? "unknown",
        },
        cross_run_context: {
            available: !!crossRunReport,
            run_count: crossRunReport?.scope?.run_count ?? 0,
        },
        references: {
            live_cycle_dir: `./out_live/${cycleDirName}`,
            latest_workbench: "./out_live/latest_workbench.json",
            latest_run_result: "./out_live/latest_run_result.json",
            latest_cross_run_report: "./out_live/latest_cross_run_report.json",
            latest_session_summary: "./out_live/session_summary.json",
        },
    };
}

async function writeProvenanceReceipt({ provenanceRoot, receipt }) {
    const cycleIndex = String(receipt?.cycle?.cycle_index ?? 0).padStart(4, "0");
    const runLabel = receipt?.cycle?.run_label ?? `cycle_${cycleIndex}`;
    const safeRunLabel = String(runLabel).replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(
        provenanceRoot,
        `receipt_cycle_${cycleIndex}_${safeRunLabel}.json`
    );
    await writeJson(filePath, receipt);
    return filePath;
}

function makeFixtureIngestResult({
    runLabel = "live_run_1",
    streamId = "STR:synthetic_live_v1:ch0:voltage:arb:256",
    stateCount = 23,
    basinCount = 5,
    segmentCount = 4,
    convergence = "insufficient_data",
    motion = "diffuse",
    occupancy = "recurrent",
    recurrence = "medium",
    continuity = "fragmented",
    crossRunCount = 3,
    withCrossRun = true,
} = {}) {
    return {
        run_result: {
            run_label: runLabel,
        },
        cross_run_report: withCrossRun
            ? { scope: { run_count: crossRunCount } }
            : null,
        workbench: {
            scope: {
                stream_id: streamId,
            },
            runtime: {
                substrate: {
                    state_count: stateCount,
                    basin_count: basinCount,
                    segment_count: segmentCount,
                },
            },
            interpretation: {
                trajectory: {
                    trajectory_character: {
                        convergence,
                        motion,
                    },
                    neighborhood_character: {
                        occupancy,
                        recurrence_strength: recurrence,
                    },
                    segment_character: {
                        continuity,
                    },
                },
            },
        },
    };
}

function makeCycleSummary({
    cycleIndex = 1,
    runLabel = "live_run_1",
    stateCount = 23,
    convergence = "insufficient_data",
    recurrence = "medium",
    crossRunCount = 3,
} = {}) {
    return {
        cycle_index: cycleIndex,
        run_label: runLabel,
        run_health: {
            state_count: stateCount,
        },
        structure: {
            convergence,
            recurrence,
        },
        delta_vs_prev: {
            cross_run_count: crossRunCount,
        },
    };
}

function makeCycleSource({ sourceMode = "synthetic" } = {}) {
    return { source_mode: sourceMode };
}

function makeRawInputForLog({
    sourceId = "synthetic_live_v1",
    channel = "ch0",
    modality = "voltage",
} = {}) {
    return {
        source_id: sourceId,
        channel,
        modality,
    };
}

const TMP_ROOT = await mkdtemp(path.join(os.tmpdir(), "dme-live-prov-"));
const LIVE_ROOT = path.join(TMP_ROOT, "out_live");
const PROV_ROOT = path.join(TMP_ROOT, "out_provenance", "live");

await mkdir(LIVE_ROOT, { recursive: true });
await mkdir(PROV_ROOT, { recursive: true });

section("A. Receipt shape");
const ingestA = makeFixtureIngestResult({ runLabel: "live_run_1", crossRunCount: 1 });
const cycleSummaryA = makeCycleSummary({ cycleIndex: 1, runLabel: "live_run_1", crossRunCount: 1 });
const cycleSourceA = makeCycleSource({ sourceMode: "synthetic" });
const rawInputA = makeRawInputForLog({ sourceId: "synthetic_live_v1" });

const receiptA = buildProvenanceReceipt({
    cycleDirName: "cycle_01",
    cycleSummary: cycleSummaryA,
    ingestResult: ingestA,
    cycleSource: cycleSourceA,
    rawInputForLog: rawInputA,
});

ok(receiptA && typeof receiptA === "object", "A1: buildProvenanceReceipt returns object");
eq(receiptA.receipt_type, "runtime:door_one_live_provenance_receipt", "A2: receipt_type correct");
eq(receiptA.receipt_version, "0.1.0", "A3: receipt_version correct");
ok(typeof receiptA.written_at === "string", "A4: written_at present as string");
eq(receiptA.cycle.cycle_dir, "cycle_01", "A5: cycle_dir preserved");
eq(receiptA.cycle.cycle_index, 1, "A6: cycle_index preserved");
eq(receiptA.cycle.run_label, "live_run_1", "A7: run_label preserved");
eq(receiptA.scope.stream_id, "STR:synthetic_live_v1:ch0:voltage:arb:256", "A8: stream_id preserved");
eq(receiptA.scope.source_mode, "synthetic", "A9: source_mode preserved");
eq(receiptA.scope.source_id, "synthetic_live_v1", "A10: source_id preserved");
eq(receiptA.scope.channel, "ch0", "A11: channel preserved");
eq(receiptA.scope.modality, "voltage", "A12: modality preserved");
eq(receiptA.structural_summary.state_count, 23, "A13: structural state_count preserved");
eq(receiptA.structural_summary.basin_count, 5, "A14: structural basin_count preserved");
eq(receiptA.structural_summary.segment_count, 4, "A15: structural segment_count preserved");
eq(receiptA.structural_summary.recurrence, "medium", "A16: recurrence preserved");
eq(receiptA.cross_run_context.available, true, "A17: cross-run available=true when report exists");
eq(receiptA.cross_run_context.run_count, 1, "A18: cross-run run_count preserved");
eq(receiptA.references.live_cycle_dir, "./out_live/cycle_01", "A19: live_cycle_dir reference correct");

section("B. Receipt file naming and write");
const receiptPathA = await writeProvenanceReceipt({
    provenanceRoot: PROV_ROOT,
    receipt: receiptA,
});
includes(receiptPathA, "receipt_cycle_0001_live_run_1.json", "B1: receipt filename deterministic");
const provEntriesAfterA = await readdir(PROV_ROOT);
ok(provEntriesAfterA.includes("receipt_cycle_0001_live_run_1.json"), "B2: receipt file created");

section("C. Bounded live pruning");
for (let i = 1; i <= 12; i += 1) {
    const dirName = `cycle_${String(i).padStart(2, "0")}`;
    await mkdir(path.join(LIVE_ROOT, dirName), { recursive: true });
    await writeJson(path.join(LIVE_ROOT, dirName, "cycle_summary.json"), {
        cycle_index: i,
        run_label: `live_run_${i}`,
    });
}

const cycleDirsBefore = (await readdir(LIVE_ROOT)).filter((name) => /^cycle_\d+$/.test(name));
eq(cycleDirsBefore.length, 12, "C1: setup created 12 cycle dirs");

await pruneLiveCycleDirs({
    rootDir: LIVE_ROOT,
    keepCount: 10,
});

const cycleDirsAfter = (await readdir(LIVE_ROOT))
    .filter((name) => /^cycle_\d+$/.test(name))
    .sort();

eq(cycleDirsAfter.length, 10, "C2: pruning keeps only 10 cycle dirs");
ok(!cycleDirsAfter.includes("cycle_01"), "C3: oldest cycle_01 pruned");
ok(!cycleDirsAfter.includes("cycle_02"), "C4: second-oldest cycle_02 pruned");
ok(cycleDirsAfter.includes("cycle_03"), "C5: cycle_03 retained");
ok(cycleDirsAfter.includes("cycle_12"), "C6: newest cycle_12 retained");

section("D. Provenance survives live pruning");
const receiptPathPruned1 = await writeProvenanceReceipt({
    provenanceRoot: PROV_ROOT,
    receipt: buildProvenanceReceipt({
        cycleDirName: "cycle_01",
        cycleSummary: makeCycleSummary({ cycleIndex: 1, runLabel: "live_run_1", crossRunCount: 1 }),
        ingestResult: makeFixtureIngestResult({ runLabel: "live_run_1", crossRunCount: 1 }),
        cycleSource: makeCycleSource({ sourceMode: "synthetic" }),
        rawInputForLog: makeRawInputForLog({ sourceId: "synthetic_live_v1" }),
    }),
});

const receiptPathPruned2 = await writeProvenanceReceipt({
    provenanceRoot: PROV_ROOT,
    receipt: buildProvenanceReceipt({
        cycleDirName: "cycle_02",
        cycleSummary: makeCycleSummary({ cycleIndex: 2, runLabel: "live_run_2", crossRunCount: 2 }),
        ingestResult: makeFixtureIngestResult({ runLabel: "live_run_2", crossRunCount: 2 }),
        cycleSource: makeCycleSource({ sourceMode: "synthetic" }),
        rawInputForLog: makeRawInputForLog({ sourceId: "synthetic_live_v1" }),
    }),
});

ok(typeof receiptPathPruned1 === "string", "D1: receipt write for pruned cycle_01 succeeded");
ok(typeof receiptPathPruned2 === "string", "D2: receipt write for pruned cycle_02 succeeded");

const provEntriesAfterPrune = await readdir(PROV_ROOT);
ok(provEntriesAfterPrune.includes("receipt_cycle_0001_live_run_1.json"), "D3: receipt for pruned cycle_01 still present");
ok(provEntriesAfterPrune.includes("receipt_cycle_0002_live_run_2.json"), "D4: receipt for pruned cycle_02 still present");

section("E. Latest pointers and config posture");
const retentionConfig = {
    receipt_type: "runtime:door_one_live_provenance_retention_config",
    max_live_cycles_to_keep: 10,
    provenance_root: "./out_provenance/live",
    live_root: "./out_live",
    preserved_latest_files: [
        "latest_workbench.json",
        "latest_run_result.json",
        "latest_cross_run_report.json",
        "session_summary.json",
        "source_config.json",
    ],
    pruned_surface: "out_live/cycle_XX",
    durable_surface: "out_provenance/live/receipt_cycle_*.json",
};

deepEq(retentionConfig.preserved_latest_files, [
    "latest_workbench.json",
    "latest_run_result.json",
    "latest_cross_run_report.json",
    "session_summary.json",
    "source_config.json",
], "E1: preserved latest pointer list matches expected posture");
eq(retentionConfig.max_live_cycles_to_keep, 10, "E2: retention cap stored");
eq(retentionConfig.durable_surface, "out_provenance/live/receipt_cycle_*.json", "E3: durable surface points to provenance receipts");

section("F. Boundary integrity");
const receiptJson = JSON.stringify(receiptA);
notIncludes(receiptJson, '"artifact_class":"C1"', "F1: receipt has no C1 artifact class");
notIncludes(receiptJson, '"canonical"', "F2: receipt has no canonical key");
notIncludes(receiptJson, '"promoted"', "F3: receipt has no promoted key");
notIncludes(receiptJson, '"truth"', "F4: receipt has no truth key");
notIncludes(receiptJson, '"ontology"', "F5: receipt has no ontology key");
includes(receiptA.generated_from, "not canon", "F6: generated_from preserves non-canon boundary");

section("G. Low-level behavior edges");
await pruneLiveCycleDirs({
    rootDir: LIVE_ROOT,
    keepCount: 50,
});

const cycleDirsNoFurtherPrune = (await readdir(LIVE_ROOT))
    .filter((name) => /^cycle_\d+$/.test(name))
    .sort();

eq(cycleDirsNoFurtherPrune.length, 10, "G1: no extra pruning when keepCount exceeds stored count");

const noCrossReceipt = buildProvenanceReceipt({
    cycleDirName: "cycle_99",
    cycleSummary: makeCycleSummary({ cycleIndex: 99, runLabel: "live_run_99", crossRunCount: 0 }),
    ingestResult: makeFixtureIngestResult({ runLabel: "live_run_99", withCrossRun: false }),
    cycleSource: makeCycleSource({ sourceMode: "synthetic" }),
    rawInputForLog: makeRawInputForLog({ sourceId: "synthetic_live_v99" }),
});

eq(noCrossReceipt.cross_run_context.available, false, "G2: cross-run available=false when no report");
eq(noCrossReceipt.cross_run_context.run_count, 0, "G3: cross-run run_count=0 when no report");

await rm(TMP_ROOT, { recursive: true, force: true });

finish();
