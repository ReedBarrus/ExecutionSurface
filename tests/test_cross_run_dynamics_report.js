// tests/test_cross_run_dynamics_report.js
//
// Contract tests for runtime/CrossRunDynamicsReport.js
//
// Scope:
//   - output shape
//   - direct structural/support signature extraction
//   - pairwise comparison sanity
//   - reproducibility summary
//   - determinism
//   - boundary integrity
//   - failed input handling

import { DoorOneOrchestrator } from "../runtime/DoorOneOrchestrator.js";
import { CrossRunDynamicsReport } from "../runtime/CrossRunDynamicsReport.js";
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

function isOneOf(value, allowed, label) {
    ok(allowed.includes(value), `${label} (${value})`);
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
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
    source_id = "crd.probe",
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

function makeQuerySpec(id = "q.crd") {
    return {
        query_id: id,
        kind: "energy_trend",
        mode: "ENERGY",
        scope: { allow_cross_segment: true },
    };
}

function makeQueryPolicy(id = "qp.crd") {
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
            query_spec: querySpec ?? makeQuerySpec(runLabel ? `q.${runLabel}` : "q.crd"),
            query_policy: queryPolicy ?? makeQueryPolicy(runLabel ? `qp.${runLabel}` : "qp.crd"),
        }
    );

    result.run_label = runLabel ?? "run";
    return result;
}

const runA = buildRun({
    runLabel: "run_a",
    raw: makeRawFixture({ seed: 7, source_id: "crd.runA" }),
});

const runB = buildRun({
    runLabel: "run_b",
    raw: makeRawFixture({ seed: 7, source_id: "crd.runA" }),
});

const runC = buildRun({
    runLabel: "run_c",
    raw: makeRawFixture({ seed: 19, noiseStd: 0.03, source_id: "crd.runC" }),
    policies: makePolicies({
        anomaly_policy: { threshold_value: 0.08 },
    }),
});

const crd = new CrossRunDynamicsReport();
const report = crd.compare([runA, runB, runC]);

section("A. Output shape");
ok(runA?.ok === true, "A1: runA ok");
ok(runB?.ok === true, "A2: runB ok");
ok(runC?.ok === true, "A3: runC ok");
ok(report && typeof report === "object", "A4: compare() returns plain object");
eq(report.report_type, "runtime:cross_run_dynamics_report", "A5: report_type correct");
includes(report.generated_from, "not canon", "A6: generated_from denies canon");
eq(report.comparison_posture, "direct_structural_support_comparison", "A7: comparison posture declared");
eq(report.claim_ceiling, "comparative_support_only", "A8: claim ceiling declared");
ok(Array.isArray(report.per_run_signatures), "A9: per_run_signatures present");
ok(Array.isArray(report.pairwise_comparisons), "A10: pairwise_comparisons present");
ok(report.reproducibility_summary && typeof report.reproducibility_summary === "object", "A11: reproducibility_summary present");
ok(Array.isArray(report.dynamics_flags), "A12: dynamics_flags array present");
ok(Array.isArray(report.notes), "A13: notes array present");

section("B. Direct signature extraction");
eq(report.per_run_signatures.length, 3, "B1: one per-run signature per input run");
const sigA = report.per_run_signatures.find((row) => row.run_label === "run_a");
const sigC = report.per_run_signatures.find((row) => row.run_label === "run_c");
ok(sigA && typeof sigA === "object", "B2: run_a signature present");
ok(sigC && typeof sigC === "object", "B3: run_c signature present");
eq(sigA.comparison_posture, "direct_structural_support_signature", "B4: per-run signature posture declared");
ok(Array.isArray(sigA.signature.h1_band_profile_mean), "B5: H1 band profile mean present");
ok(Array.isArray(sigA.signature.m1_band_profile_mean), "B6: M1 band profile mean present");
ok(Array.isArray(sigA.signature.basin_band_profile_mean), "B7: basin profile mean present");
ok("dominant_frequency_hz_mean" in sigA.signature, "B8: dominant frequency mean present");
ok("state_duration_sec_mean" in sigA.signature, "B9: state duration mean present");
ok("transition_density" in sigA.signature, "B10: transition density present");
ok("recurrence_mean" in sigA.signature, "B11: recurrence mean present");
ok("basin_radius_mean" in sigA.signature, "B12: basin radius mean present");
ok("basin_member_count_mean" in sigA.signature, "B13: basin member-count mean present");
ok("h1_count" in sigA.evidence, "B14: evidence.h1_count present");
ok("m1_count" in sigA.evidence, "B15: evidence.m1_count present");
ok("total_transitions" in sigA.evidence, "B16: evidence.total_transitions present");
ok("novelty_gate_count" in sigA.evidence, "B17: evidence.novelty_gate_count present");
ok("new_frequency_event_count" in sigA.evidence, "B18: evidence.new_frequency_event_count present");
ok("energy_shift_event_count" in sigA.evidence, "B19: evidence.energy_shift_event_count present");

