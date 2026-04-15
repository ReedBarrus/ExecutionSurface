// tests/test_attention_memory_report.js
//
// Contract tests for runtime/AttentionMemoryReport.js
//
// Scope:
//   - output shape
//   - evidence discipline
//   - determinism
//   - label sanity
//   - boundary integrity
//   - failed input handling
//   - optional base-report injection path
//
// Boundary contract:
//   - derived / observational overlay only
//   - no canon, no prediction, no ontology claims
//   - no semantic intent or trusted commitment claims
//   - consumes DoorOneOrchestrator result + TrajectoryInterpretationReport semantics
//   - deterministic given identical orchestrator result / base report
//
// References:
//   - runtime/AttentionMemoryReport.js
//   - runtime/TrajectoryInterpretationReport.js
//   - runtime/DoorOneOrchestrator.js
//   - README_MasterConstitution.md §3 / §5
//   - README_RepoPlacementConstitution.md (canonical tests/ placement)

import { DoorOneOrchestrator } from "../runtime/DoorOneOrchestrator.js";
import { TrajectoryInterpretationReport } from "../runtime/TrajectoryInterpretationReport.js";
import { AttentionMemoryReport } from "../runtime/AttentionMemoryReport.js";
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

const POLICIES = {
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

function makeRawFixture() {
    const { signal } = makeTestSignal({
        durationSec: 4,
        fs: 8,
        seed: 7,
        noiseStd: 0.01,
        source_id: "amr.probe",
        channel: "ch0",
        modality: "voltage",
        units: "arb",
    });

    return {
        timestamps: signal.timestamps,
        values: signal.values,
        stream_id: signal.stream_id,
        source_id: signal.source_id,
        channel: signal.channel,
        modality: signal.modality,
        meta: signal.meta,
        clock_policy_id: POLICIES.clock_policy_id,
    };
}

function makeQuerySpec() {
    return {
        query_id: "q.amr",
        kind: "energy_trend",
        mode: "ENERGY",
        scope: { allow_cross_segment: true },
    };
}

function makeQueryPolicy() {
    return {
        policy_id: "qp.amr",
        scoring: "energy_delta",
        normalization: "none",
        topK: 5,
    };
}

function buildGoodResult() {
    const orch = new DoorOneOrchestrator({ policies: POLICIES });
    return orch.runBatch(makeRawFixture(), {
        query_spec: makeQuerySpec(),
        query_policy: makeQueryPolicy(),
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

const amr = new AttentionMemoryReport();
const tir = new TrajectoryInterpretationReport();

const result = buildGoodResult();
const baseReport = tir.interpret(result);
const report = amr.interpret(result, baseReport);

section("A. Output shape");
ok(result?.ok === true, "A1: orchestrator result.ok before overlay");
ok(baseReport && typeof baseReport === "object", "A2: base trajectory report present");
ok(report && typeof report === "object", "A3: interpret() returns plain object");
eq(report.report_type, "runtime:attention_memory_report", "A4: report_type correct");
eq(report.report_kind, "attention_memory_semantic_overlay", "A5: report_kind correct");
includes(report.generated_from, "derived support-persistence and reuse-pressure overlay", "A6: generated_from preserves overlay boundary");
ok(report.scope && typeof report.scope === "object", "A6: scope present");
eq(report.query_class, "Q3_support_lineage", "A7: query_class explicit");
eq(report.claim_ceiling, "support_only", "A8: claim_ceiling explicit");
ok(typeof report.primary_posture === "string", "A9: primary_posture present");
ok(Array.isArray(report.primary_descriptors), "A10: primary_descriptors array present");
ok(Array.isArray(report.secondary_descriptors), "A11: secondary_descriptors array present");
ok(Array.isArray(report.evidence_refs), "A12: evidence_refs array present");
ok(Array.isArray(report.explicit_non_claims), "A13: explicit_non_claims array present");
ok(report.support_persistence && typeof report.support_persistence === "object", "A14: support_persistence present");
ok(report.reuse_pressure && typeof report.reuse_pressure === "object", "A15: reuse_pressure present");
ok(report.memory_candidate_posture && typeof report.memory_candidate_posture === "object", "A16: memory_candidate_posture present");
ok(report.attention_character && typeof report.attention_character === "object", "A17: attention_character compatibility surface present");
ok(report.memory_character && typeof report.memory_character === "object", "A18: memory_character compatibility surface present");
ok(report.coordination_hints && typeof report.coordination_hints === "object", "A19: coordination_hints compatibility surface present");
ok(Array.isArray(report.overlay_flags), "A20: overlay_flags array present");
ok(Array.isArray(report.notes), "A21: notes array present");
eq(report.scope.stream_id, baseReport.scope?.stream_id ?? null, "A22: scope.stream_id copied from base report");
deepEq(report.scope.segment_ids, baseReport.scope?.segment_ids ?? [], "A23: scope.segment_ids copied from base report");

section("B. Evidence discipline");
ok(report.support_persistence.evidence && typeof report.support_persistence.evidence === "object", "B1: support_persistence evidence object present");
ok(report.reuse_pressure.evidence && typeof report.reuse_pressure.evidence === "object", "B2: reuse_pressure evidence object present");
ok(report.memory_candidate_posture.evidence && typeof report.memory_candidate_posture.evidence === "object", "B3: memory_candidate_posture evidence object present");
ok(report.attention_character.evidence && typeof report.attention_character.evidence === "object", "B4: attention evidence object present");
ok(report.memory_character.evidence && typeof report.memory_character.evidence === "object", "B5: memory evidence object present");
ok(report.coordination_hints.evidence && typeof report.coordination_hints.evidence === "object", "B6: coordination evidence object present");

ok("attention_concentration" in report.support_persistence.evidence, "B7: support_persistence.attention_concentration present");
ok("reuse_pressure" in report.memory_candidate_posture.evidence, "B8: memory_candidate_posture.reuse_pressure present");
ok(!("pre_commitment" in report.reuse_pressure.evidence), "B9: reuse_pressure no longer depends on pre_commitment");
ok("dominant_dwell_share" in report.attention_character.evidence, "B10: attention evidence.dominant_dwell_share present");
ok("transition_density_value" in report.attention_character.evidence, "B11: attention evidence.transition_density_value present");
ok("motion" in report.attention_character.evidence, "B12: attention evidence.motion present");

ok("total_re_entries" in report.memory_character.evidence, "B13: memory evidence.total_re_entries present");
ok("convergence" in report.memory_character.evidence, "B14: memory evidence.convergence present");
ok("continuity" in report.memory_character.evidence, "B15: memory evidence.continuity present");

ok("support_persistence" in report.coordination_hints.evidence, "B16: coordination evidence.support_persistence present");
ok("reuse_pressure" in report.coordination_hints.evidence, "B17: coordination evidence.reuse_pressure present");
ok("memory_candidate_posture" in report.coordination_hints.evidence, "B18: coordination evidence.memory_candidate_posture present");

ok(!("artifact_class" in report), "B19: report has no artifact_class");
ok(!("artifact_class" in report.support_persistence), "B20: support_persistence has no artifact_class");
ok(!("artifact_class" in report.reuse_pressure), "B21: reuse_pressure has no artifact_class");
ok(!("artifact_class" in report.memory_candidate_posture), "B22: memory_candidate_posture has no artifact_class");
ok(!("artifact_class" in report.attention_character), "B23: attention_character has no artifact_class");
ok(!("artifact_class" in report.memory_character), "B24: memory_character has no artifact_class");
ok(!("artifact_class" in report.coordination_hints), "B25: coordination_hints has no artifact_class");

section("C. Determinism");
const result2 = buildGoodResult();
const baseReport2 = tir.interpret(result2);
const report2 = amr.interpret(result2, baseReport2);
deepEq(report, report2, "C1: identical input result -> identical overlay report");

const internalBaseReport = amr.interpret(result);
deepEq(report, internalBaseReport, "C2: explicit baseReport path matches internal-base path");

section("D. Label sanity");
isOneOf(
    report.support_persistence.posture,
    ["support_only", "developing", "sustained"],
    "D1: support_persistence posture allowed"
);
isOneOf(
    report.reuse_pressure.posture,
    ["low", "moderate", "elevated"],
    "D2: reuse_pressure posture allowed"
);
isOneOf(
    report.memory_candidate_posture.posture,
    ["no_memory_class_claim", "bounded_M1_candidate", "bounded_M2_candidate"],
    "D3: memory_candidate_posture allowed"
);
isOneOf(
    report.attention_character.concentration,
    ["low", "medium", "high"],
    "D4: attention concentration label allowed"
);
isOneOf(
    report.attention_character.persistence,
    ["low", "medium", "high"],
    "D5: attention persistence label allowed"
);
isOneOf(
    report.attention_character.volatility,
    ["low", "medium", "high"],
    "D6: attention volatility label allowed"
);
isOneOf(
    report.memory_character.recurrence_strength,
    ["low", "medium", "high"],
    "D7: memory recurrence_strength label allowed"
);
isOneOf(
    report.memory_character.persistence,
    ["low", "medium", "high"],
    "D8: memory persistence label allowed"
);
isOneOf(
    report.memory_character.stability,
    ["low", "medium", "high"],
    "D9: memory stability label allowed"
);
isOneOf(
    report.coordination_hints.pre_commitment,
    ["absent", "weak", "emergent"],
    "D10: coordination pre_commitment label allowed"
);

section("E. Boundary integrity");
const json = JSON.stringify(report);

notIncludes(json, '"artifact_class":"C1"', "E1: no C1 artifact class in report");
notIncludes(json, '"canonical"', "E2: no canonical key");
notIncludes(json, '"promoted"', "E3: no promoted key");
notIncludes(json, '"trusted"', "E4: no trusted authority language");
notIncludes(json, '"prediction"', "E5: no prediction key");
notIncludes(json, '"next state"', "E6: no next-state language");
notIncludes(json, '"likely next"', "E7: no likely-next language");
notIncludes(json, '"ontology"', "E8: no ontology key");
notIncludes(json, '"intent"', "E9: no intent key");
notIncludes(json, '"agency"', "E10: no agency key");
notIncludes(json, '"runtime memory substance"', "E11: no runtime memory substance phrase");
notIncludes(json, '"identity closure"', "E12: no identity closure phrase as output field");

includes(report.generated_from, "not canon", "E13: generated_from denies canon");
includes(report.generated_from, "not runtime memory substance", "E14: generated_from denies runtime memory substance");
includes(report.generated_from, "not identity closure", "E15: generated_from denies identity closure");
includes(report.generated_from, "not readiness", "E16: generated_from denies readiness posture");

ok(report.primary_descriptors.length <= 3, "E17: primary descriptor count bounded");
ok(report.secondary_descriptors.length <= 2, "E18: secondary descriptor count bounded");
ok(report.explicit_non_claims.includes("not_runtime_memory_substance"), "E19: explicit_non_claims deny runtime memory substance");
ok(report.explicit_non_claims.includes("not_identity_claim"), "E20: explicit_non_claims deny identity claim");
ok(report.explicit_non_claims.includes("not_readiness_posture"), "E21: explicit_non_claims deny readiness posture");

ok(
    report.notes.some(n => n.includes("No runtime memory substance, identity closure, or trusted commitment is asserted.")),
    "E22: notes preserve no-memory-substance / no-identity-closure boundary"
);
ok(
    report.notes.some(n => n.includes("Any memory-class language remains bounded candidate posture only")),
    "E23: notes preserve bounded candidate-memory boundary"
);
ok(
    report.notes.some(n => n.includes("Legacy attention/memory/coordination field names remain compatibility heuristics")),
    "E24: notes preserve compatibility-only boundary"
);

section("F. Failed input handling");
const failed1 = amr.interpret(null);
eq(failed1.ok, false, "F1: null input -> ok=false");
eq(failed1.error, "INVALID_INPUT", "F2: null input -> INVALID_INPUT");
ok(Array.isArray(failed1.reasons), "F3: null input -> reasons array");

const failed2 = amr.interpret({ ok: false, error: "WHATEVER" });
eq(failed2.ok, false, "F4: failed orchestrator result -> ok=false");
eq(failed2.error, "INVALID_INPUT", "F5: failed orchestrator result -> INVALID_INPUT");

const failed3 = amr.interpret(result, { ok: false, error: "INVALID_BASE_REPORT" });
eq(failed3.ok, false, "F6: invalid base report -> ok=false");
eq(failed3.error, "INVALID_BASE_REPORT", "F7: invalid base report -> INVALID_BASE_REPORT");
ok(Array.isArray(failed3.reasons), "F8: invalid base report -> reasons array");

finish();
