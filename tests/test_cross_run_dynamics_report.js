// tests/test_cross_run_dynamics_report.js
//
// Contract tests for runtime/CrossRunDynamicsReport.js
//
// Scope:
//   - output shape
//   - per-run signature extraction
//   - pairwise comparison sanity
//   - reproducibility summary
//   - determinism
//   - boundary integrity
//   - failed input handling
//
// Boundary contract:
//   - derived / observational comparison only
//   - no canon, no promotion, no prediction, no ontology claims
//   - consumes completed DoorOneOrchestrator results
//   - deterministic given identical input runs
//
// References:
//   - runtime/CrossRunDynamicsReport.js
//   - runtime/DoorOneOrchestrator.js
//   - runtime/TrajectoryInterpretationReport.js
//   - runtime/AttentionMemoryReport.js

import { DoorOneOrchestrator } from "../runtime/DoorOneOrchestrator.js";
import { CrossRunDynamicsReport } from "../runtime/CrossRunDynamicsReport.js";
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

function isOneOf(value, allowed, label) {
    ok(allowed.includes(value), `${label} (${value})`);
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

// ─────────────────────────────────────────────────────────────────────────────
// Build three lawful runs
// ─────────────────────────────────────────────────────────────────────────────

const runA = buildRun({
    runLabel: "run_a",
    raw: makeRawFixture({ seed: 7, source_id: "crd.runA" }),
    policies: makePolicies(),
});

const runB = buildRun({
    runLabel: "run_b",
    raw: makeRawFixture({ seed: 7, source_id: "crd.runA" }), // same seed/source for close similarity
    policies: makePolicies(),
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

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

section("A. Output shape");
ok(runA?.ok === true, "A1: runA ok");
ok(runB?.ok === true, "A2: runB ok");
ok(runC?.ok === true, "A3: runC ok");
ok(report && typeof report === "object", "A4: compare() returns plain object");
eq(report.report_type, "runtime:cross_run_dynamics_report", "A5: report_type correct");
includes(report.generated_from, "not canon", "A6: generated_from denies canon");
eq(report.comparison_posture, "evidence_first_cross_run_comparison", "A6b: report comparison_posture declared");
eq(report.claim_ceiling, "comparative_support_only", "A6c: report claim_ceiling declared");
ok(report.scope && typeof report.scope === "object", "A7: scope present");
eq(report.scope.run_count, 3, "A8: scope.run_count = 3");
deepEq(report.scope.run_labels, ["run_a", "run_b", "run_c"], "A9: scope.run_labels preserved");
ok(Array.isArray(report.scope.stream_ids), "A10: scope.stream_ids is array");
ok(Array.isArray(report.per_run_signatures), "A11: per_run_signatures is array");
ok(Array.isArray(report.pairwise_comparisons), "A12: pairwise_comparisons is array");
ok(report.reproducibility_summary && typeof report.reproducibility_summary === "object", "A13: reproducibility_summary present");
ok(Array.isArray(report.dynamics_flags), "A14: dynamics_flags array present");
ok(Array.isArray(report.notes), "A15: notes array present");

section("B. Per-run signature extraction");
eq(report.per_run_signatures.length, 3, "B1: one per-run signature per input run");

const sigA = report.per_run_signatures.find(r => r.run_label === "run_a");
const sigB = report.per_run_signatures.find(r => r.run_label === "run_b");
const sigC = report.per_run_signatures.find(r => r.run_label === "run_c");

ok(sigA && typeof sigA === "object", "B2: run_a signature present");
ok(sigB && typeof sigB === "object", "B3: run_b signature present");
ok(sigC && typeof sigC === "object", "B4: run_c signature present");

ok(sigA.signature && typeof sigA.signature === "object", "B5: signature block present");
ok(sigA.evidence && typeof sigA.evidence === "object", "B6: evidence block present");
eq(sigA.comparison_posture, "structural_support_signature_with_subordinate_semantic_summary", "B6b: per-run signature posture declared");
eq(sigA.claim_ceiling, "comparative_support_only", "B6c: per-run signature claim ceiling declared");

ok("convergence" in sigA.signature, "B7: signature.convergence present");
ok("motion" in sigA.signature, "B8: signature.motion present");
ok("occupancy" in sigA.signature, "B9: signature.occupancy present");
ok("continuity" in sigA.signature, "B10: signature.continuity present");
ok("attention_concentration" in sigA.signature, "B11: signature.attention_concentration present");
ok("memory_stability" in sigA.signature, "B12: signature.memory_stability present");
ok("support_persistence" in sigA.signature, "B13: signature.support_persistence present");
ok("reuse_pressure" in sigA.signature, "B13b: signature.reuse_pressure present");
ok("memory_candidate_posture" in sigA.signature, "B13c: signature.memory_candidate_posture present");
ok(!("pre_commitment" in sigA.signature), "B13d: signature no longer depends on pre_commitment");

ok("state_count" in sigA.evidence, "B14: evidence.state_count present");
ok("basin_count" in sigA.evidence, "B15: evidence.basin_count present");
ok("segment_count" in sigA.evidence, "B16: evidence.segment_count present");
ok("total_transitions" in sigA.evidence, "B17: evidence.total_transitions present");
ok("total_re_entries" in sigA.evidence, "B18: evidence.total_re_entries present");
ok("dominant_dwell_share" in sigA.evidence, "B19: evidence.dominant_dwell_share present");
ok("transition_density_value" in sigA.evidence, "B20: evidence.transition_density_value present");
ok("h1_count" in sigA.evidence, "B21: evidence.h1_count present");
ok("m1_count" in sigA.evidence, "B22: evidence.m1_count present");
ok("anomaly_count" in sigA.evidence, "B23: evidence.anomaly_count present");
ok("query_present" in sigA.evidence, "B24: evidence.query_present present");

section("C. Pairwise comparison sanity");
eq(report.pairwise_comparisons.length, 3, "C1: 3 pairwise comparisons for 3 runs");

const pairAB = report.pairwise_comparisons.find(
    r => (r.run_a === "run_a" && r.run_b === "run_b") || (r.run_a === "run_b" && r.run_b === "run_a")
);
const pairAC = report.pairwise_comparisons.find(
    r => (r.run_a === "run_a" && r.run_b === "run_c") || (r.run_a === "run_c" && r.run_b === "run_a")
);

ok(pairAB && typeof pairAB === "object", "C2: pairwise run_a/run_b present");
ok(pairAC && typeof pairAC === "object", "C3: pairwise run_a/run_c present");

isOneOf(pairAB.similarity, ["low", "medium", "high"], "C4: pairAB similarity label allowed");
eq(pairAB.comparison_posture, "evidence_first_pairwise_comparison", "C4b: pairwise comparison posture declared");
eq(pairAB.claim_ceiling, "comparative_support_only", "C4c: pairwise claim ceiling declared");
ok(pairAB.differences && typeof pairAB.differences === "object", "C5: pairAB differences block present");
ok(pairAB.evidence && typeof pairAB.evidence === "object", "C6: pairAB evidence block present");
ok(pairAB.semantic_summary && typeof pairAB.semantic_summary === "object", "C6b: pairAB semantic_summary present");

ok("convergence_changed" in pairAB.differences, "C7: pairAB differences.convergence_changed present");
ok("motion_changed" in pairAB.differences, "C8: pairAB differences.motion_changed present");
ok("occupancy_changed" in pairAB.differences, "C9: pairAB differences.occupancy_changed present");
ok("continuity_changed" in pairAB.differences, "C10: pairAB differences.continuity_changed present");
ok("attention_shift" in pairAB.differences, "C11: pairAB differences.attention_shift present");
ok("memory_shift" in pairAB.differences, "C12: pairAB differences.memory_shift present");

ok("shared_labels" in pairAB.evidence, "C13: pairAB evidence.shared_labels present");
ok("differing_labels" in pairAB.evidence, "C14: pairAB evidence.differing_labels present");
ok("similarity_ratio" in pairAB.evidence, "C15: pairAB evidence.similarity_ratio present");
ok("semantic_similarity_ratio" in pairAB.evidence, "C16: pairAB evidence.semantic_similarity_ratio present");
ok("segment_count_delta" in pairAB.evidence, "C17: pairAB evidence.segment_count_delta present");
ok("dominant_dwell_share_delta" in pairAB.evidence, "C18: pairAB evidence.dominant_dwell_share_delta present");
ok("transition_density_delta" in pairAB.evidence, "C19: pairAB evidence.transition_density_delta present");

ok(
    Number.isFinite(pairAB.evidence.similarity_ratio) &&
    pairAB.evidence.similarity_ratio >= 0 &&
    pairAB.evidence.similarity_ratio <= 1,
    "C20: pairAB similarity_ratio in [0,1]"
);
ok(
    pairAB.semantic_summary.subordinate_to_evidence === true,
    "C21: semantic summary explicitly subordinate to evidence"
);

section("D. Reproducibility summary");
const rs = report.reproducibility_summary;
eq(rs.comparison_posture, "evidence_first_reproducibility_summary", "D0: reproducibility comparison_posture declared");
eq(rs.claim_ceiling, "comparative_support_only", "D0b: reproducibility claim ceiling declared");
isOneOf(rs.structural_reproducibility, ["low", "medium", "high", "insufficient_data"], "D0c: structural reproducibility allowed");
isOneOf(rs.convergence_reproducibility, ["low", "medium", "high", "insufficient_data"], "D1: convergence reproducibility allowed");
isOneOf(rs.neighborhood_reproducibility, ["low", "medium", "high", "insufficient_data"], "D2: neighborhood reproducibility allowed");
isOneOf(rs.segment_reproducibility, ["low", "medium", "high", "insufficient_data"], "D3: segment reproducibility allowed");
isOneOf(rs.overlay_reproducibility, ["low", "medium", "high", "insufficient_data"], "D4: overlay reproducibility allowed");
isOneOf(rs.overall_reproducibility, ["low", "medium", "high", "insufficient_data"], "D5: overall reproducibility allowed");

section("E. Determinism");
const report2 = crd.compare([runA, runB, runC]);
deepEq(report, report2, "E1: identical input runs -> identical cross-run report");

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
notIncludes(json, '"forecast"', "F5: no forecast language");
notIncludes(json, '"true basin"', "F6: no true basin claim");
notIncludes(json, '"attractor basin"', "F7: no attractor basin language");
notIncludes(json, '"trusted"', "F8: no trusted authority language");
notIncludes(json, '"ontology":', "F9: no ontology key");

includes(report.generated_from, "not canon", "F10: generated_from denies canon");
includes(report.generated_from, "not promotion", "F11: generated_from denies promotion");
includes(report.generated_from, "not ontology", "F12: generated_from denies ontology");

ok(
    report.notes.some(n => n.includes("Similarity and reproducibility do not by themselves justify canon or promotion.")),
    "F13: notes preserve no-canon/no-promotion boundary"
);
ok(
    report.notes.some(n => n.includes("Repeated structure strengthens evidence but does not prove ontology or true dynamical basin membership.")),
    "F14: notes preserve no-ontology/no-true-basin boundary"
);
ok(
    report.notes.some(n => n.includes("Structural/support evidence is compared first")),
    "F15: notes preserve evidence-first comparison boundary"
);
ok(
    report.notes.some(n => n.includes("same-object continuity, memory closure, or identity closure")),
    "F16: notes preserve anti-closure boundary"
);

section("G. Failed input handling");
const fail0 = crd.compare([]);
eq(fail0.ok, false, "G1: empty array -> ok=false");
eq(fail0.error, "INVALID_INPUT", "G2: empty array -> INVALID_INPUT");
ok(Array.isArray(fail0.reasons), "G3: empty array -> reasons array");

const fail1 = crd.compare(null);
eq(fail1.ok, false, "G4: null input -> ok=false");
eq(fail1.error, "INVALID_INPUT", "G5: null input -> INVALID_INPUT");

const fail2 = crd.compare([{ ok: false, error: "BAD" }]);
eq(fail2.ok, false, "G6: invalid run -> ok=false");
eq(fail2.error, "INVALID_RUN", "G7: invalid run -> INVALID_RUN");
ok(Array.isArray(fail2.reasons), "G8: invalid run -> reasons array");

section("H. Single-run behavior");
const single = crd.compare([runA]);
eq(single.scope.run_count, 1, "H1: single-run scope.run_count = 1");
eq(single.per_run_signatures.length, 1, "H2: single-run still emits one signature");
eq(single.pairwise_comparisons.length, 0, "H3: single-run emits zero pairwise comparisons");
eq(single.reproducibility_summary.overall_reproducibility, "insufficient_data", "H4: single-run overall reproducibility insufficient_data");

section("I. Evidence-first restraint");
const semanticOnlyShift = clone(runB);
semanticOnlyShift.run_label = "semantic_only_shift";
semanticOnlyShift.semantic_overlay = clone(runA.semantic_overlay ?? {});
semanticOnlyShift.interpretation = clone(runA.interpretation ?? {});
semanticOnlyShift.semantic_overlay = semanticOnlyShift.semantic_overlay ?? {};
semanticOnlyShift.semantic_overlay.trajectory = clone(
    semanticOnlyShift.semantic_overlay.trajectory ?? semanticOnlyShift.interpretation?.trajectory ?? {}
);
semanticOnlyShift.semantic_overlay.trajectory.trajectory_character = {
    ...(semanticOnlyShift.semantic_overlay.trajectory.trajectory_character ?? {}),
    convergence: "shifted_convergence",
    motion: "shifted_motion",
};
semanticOnlyShift.semantic_overlay.trajectory.segment_character = {
    ...(semanticOnlyShift.semantic_overlay.trajectory.segment_character ?? {}),
    continuity: "shifted_continuity",
};

const semanticFirstReport = crd.compare([runA, semanticOnlyShift]);
const semanticPair = semanticFirstReport.pairwise_comparisons[0];
ok(
    semanticPair.evidence.similarity_ratio >= semanticPair.evidence.semantic_similarity_ratio,
    "I1: strong structural evidence is not lowered below weaker semantic label similarity"
);
eq(semanticPair.similarity, "high", "I2: semantic-only divergence does not collapse evidence-led similarity");

const evidenceOnlyShift = clone(runA);
evidenceOnlyShift.run_label = "evidence_only_shift";
evidenceOnlyShift.artifacts = clone(runA.artifacts);
evidenceOnlyShift.substrate = clone(runA.substrate);
evidenceOnlyShift.artifacts.h1s = [];
evidenceOnlyShift.artifacts.m1s = [];
evidenceOnlyShift.artifacts.anomaly_reports = Array.from({ length: 6 }, (_, idx) => ({ artifact_class: "An", id: `an.${idx}` }));
evidenceOnlyShift.artifacts.q = null;
evidenceOnlyShift.substrate.state_count = 40;
evidenceOnlyShift.substrate.basin_count = 7;
evidenceOnlyShift.substrate.segment_count = 9;
evidenceOnlyShift.substrate.transition_report = {
    ...(evidenceOnlyShift.substrate.transition_report ?? {}),
    total_transitions: 12,
    total_re_entries: 5,
};

const evidenceFirstReport = crd.compare([runA, evidenceOnlyShift]);
const evidencePair = evidenceFirstReport.pairwise_comparisons[0];
ok(
    evidencePair.evidence.semantic_similarity_ratio > evidencePair.evidence.similarity_ratio,
    "I3: semantic similarity can exceed evidence similarity without taking precedence"
);
ok(
    evidencePair.similarity !== "high",
    "I4: label-space agreement does not round weak evidence upward to high similarity"
);
ok(
    evidencePair.semantic_summary.caution_posture === "semantic_similarity_narrowed_to_structural_support",
    "I5: semantic-over-evidence caution posture is explicit"
);

finish();
