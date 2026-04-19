// tests/reconstruction/test_provenance_reconstruction_pipeline.js
//
// Contract tests for runtime/reconstruction/ProvenanceReconstructionPipeline.js

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    reconstructFromReplayRequest,
} from "../../runtime/reconstruction/ProvenanceReconstructionPipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

let PASS = 0;
let FAIL = 0;
function section(t) { console.log(`\n-- ${t} --`); }
function ok(cond, label) {
    if (cond) { PASS++; console.log(`  ok ${label}`); }
    else { FAIL++; console.error(`  not ok ${label}`); }
}
function eq(a, b, label) {
    ok(Object.is(a, b), `${label}${Object.is(a, b) ? "" : ` (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`}`);
}
function finish() {
    console.log(`\n${PASS} passed   ${FAIL} failed`);
    if (FAIL > 0) process.exit(1);
}

const MOCK_DECLARED_LENS = {
    transform_family: "FFT/Hann",
    window_N: 256,
    hop_N: 128,
    Fs_target: 256,
};

const TIER0 = {
    tier_used: 0,
    tier_label: "Tier 0 - live working state",
    honest_posture: "Tier 0 only - session-scoped",
};

const TIER1 = {
    tier_used: 1,
    tier_label: "Tier 1 - durable receipts",
    honest_posture: "receipt-backed lineage support only",
};

const TIER2 = {
    tier_used: 2,
    tier_label: "Tier 2 - regenerable digest",
    honest_posture: "declared-only posture",
};

const TIER3 = {
    tier_used: 3,
    tier_label: "Tier 3 - pinned packet",
    honest_posture: "declared-only posture",
};

const TIER4 = {
    tier_used: 4,
    tier_label: "Tier 4 - archive bundle",
    honest_posture: "declared-only posture",
};

const RECEIPT_SUPPORT = {
    receipt_refs: ["receipt_cycle_0001_run.json", "receipt_cycle_0002_run.json"],
    receipt_lineage: ["provenance/live/receipt_cycle_0001_run.json"],
    receipt_count: 2,
    provenance_complete: true,
    replayable_support_present: true,
    lineage_summary: "durable provenance receipt lineage",
};

const BASE_REQUEST = {
    replay_request_id: "RPLY-RT-test-001",
    replay_type: "runtime_reconstruction",
    request_status: "prepared",
    replay_target_type: "current_run_workbench",
    replay_target_ref: "shell.run.test.001",
    source_family: "Synthetic Signal",
    run_label: "shell.run.test.001",
    stream_id: "stream.test.001",
    source_id: "synthetic.test",
    declared_lens: MOCK_DECLARED_LENS,
    retained_tier_used: TIER0,
    support_basis: ["harmonic_state_evidence"],
    explicit_non_claims: ["not canon", "not truth", "not raw restoration"],
    derived_vs_durable: "derived - Tier 0",
};

const VALID_RUN = {
    ok: true,
    run_label: "shell.run.test.001",
    runtime_receipt: {
        receipt_type: "runtime:door_one_orchestrator_receipt",
        stream_id: "stream.test.001",
        source_id: "synthetic.test",
        state_count: 2,
        basin_count: 1,
        segment_count: 1,
        trajectory_frames: 2,
        h1_count: 1,
        m1_count: 1,
        anomaly_count: 0,
        query_present: true,
        skipped_window_count: 0,
        merge_failure_count: 0,
    },
    artifacts: {
        a1: { artifact_class: "A1", stream_id: "stream.test.001" },
        h1s: [{ artifact_class: "H1" }],
        m1s: [{ artifact_class: "M1" }],
        q: { artifact_class: "Q" },
    },
};

const HOLLOW_RUN = {
    ok: true,
    run_label: "shell.run.test.001",
    artifacts: {},
};

const WORKBENCH_ONLY = {
    workbench_receipt: {
        receipt_type: "runtime:door_one_workbench_receipt",
        stream_id: "stream.test.001",
        source_id: "synthetic.test",
        segment_count: 1,
        state_count: 1,
        basin_count: 1,
        query_present: true,
        cross_run_available: false,
        cross_run_run_count: 0,
    },
    scope: { stream_id: "stream.test.001" },
    runtime: { substrate: { state_count: 1 } },
};

section("A. Pipeline source constitutional posture");
{
    const src = await readFile(path.join(ROOT, "runtime/reconstruction/ProvenanceReconstructionPipeline.js"), "utf8");
    ok(src.includes("support-trace reconstruction"), "A1: support-trace class declared");
    ok(src.includes("Tier 0 (live working state): positive path"), "A2: Tier 0 positive path declared");
    ok(src.includes("Tier 1 (durable receipts): positive path"), "A3: Tier 1 positive path declared");
    ok(src.includes("Tier 2-4: explicit downgrade / insufficiency posture only"), "A4: Tier 2-4 downgrade posture declared");
    ok(src.includes("replay_fidelity_record_v0"), "A5: backend emits replay_fidelity_record_v0");
    ok(!src.match(/import.*DoorOneOrchestrator|new DoorOneOrchestrator/), "A6: no orchestrator import/instantiation");
    ok(!src.match(/import.*ConsensusOp|new ConsensusOp/), "A7: no ConsensusOp import/instantiation");
}

section("B. Valid Tier 0 runtime reconstruction");
{
    const r = reconstructFromReplayRequest({
        replayRequest: BASE_REQUEST,
        runResult: VALID_RUN,
        workbench: WORKBENCH_ONLY,
    });

    eq(r.ok, true, "B1: ok = true");
    eq(r.reconstruction_status, "completed", "B2: Tier 0 completes");
    eq(r.threshold_posture.retained_tier_sufficiency, "pass", "B3: Tier 0 sufficiency passes");
    eq(r.threshold_posture.downgrade_output, null, "B4: Tier 0 has no downgrade");
    eq(r.replay_fidelity_record_v0.mechanization_status, "mechanized", "B5: Tier 0 is mechanized");
    eq(r.replay_fidelity_record_v0.retained_tier, TIER0.tier_label, "B6: fidelity record preserves retained tier");
    eq(r.support_summary.runtime.available, true, "B7: runtime support summary available");
    eq(r.reconstruction_receipt.reconstruction_status, "completed", "B8: reconstruction receipt marks completed");
    eq(r.readside_posture.threshold.classCode, "supported", "B9: readside threshold posture is supported");
}

section("C. Valid Tier 1 receipt-backed reconstruction");
{
    const r = reconstructFromReplayRequest({
        replayRequest: {
            ...BASE_REQUEST,
            retained_tier_used: TIER1,
            support_basis: ["durable_receipt_lineage"],
            receipt_support: RECEIPT_SUPPORT,
            derived_vs_durable: "mixed - Tier 1 durable receipt lineage",
        },
        runResult: HOLLOW_RUN,
        workbench: WORKBENCH_ONLY,
    });

    eq(r.ok, true, "C1: ok = true");
    eq(r.reconstruction_status, "completed", "C2: Tier 1 completes");
    eq(r.threshold_posture.retained_tier_sufficiency, "pass", "C3: Tier 1 sufficiency passes");
    eq(r.threshold_posture.downgrade_output, null, "C4: Tier 1 has no downgrade");
    ok(r.support_basis.includes("receipt_cycle_0001_run.json"), "C5: receipt refs enter support basis");
    eq(r.replay_fidelity_record_v0.mechanization_status, "mechanized", "C6: Tier 1 is mechanized");
    eq(r.support_summary.receipts.available, true, "C7: receipt support summary available");
    eq(r.reconstruction_receipt.receipt_support_available, true, "C8: reconstruction receipt notes receipt support");
}

section("D. Tier 0 failure stays explicit");
{
    const r = reconstructFromReplayRequest({
        replayRequest: BASE_REQUEST,
        runResult: HOLLOW_RUN,
        workbench: WORKBENCH_ONLY,
    });

    eq(r.ok, false, "D1: hollow runtime support fails Tier 0 honestly");
    eq(r.reconstruction_status, "failed", "D2: reconstruction_status stays explicit");
    eq(r.replay_fidelity_record_v0.mechanization_status, "failed", "D3: fidelity record marks failure");
    ok(typeof r.failure_posture === "string" && r.failure_posture.length > 0, "D4: failure posture attached");
    eq(r.readside_posture.threshold.classCode, "failed", "D5: readside threshold posture marks failed");
}

for (const tier of [TIER2, TIER3, TIER4]) {
    section(`E. ${tier.tier_label} downgrade posture`);
    const r = reconstructFromReplayRequest({
        replayRequest: {
            ...BASE_REQUEST,
            retained_tier_used: tier,
            support_basis: ["durable_receipt_lineage"],
            receipt_support: RECEIPT_SUPPORT,
            derived_vs_durable: `mixed - ${tier.tier_label}`,
        },
        runResult: VALID_RUN,
        workbench: WORKBENCH_ONLY,
    });

    eq(r.ok, true, `${tier.tier_label}: bounded replay object still returned`);
    eq(r.reconstruction_status, "downgraded", `${tier.tier_label}: status is downgraded`);
    eq(r.threshold_posture.retained_tier_sufficiency, "fail", `${tier.tier_label}: sufficiency fails`);
    eq(r.threshold_posture.downgrade_output, "retained_tier_insufficient", `${tier.tier_label}: downgrade output explicit`);
    eq(r.replay_fidelity_record_v0.mechanization_status, "partially_mechanized", `${tier.tier_label}: fidelity record marks partial mechanization`);
    ok(r.replay_fidelity_record_v0.failure_posture.includes("downgrade/insufficiency"), `${tier.tier_label}: fidelity record carries failure posture`);
    eq(r.readside_posture.threshold.classCode, "insufficient", `${tier.tier_label}: readside posture marks insufficiency`);
}

section("F. Fidelity record shape remains explicit");
{
    const r = reconstructFromReplayRequest({
        replayRequest: BASE_REQUEST,
        runResult: VALID_RUN,
        workbench: WORKBENCH_ONLY,
    });

    const record = r.replay_fidelity_record_v0;
    ok(typeof record === "object" && record !== null, "F1: fidelity record object exists");
    ok("bounded_question" in record, "F2: bounded_question present");
    ok("reconstruction_class" in record, "F3: reconstruction_class present");
    ok("declared_lens" in record, "F4: declared_lens present");
    ok("retained_tier" in record, "F5: retained_tier present");
    ok(Array.isArray(record.support_basis), "F6: support_basis array present");
    ok(Array.isArray(record.reconstruction_trace), "F7: reconstruction_trace array present");
    ok("mechanization_status" in record, "F8: mechanization_status present");
    ok("fidelity_posture" in record, "F9: fidelity_posture present");
    ok("threshold_outcome" in record, "F10: threshold_outcome present");
    ok("downgrade_posture" in record, "F11: downgrade_posture present");
    ok("latency_posture" in record, "F12: latency_posture present");
    ok("reconstruction_summary" in record, "F13: reconstruction_summary present");
    ok(Array.isArray(record.explicit_non_claims), "F14: explicit_non_claims array present");
    ok("failure_posture" in record, "F15: failure_posture present");
    ok("support_summary" in r, "F16: support_summary present on reconstruction output");
    ok("reconstruction_receipt" in r, "F17: reconstruction_receipt present on reconstruction output");
    ok("readside_posture" in r, "F18: readside_posture present on reconstruction output");
}

finish();
