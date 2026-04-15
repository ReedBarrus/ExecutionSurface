// tests/test_door_one_workbench.js
//
// Contract tests for runtime/DoorOneWorkbench.js

import { DoorOneOrchestrator } from "../runtime/DoorOneOrchestrator.js";
import { CrossRunDynamicsReport } from "../runtime/CrossRunDynamicsReport.js";
import { CrossRunSession } from "../runtime/CrossRunSession.js";
import { DoorOneWorkbench } from "../runtime/DoorOneWorkbench.js";
import { makeTestSignal } from "../fixtures/test_signal.js";

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
    source_id = "wb.probe",
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

function makeQuerySpec(id = "q.wb") {
    return {
        query_id: id,
        kind: "energy_trend",
        mode: "ENERGY",
        scope: { allow_cross_segment: true },
    };
}

function makeQueryPolicy(id = "qp.wb") {
    return {
        policy_id: id,
        scoring: "energy_delta",
        normalization: "none",
        topK: 5,
    };
}

function buildRun({ runLabel, raw, policies } = {}) {
    const orch = new DoorOneOrchestrator({
        policies: policies ?? makePolicies(),
        substrate_id: `substrate:${runLabel ?? "run"}`,
    });

    const result = orch.runBatch(raw ?? makeRawFixture(), {
        query_spec: makeQuerySpec(runLabel ? `q.${runLabel}` : "q.wb"),
        query_policy: makeQueryPolicy(runLabel ? `qp.${runLabel}` : "qp.wb"),
    });

    result.run_label = runLabel ?? "run";
    return result;
}

const runA = buildRun({
    runLabel: "run_a",
    raw: makeRawFixture({ seed: 7, source_id: "wb.runA" }),
});
const runB = buildRun({
    runLabel: "run_b",
    raw: makeRawFixture({ seed: 7, source_id: "wb.runA" }),
});
const runC = buildRun({
    runLabel: "run_c",
    raw: makeRawFixture({ seed: 19, noiseStd: 0.03, source_id: "wb.runC" }),
    policies: makePolicies({
        anomaly_policy: { threshold_value: 0.08 },
    }),
});

const crd = new CrossRunDynamicsReport();
const crossRunReport = crd.compare([runA, runB, runC]);

const session = new CrossRunSession({ session_id: "wb.session", max_runs: 5 });
session.addRun(runA);
session.addRun(runB);
session.addRun(runC);

const workbench = new DoorOneWorkbench();
const wbSingle = workbench.assemble(runA);
const wbCross = workbench.assemble(runA, { crossRunReport });
const wbSession = workbench.assemble(runA, { crossRunSession: session });

section("A. Output shape");
ok(runA?.ok === true, "A1: runA ok");
ok(wbSingle && typeof wbSingle === "object", "A2: assemble() returns plain object");
eq(wbSingle.workbench_type, "runtime:door_one_workbench", "A3: workbench_type correct");
includes(wbSingle.generated_from, "integration view, not canon", "A4: generated_from preserves non-canon boundary");
ok(wbSingle.scope && typeof wbSingle.scope === "object", "A5: scope present");
ok(wbSingle.runtime && typeof wbSingle.runtime === "object", "A6: runtime present");
ok(wbSingle.workbench_receipt && typeof wbSingle.workbench_receipt === "object", "A7: workbench_receipt present");
ok(wbSingle.semantic_overlay && typeof wbSingle.semantic_overlay === "object", "A8: semantic_overlay present");
ok(wbSingle.compatibility_aliases && typeof wbSingle.compatibility_aliases === "object", "A9: compatibility_aliases present");
ok(wbSingle.interpretation && typeof wbSingle.interpretation === "object", "A10: interpretation alias present");
ok(wbSingle.cross_run && typeof wbSingle.cross_run === "object", "A11: cross_run present");
ok(Array.isArray(wbSingle.notes), "A12: notes array present");

section("B. Single-run mode");
eq(wbSingle.scope.stream_id, runA?.artifacts?.a1?.stream_id ?? null, "B1: scope.stream_id preserved");
eq(wbSingle.scope.source_id, runA?.artifacts?.a1?.source_id ?? null, "B2: scope.source_id preserved");
deepEq(wbSingle.scope.segment_ids, runA?.substrate?.segment_ids ?? [], "B3: segment_ids preserved");
eq(wbSingle.scope.cross_run_context.available, false, "B4: single-run cross_run_context.available=false");
eq(wbSingle.scope.cross_run_context.run_count, 0, "B5: single-run cross_run_context.run_count=0");
eq(wbSingle.cross_run.available, false, "B6: single-run cross_run.available=false");
eq(wbSingle.cross_run.report, null, "B7: single-run cross_run.report=null");
ok(wbSingle.semantic_overlay.trajectory && typeof wbSingle.semantic_overlay.trajectory === "object", "B8: semantic_overlay.trajectory present");
ok(wbSingle.semantic_overlay.attention_memory && typeof wbSingle.semantic_overlay.attention_memory === "object", "B9: semantic_overlay.attention_memory present");