section("C. Pairwise comparison sanity");
eq(report.pairwise_comparisons.length, 3, "C1: 3 pairwise comparisons for 3 runs");
const pairAB = report.pairwise_comparisons.find(
    (row) => (row.run_a === "run_a" && row.run_b === "run_b") || (row.run_a === "run_b" && row.run_b === "run_a")
);
const pairAC = report.pairwise_comparisons.find(
    (row) => (row.run_a === "run_a" && row.run_b === "run_c") || (row.run_a === "run_c" && row.run_b === "run_a")
);
ok(pairAB && typeof pairAB === "object", "C2: pairAB present");
ok(pairAC && typeof pairAC === "object", "C3: pairAC present");
isOneOf(pairAB.similarity, ["low", "medium", "high"], "C4: pairAB similarity label allowed");
eq(pairAB.comparison_posture, "evidence_first_pairwise_comparison", "C5: pairwise comparison posture declared");
ok("h1_band_profile_changed" in pairAB.differences, "C6: pairwise H1 profile change flag present");
ok("basin_profile_changed" in pairAB.differences, "C7: pairwise basin profile change flag present");
ok("similarity_ratio" in pairAB.evidence, "C8: pairwise evidence similarity ratio present");
ok("h1_band_profile_distance" in pairAB.evidence, "C9: pairwise H1 profile distance present");
ok("dominant_frequency_delta" in pairAB.evidence, "C10: dominant frequency delta present");
ok("transition_density_delta" in pairAB.evidence, "C11: transition density delta present");
ok("semantic_summary" in pairAB === false, "C12: semantic summary removed");
ok(
    Number.isFinite(pairAB.evidence.similarity_ratio) &&
    pairAB.evidence.similarity_ratio >= 0 &&
    pairAB.evidence.similarity_ratio <= 1,
    "C13: similarity ratio remains bounded"
);

section("D. Reproducibility summary");
const rs = report.reproducibility_summary;
eq(rs.comparison_posture, "structural_support_reproducibility_summary", "D1: reproducibility posture declared");
isOneOf(rs.count_reproducibility, ["low", "medium", "high", "insufficient_data"], "D2: count reproducibility allowed");
isOneOf(rs.support_profile_reproducibility, ["low", "medium", "high", "insufficient_data"], "D3: support-profile reproducibility allowed");
isOneOf(rs.transition_reproducibility, ["low", "medium", "high", "insufficient_data"], "D4: transition reproducibility allowed");
isOneOf(rs.basin_reproducibility, ["low", "medium", "high", "insufficient_data"], "D5: basin reproducibility allowed");
isOneOf(rs.overall_reproducibility, ["low", "medium", "high", "insufficient_data"], "D6: overall reproducibility allowed");

section("E. Determinism");
const report2 = crd.compare([runA, runB, runC]);
deepEq(report, report2, "E1: identical inputs -> identical report");
const report3 = crd.compare([runA, runB, runC], {
    run_labels: ["alpha", "beta", "gamma"],
});
deepEq(report3.scope.run_labels, ["alpha", "beta", "gamma"], "E2: explicit run_labels override applied");

