// tests/test_cross_run_session.js
//
// Contract tests for runtime/CrossRunSession.js
//
// Scope:
//   - session shape
//   - addRun validation
//   - storage behavior
//   - compareAll / compare behavior
//   - mutation safety
//   - boundary integrity
//
// Boundary contract:
//   - thin runtime session manager only
//   - stores completed orchestrator runs
//   - delegates cross-run comparison to CrossRunDynamicsReport
//   - does not perform promotion/canon logic
//   - deterministic for identical stored runs and compare calls

import { DoorOneOrchestrator } from "../runtime/DoorOneOrchestrator.js";
import { CrossRunSession } from "../runtime/CrossRunSession.js";
import { makeTestSignal } from "../fixtures/test_signal.js";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal test harness
// ─────────────────────────────────────────────────────────────────────────────

let PASS = 0;
let FAIL = 0;

function section(title) {
    console.log(`\n── ${title} ──`);
}

function ok(condition, label) {
    if (condition) {
        PASS += 1;
        console.log(`  ✓ ${label}`);
    } else {
        FAIL += 1;
        console.log(`  ✗ ${label}`);
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
    console.log("\n══════════════════════════════════════════════════════");
    console.log(`  ${PASS} passed   ${FAIL} failed`);
    console.log(FAIL === 0 ? "  ALL TESTS PASSED ✓" : "  TESTS FAILED ✗");
    if (FAIL > 0) process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixture setup
// ─────────────────────────────────────────────────────────────────────────────

const BASE_POLICIES = {
    clock_policy_id: "clock.synthetic.v1",

    ingest_policy: {
        policy_id: "ingest.synthetic.v1",
        gap_threshold_multiplier: 3.0,
        allow_non_monotonic: false,
        allow_empty: false,
        non_monotonic_mode: "reject",
    },

    grid_spec: {
        Fs_target: 8,
        t_ref: 0,
        grid_policy: "strict",
        drift_model: "none",
        non_monotonic_policy: "reject",
        interp_method: "linear",
        gap_policy: "interpolate_small",
        small_gap_multiplier: 3.0,
        max_gap_seconds: null,
        anti_alias_filter: false,
    },

    window_spec: {
        mode: "fixed",
        Fs_target: 8,
        base_window_N: 8,
        hop_N: 4,
        window_function: "hann",
        overlap_ratio: 0.5,
        stationarity_policy: "tolerant",
        salience_policy: "off",
        gap_policy: "interpolate_small",
        max_missing_ratio: 0.25,
        boundary_policy: "pad",
    },

    transform_policy: {
        policy_id: "transform.synthetic.v1",
        transform_type: "fft",
        normalization_mode: "forward_1_over_N",
        scaling_convention: "real_input_half_spectrum",
        numeric_policy: "tolerant",
    },

    compression_policy: {
        policy_id: "compress.synthetic.v1",
        selection_method: "topK",
        budget_K: 8,
        maxK: 8,
        include_dc: true,
        invariance_lens: "identity",
        numeric_policy: "tolerant",
        respect_novelty_boundary: true,
        thresholds: {
            max_recon_rmse: 0.25,
            max_energy_residual: 0.25,
            max_band_divergence: 0.30,
        },
    },

    anomaly_policy: {
        policy_id: "anomaly.synthetic.v1",
        invariance_mode: "band_profile",
        divergence_metric: "band_l1",
        threshold_value: 0.15,
        frequency_tolerance_hz: 1.0,
        phase_sensitivity_mode: "strict",
        novelty_min_duration: 0,
        segmentation_mode: "strict",
        dominant_bin_threshold: 0.2,
        new_frequency_threshold: 0.15,
        vanished_frequency_threshold: 0.15,
        energy_shift_threshold: 0.15,
    },

    merge_policy: {
        policy_id: "merge.synthetic.v1",
        adjacency_rule: "time_touching",
        phase_alignment_mode: "clock_delta_rotation",
        weights_mode: "duration",
        novelty_gate: "strict",
        merge_mode: "authoritative",
        grid_tolerance: 0,
    },

    post_merge_compression_policy: {
        policy_id: "merge.compress.synthetic.v1",
        selection_method: "topK",
        budget_K: 8,
        maxK: 8,
        include_dc: true,
        invariance_lens: "identity",
        thresholds: {
            max_recon_rmse: 0.30,
            max_energy_residual: 0.30,
            max_band_divergence: 0.30,
        },
    },

    reconstruct_policy: {
        policy_id: "reconstruct.synthetic.v1",
        output_format: "values",
        fill_missing_bins: "ZERO",
        validate_invariants: true,
        window_compensation: "NONE",
        numeric_policy: "tolerant",
    },

    basin_policy: {
        policy_id: "basin.synthetic.v1",
        similarity_threshold: 0.35,
        min_member_count: 1,
        weight_mode: "duration",
        linkage: "single_link",
    },

    consensus_policy: {
        policy_id: "consensus.synthetic.v1",
        promotion_threshold: 0.8,
        max_energy_drift: 0.1,
        max_band_drift: 0.1,
        coherence_tests: ["energy_invariance", "band_profile_invariance"],
        settlement_mode: "single_node",
    },

    epoch_context: {
        epoch_id: "epoch.synthetic.1",
        t_start: 0,
        t_end: 20,
        settlement_policy_id: "settlement.synthetic.v1",
        consensus_window: 10,
    },
};

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function makePolicies(overrides = {}) {
    const p = clone(BASE_POLICIES);
    for (const [k, v] of Object.entries(overrides)) {
        if (v && typeof v === "object" && !Array.isArray(v) && p[k] && typeof p[k] === "object") {
            p[k] = { ...p[k], ...v };
        } else {
            p[k] = v;
        }
    }
    return p;
}

function makeRawFixture({
    durationSec = 4,
    fs = 8,
    seed = 7,
    noiseStd = 0.01,
    source_id = "crs.probe",
    channel = "ch0",
    modality = "voltage",
    units = "arb",
} = {}) {
    const { signal } = makeTestSignal({
        durationSec,
        fs,
        seed,
        noiseStd,
        source_id,
        channel,
        modality,
        units,
    });

    return {
        timestamps: signal.timestamps,
        values: signal.values,
        stream_id: signal.stream_id,
        source_id: signal.source_id,
        channel: signal.channel,
        modality: signal.modality,
        meta: signal.meta,
        clock_policy_id: BASE_POLICIES.clock_policy_id,
    };
}

function makeQuerySpec(id = "q.crs") {
    return {
        query_id: id,
        kind: "energy_trend",
        mode: "ENERGY",
        scope: { allow_cross_segment: true },
    };
}

function makeQueryPolicy(id = "qp.crs") {
    return {
        policy_id: id,
        scoring: "energy_delta",
        normalization: "none",
        topK: 5,
    };
}

function buildRun({
    runLabel,
    raw,
    policies,
    querySpec,
    queryPolicy,
} = {}) {
    const orch = new DoorOneOrchestrator({
        policies: policies ?? makePolicies(),
        substrate_id: `substrate:${runLabel ?? "run"}`,
    });

    const result = orch.runBatch(
        raw ?? makeRawFixture(),
        {
            query_spec: querySpec ?? makeQuerySpec(runLabel ? `q.${runLabel}` : "q.crs"),
            query_policy: queryPolicy ?? makeQueryPolicy(runLabel ? `qp.${runLabel}` : "qp.crs"),
        }
    );

    result.run_label = runLabel ?? "run";
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build lawful runs
// ─────────────────────────────────────────────────────────────────────────────

const runA = buildRun({
    runLabel: "run_a",
    raw: makeRawFixture({ seed: 7, source_id: "crs.runA" }),
});

const runB = buildRun({
    runLabel: "run_b",
    raw: makeRawFixture({ seed: 7, source_id: "crs.runB" }),
});

const runC = buildRun({
    runLabel: "run_c",
    raw: makeRawFixture({ seed: 19, noiseStd: 0.03, source_id: "crs.runC" }),
    policies: makePolicies({
        anomaly_policy: { threshold_value: 0.08 },
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

section("A. Session shape");

const session = new CrossRunSession({ session_id: "sess.test", max_runs: 2 });

eq(session.session_id, "sess.test", "A1: session_id preserved");
eq(session.max_runs, 2, "A2: max_runs preserved");
deepEq(session.listRuns(), [], "A3: empty listRuns at start");
eq(session.latestRun(), null, "A4: latestRun null at start");
eq(session.latestReport(), null, "A5: latestReport null at start");

section("B. addRun validation");

const bad0 = session.addRun(null);
eq(bad0.ok, false, "B1: addRun(null) -> ok=false");
eq(bad0.error, "INVALID_RUN", "B2: addRun(null) -> INVALID_RUN");

const bad1 = session.addRun({ ok: false, error: "BAD" });
eq(bad1.ok, false, "B3: failed run rejected");
eq(bad1.error, "INVALID_RUN", "B4: failed run -> INVALID_RUN");

const missingInterp = {
    ok: true,
    artifacts: {},
    substrate: {},
    summaries: {},
    audit: {},
};
const bad2 = session.addRun(missingInterp);
eq(bad2.ok, false, "B5: run missing interpretation rejected");
eq(bad2.error, "INVALID_RUN", "B6: run missing interpretation -> INVALID_RUN");

const addA = session.addRun(runA);
eq(addA.ok, true, "B7: addRun(runA) ok");
eq(addA.run_label, "run_a", "B8: addRun uses result.run_label");
eq(addA.run_count, 1, "B9: run_count increments to 1");

const dup = session.addRun(runA);
eq(dup.ok, false, "B10: duplicate label rejected");
eq(dup.error, "DUPLICATE_RUN_LABEL", "B11: duplicate label -> DUPLICATE_RUN_LABEL");

section("C. Storage behavior");

const addB = session.addRun(runB);
eq(addB.ok, true, "C1: addRun(runB) ok");
eq(addB.run_count, 2, "C2: run_count increments to 2");

const listed = session.listRuns();
eq(listed.length, 2, "C3: listRuns returns 2 summaries");
eq(listed[0].run_label, "run_a", "C4: first summary is run_a");
eq(listed[1].run_label, "run_b", "C5: second summary is run_b");
ok(!("result" in listed[0]), "C6: listRuns returns summary, not full result");

const gotA = session.getRun("run_a");
ok(gotA && typeof gotA === "object", "C7: getRun(run_a) returns entry");
eq(gotA.run_label, "run_a", "C8: getRun(run_a) label preserved");

const latestBeforeEvict = session.latestRun();
eq(latestBeforeEvict.run_label, "run_b", "C9: latestRun is newest");

const addC = session.addRun(runC);
eq(addC.ok, true, "C10: addRun(runC) ok");
eq(addC.run_count, 2, "C11: max_runs eviction keeps count at 2");

const listedAfterEvict = session.listRuns();
eq(listedAfterEvict.length, 2, "C12: still only 2 runs stored");
eq(listedAfterEvict[0].run_label, "run_b", "C13: oldest evicted, run_b now first");
eq(listedAfterEvict[1].run_label, "run_c", "C14: newest run_c now second");
eq(session.getRun("run_a"), null, "C15: evicted run_a no longer retrievable");
eq(session.latestRun().run_label, "run_c", "C16: latestRun updated to run_c");

section("D. compareAll / compare");

const emptySession = new CrossRunSession();
const cmpEmpty = emptySession.compareAll();
eq(cmpEmpty.ok, false, "D1: compareAll on empty session -> ok=false");
eq(cmpEmpty.error, "EMPTY_SESSION", "D2: compareAll on empty session -> EMPTY_SESSION");

const cmpAll = session.compareAll();
ok(cmpAll && typeof cmpAll === "object", "D3: compareAll returns object");
eq(cmpAll.report_type, "runtime:cross_run_dynamics_report", "D4: compareAll returns cross-run report");
eq(cmpAll.scope.run_count, 2, "D5: compareAll run_count matches stored runs");
deepEq(cmpAll.scope.run_labels, ["run_b", "run_c"], "D6: compareAll preserves stored order");

const latestReport = session.latestReport();
deepEq(latestReport, cmpAll, "D7: latestReport populated after compareAll");

const cmpSelect = session.compare(["run_c", "run_b"]);
eq(cmpSelect.report_type, "runtime:cross_run_dynamics_report", "D8: compare(selected) returns report");
deepEq(cmpSelect.scope.run_labels, ["run_c", "run_b"], "D9: compare(selected) preserves requested order");

const cmpBad0 = session.compare([]);
eq(cmpBad0.ok, false, "D10: compare([]) -> ok=false");
eq(cmpBad0.error, "INVALID_SELECTION", "D11: compare([]) -> INVALID_SELECTION");

const cmpBad1 = session.compare(["missing"]);
eq(cmpBad1.ok, false, "D12: compare([missing]) -> ok=false");
eq(cmpBad1.error, "UNKNOWN_RUN_LABEL", "D13: compare([missing]) -> UNKNOWN_RUN_LABEL");

section("E. Mutation safety");

const gotB1 = session.getRun("run_b");
gotB1.meta.injected = "mutated";
gotB1.result.substrate.state_count = 999999;

const gotB2 = session.getRun("run_b");
ok(!("injected" in (gotB2.meta ?? {})), "E1: mutating getRun(meta) copy does not affect stored entry");
ok(gotB2.result.substrate.state_count !== 999999, "E2: mutating getRun(result) copy does not affect stored entry");

const rep1 = session.latestReport();
rep1.scope.run_count = 999999;
const rep2 = session.latestReport();
ok(rep2.scope.run_count !== 999999, "E3: mutating latestReport copy does not affect cached report");

section("F. Boundary integrity");

ok(typeof session.addRun === "function", "F1: addRun exists");
ok(typeof session.compareAll === "function", "F2: compareAll exists");
ok(typeof session.compare === "function", "F3: compare exists");

ok(!("promote" in session), "F4: session has no promote()");
ok(!("canonicalize" in session), "F5: session has no canonicalize()");
ok(!("consensus" in session), "F6: session has no consensus()");

const cmpReport = session.compareAll();
const cmpJson = JSON.stringify(session.compareAll());
notIncludes(cmpJson, '"artifact_class":"C1"', "F7: compareAll output has no C1 artifact class");
notIncludes(cmpJson, '"canonical"', "F8: compareAll output has no canonical key");
notIncludes(cmpJson, '"promoted"', "F9: compareAll output has no promoted key");
includes(cmpReport.generated_from, "not canon", "F10: compareAll generated_from preserves boundary denial");

section("G. clear()");

const cleared = session.clear();
eq(cleared.ok, true, "G1: clear() returns ok=true");
deepEq(session.listRuns(), [], "G2: clear() empties run store");
eq(session.latestRun(), null, "G3: clear() resets latestRun");
eq(session.latestReport(), null, "G4: clear() resets latestReport");

finish();