section("C. Cross-run mode");
eq(wbCross.scope.cross_run_context.available, true, "C1: cross-run scope.available=true");
eq(wbCross.scope.cross_run_context.run_count, 3, "C2: cross-run scope.run_count=3");
eq(wbCross.cross_run.available, true, "C3: cross_run.available=true");
ok(wbCross.cross_run.report && typeof wbCross.cross_run.report === "object", "C4: cross_run.report present");
eq(wbCross.cross_run.report.report_type, "runtime:cross_run_dynamics_report", "C5: cross_run.report_type correct");

section("D. Cross-run session path");
eq(wbSession.scope.cross_run_context.available, true, "D1: session path scope.available=true");
eq(wbSession.scope.cross_run_context.run_count, 3, "D2: session path scope.run_count=3");
eq(wbSession.cross_run.available, true, "D3: session path cross_run.available=true");
ok(wbSession.cross_run.report && typeof wbSession.cross_run.report === "object", "D4: session path cross_run.report present");
eq(wbSession.cross_run.report.report_type, "runtime:cross_run_dynamics_report", "D5: session path report_type correct");

section("E. Aliases and copies");
ok(wbSingle.runtime.artifacts && typeof wbSingle.runtime.artifacts === "object", "E1: runtime.artifacts present");
ok(wbSingle.runtime.receipt && typeof wbSingle.runtime.receipt === "object", "E2: runtime.receipt present");
ok(wbSingle.runtime.substrate && typeof wbSingle.runtime.substrate === "object", "E3: runtime.substrate present");
ok(wbSingle.runtime.summaries && typeof wbSingle.runtime.summaries === "object", "E4: runtime.summaries present");
ok(wbSingle.runtime.audit && typeof wbSingle.runtime.audit === "object", "E5: runtime.audit present");
ok(wbSingle.compatibility_aliases.interpretation && typeof wbSingle.compatibility_aliases.interpretation === "object", "E6: compatibility_aliases.interpretation present");
deepEq(wbSingle.compatibility_aliases.interpretation, wbSingle.interpretation, "E7: interpretation alias mirrored under compatibility_aliases");
eq(wbSingle.workbench_receipt.state_count, wbSingle.runtime.receipt.state_count, "E8: workbench_receipt state_count mirrors runtime receipt");

section("F. Determinism");
const wbCross2 = workbench.assemble(runA, { crossRunReport });
deepEq(wbCross, wbCross2, "F1: identical inputs -> identical workbench output");

section("G. Mutation safety");
const before = JSON.stringify(runA);
workbench.assemble(runA, { crossRunReport });
eq(JSON.stringify(runA), before, "G1: assemble() does not mutate orchestrator result");

section("H. Boundary integrity");
const json = JSON.stringify(wbCross);
notIncludes(json, '"artifact_class":"C1"', "H1: no C1 artifact class");
notIncludes(json, '"canonical"', "H2: no canonical key");
notIncludes(json, '"promoted"', "H3: no promoted key");
notIncludes(json, '"truth"', "H4: no truth key");
notIncludes(json, '"ontology":', "H5: no ontology key");
includes(wbCross.notes.join(" "), "Workbench is an integration view, not canon.", "H6: note preserves non-canon boundary");
includes(wbCross.notes.join(" "), "Structural runtime remains the primary workbench section.", "H7: note preserves structural primacy");
includes(wbCross.notes.join(" "), "Semantic overlay remains removable", "H8: note preserves overlay removability");

section("I. Failed input handling");
const bad0 = workbench.assemble(null);
eq(bad0.ok, false, "I1: null input -> ok=false");
eq(bad0.error, "INVALID_INPUT", "I2: null input -> INVALID_INPUT");
ok(Array.isArray(bad0.reasons), "I3: null input -> reasons array");

const bad1 = workbench.assemble({ ok: false, error: "BAD" });
eq(bad1.ok, false, "I4: failed result -> ok=false");
eq(bad1.error, "INVALID_INPUT", "I5: failed result -> INVALID_INPUT");

finish();