section("F. Boundary integrity");
const json = JSON.stringify(report);
notIncludes(json, '"artifact_class":"C1"', "F1: no C1 artifact class");
notIncludes(json, '"canonical"', "F2: no canonical key");
notIncludes(json, '"promoted"', "F3: no promoted key");
notIncludes(json, '"prediction"', "F4: no prediction key");
notIncludes(json, '"ontology":', "F5: no ontology key");
notIncludes(json, '"semantic_overlay"', "F6: no semantic overlay dependency");
notIncludes(json, '"interpretation"', "F7: no interpretation dependency");
includes(report.notes.join(" "), "Structural/support evidence is compared directly from runtime objects and substrate reports.", "F8: notes preserve object-first evidence posture");

section("G. Failed input handling");
const fail0 = crd.compare([]);
eq(fail0.ok, false, "G1: empty array rejected");
eq(fail0.error, "INVALID_INPUT", "G2: empty array -> INVALID_INPUT");
const fail1 = crd.compare(null);
eq(fail1.ok, false, "G3: null input rejected");
eq(fail1.error, "INVALID_INPUT", "G4: null input -> INVALID_INPUT");
const fail2 = crd.compare([{ ok: false, error: "BAD" }]);
eq(fail2.ok, false, "G5: invalid run rejected");
eq(fail2.error, "INVALID_RUN", "G6: invalid run -> INVALID_RUN");

section("H. Single-run behavior");
const single = crd.compare([runA]);
eq(single.scope.run_count, 1, "H1: single-run scope.run_count = 1");
eq(single.per_run_signatures.length, 1, "H2: single-run still emits one signature");
eq(single.pairwise_comparisons.length, 0, "H3: single-run emits zero pairwise comparisons");
eq(single.reproducibility_summary.overall_reproducibility, "insufficient_data", "H4: single-run overall reproducibility insufficient_data");

section("I. Evidence-only discipline");
const overlayNoise = clone(runB);
overlayNoise.run_label = "overlay_noise";
overlayNoise.semantic_overlay = {
    trajectory: { convergence: "invented" },
};
overlayNoise.interpretation = {
    trajectory: { continuity: "invented" },
};

const overlayNoiseReport = crd.compare([runA, overlayNoise]);
const baselineReport = crd.compare([runA, runB]);
eq(
    overlayNoiseReport.pairwise_comparisons[0].evidence.similarity_ratio,
    baselineReport.pairwise_comparisons[0].evidence.similarity_ratio,
    "I1: stray interpretation fields do not affect comparison"
);
eq(
    overlayNoiseReport.pairwise_comparisons[0].similarity,
    baselineReport.pairwise_comparisons[0].similarity,
    "I2: stray interpretation fields do not change similarity label"
);

const evidenceOnlyShift = clone(runA);
evidenceOnlyShift.run_label = "evidence_only_shift";
evidenceOnlyShift.artifacts.h1s = [];
evidenceOnlyShift.artifacts.m1s = [];
evidenceOnlyShift.artifacts.anomaly_reports = Array.from({ length: 6 }, (_, idx) => ({
    artifact_class: "An",
    novelty_gate_triggered: idx % 2 === 0,
    detected_events: [{ type: "energy_shift" }],
}));
evidenceOnlyShift.artifacts.q = null;
evidenceOnlyShift.substrate.state_count = 40;
evidenceOnlyShift.substrate.basin_count = 7;
evidenceOnlyShift.substrate.segment_count = 9;
evidenceOnlyShift.substrate.transition_report = {
    ...(evidenceOnlyShift.substrate.transition_report ?? {}),
    total_transitions: 12,
    total_re_entries: 5,
    recurrence: [{ re_entry_count: 5 }],
};

const evidenceFirstReport = crd.compare([runA, evidenceOnlyShift]);
const evidencePair = evidenceFirstReport.pairwise_comparisons[0];
ok(evidencePair.similarity !== "high", "I3: direct structural/support drift is not rounded up to high similarity");
ok(evidencePair.evidence.state_count_delta > 0, "I4: state count drift is exposed");
ok(evidencePair.evidence.energy_shift_event_count_delta > 0, "I5: anomaly event drift is exposed");

finish();
