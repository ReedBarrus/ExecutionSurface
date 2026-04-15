// tests/test_continuous_replay_flow_probe.js
//
// Tests for run_continuous_replay_flow_probe.js
//
// Covers:
//   A. Read-side-only posture and no authority leakage
//   B. Deterministic classification on fixed fixtures
//   C. Baseline / perturbation / return phase labeling
//   D. Replay-honest lineage fields
//   E. Bounded output shape
//   F. Replay summary — exchange persistence classification
//
// Run:
//   node tests/test_continuous_replay_flow_probe.js

import { readFile } from "node:fs/promises";

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, detail = "") {
    if (cond) { console.log(`  ✓ ${label}`); passed++; }
    else { const m = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`; console.error(m); failures.push(m); failed++; }
}
function section(name) { console.log(`\n── ${name} ──`); }

// ─── Inline mirrors ───────────────────────────────────────────────────────────

// Replay summary classification (mirrors probe logic)
function classifyExchangePersistenceTest(bMode, pMode, rMode) {
    const baseOsc = bMode === "oscillatory_exchange";
    const pertOsc = pMode === "oscillatory_exchange";
    const retOsc  = rMode === "oscillatory_exchange";
    if (baseOsc && pertOsc && retOsc)    return "stable_persistent_exchange";
    if (baseOsc && !pertOsc && retOsc)   return "exchange_recovers_on_return";
    if (baseOsc && !pertOsc && !retOsc)  return "exchange_lost_under_perturbation";
    if (!baseOsc && !pertOsc && !retOsc) return "weak_or_inert_throughout";
    if (baseOsc && pertOsc && !retOsc)   return "exchange_lost_on_return";
    return "unresolved";
}

// Flow mode classification (mirrors probe logic)
function classifyFlowModeTest(oscStrength, lag1AC, flipRate) {
    if (oscStrength < 0.02) return "weak_or_inert";
    if (oscStrength > 0.15 && Math.abs(lag1AC) > 0.90) return "oscillatory_exchange";
    if (flipRate > 0.45 && oscStrength > 0.02) return "oscillatory_exchange";
    return "one_way_drift";
}

// ════════════════════════════════════════════════════════════════════════════
// A. Read-side posture and no authority leakage
// ════════════════════════════════════════════════════════════════════════════
section("A. Read-side posture and authority checks");

let report = null;
try {
    report = JSON.parse(await readFile(
        "./out_experiments/continuous_replay_flow_probe/continuous_replay_flow_report.json", "utf8"
    ));
} catch (_) {}

assert("A1: report exists", report != null);
assert("A2: probe_type = continuous_replay_flow_probe",
    report?.probe_type === "continuous_replay_flow_probe");

// Constitutional posture fields
const cp = report?.constitutional_posture ?? {};
assert("A3: runtime_below_canon = true",             cp.runtime_below_canon === true);
assert("A4: cross_run_observational_only = true",    cp.cross_run_observational_only === true);
assert("A5: replay_lens_bound = true",               cp.replay_lens_bound === true);
assert("A6: basin_org_not_ontology = true",          cp.basin_org_not_ontology === true);
assert("A7: flow_mode_not_runtime_authority = true", cp.flow_mode_not_runtime_authority === true);
assert("A8: no_workbench_effects = true",            cp.no_workbench_effects === true);
assert("A9: no_canon_minting = true",                cp.no_canon_minting === true);
assert("A10: no_prediction_claims = true",           cp.no_prediction_claims === true);

// No canon/prediction fields in rows
const rowStr = JSON.stringify(report?.per_run_rows ?? []);
assert("A11: no 'canonical' field in per_run_rows",
    !rowStr.includes('"canonical"'));
assert("A12: no 'prediction' field in per_run_rows",
    !rowStr.includes('"prediction"'));
assert("A13: no 'promoted' field in per_run_rows",
    !rowStr.includes('"promoted"'));

// Replay summary posture
const rs = report?.replay_summary ?? {};
assert("A14: replay_summary not_canon = true",       rs.not_canon === true);
assert("A15: replay_summary not_prediction = true",  rs.not_prediction === true);
assert("A16: replay_summary not_promotion = true",   rs.not_promotion === true);
assert("A17: diagnostic_posture field present",
    typeof rs.diagnostic_posture === "string" && rs.diagnostic_posture.length > 0);

// ════════════════════════════════════════════════════════════════════════════
// B. Deterministic classification on fixed fixtures
// ════════════════════════════════════════════════════════════════════════════
section("B. Deterministic classification");

// Exchange persistence cases
assert("B1: all oscillatory → stable_persistent_exchange",
    classifyExchangePersistenceTest("oscillatory_exchange","oscillatory_exchange","oscillatory_exchange")
    === "stable_persistent_exchange");
assert("B2: osc/drift/osc → exchange_recovers_on_return",
    classifyExchangePersistenceTest("oscillatory_exchange","one_way_drift","oscillatory_exchange")
    === "exchange_recovers_on_return");
assert("B3: osc/drift/drift → exchange_lost_under_perturbation",
    classifyExchangePersistenceTest("oscillatory_exchange","one_way_drift","one_way_drift")
    === "exchange_lost_under_perturbation");
assert("B4: drift/drift/drift → weak_or_inert_throughout",
    classifyExchangePersistenceTest("one_way_drift","one_way_drift","one_way_drift")
    === "weak_or_inert_throughout");
assert("B5: osc/osc/drift → exchange_lost_on_return",
    classifyExchangePersistenceTest("oscillatory_exchange","oscillatory_exchange","one_way_drift")
    === "exchange_lost_on_return");
assert("B6: unresolved for non-standard combinations",
    classifyExchangePersistenceTest("one_way_drift","oscillatory_exchange","one_way_drift")
    === "unresolved");

// Flow mode classification
assert("B7: osc_str=0.305, lag=-0.999 → oscillatory_exchange",
    classifyFlowModeTest(0.305, -0.999, 0.0) === "oscillatory_exchange");
assert("B8: osc_str=0.127, lag=-0.90 → one_way_drift (below osc_strong threshold)",
    classifyFlowModeTest(0.127, -0.90, 0.0) === "one_way_drift");
assert("B9: osc_str=0.008 → weak_or_inert",
    classifyFlowModeTest(0.008, -0.90, 0.0) === "weak_or_inert");

// The expected result for this specific probe run
assert("B10: report exchange_persistence = exchange_recovers_on_return",
    rs.exchange_persistence_class === "exchange_recovers_on_return",
    `got ${rs.exchange_persistence_class}`);

// ════════════════════════════════════════════════════════════════════════════
// C. Baseline / perturbation / return phase labeling
// ════════════════════════════════════════════════════════════════════════════
section("C. Phase labeling");

const rows = report?.per_run_rows ?? [];
assert("C1: exactly 9 runs", rows.length === 9, `got ${rows.length}`);

const phaseGroups = { baseline: [], perturbation: [], return: [] };
for (const r of rows) phaseGroups[r.replay_phase]?.push(r);

assert("C2: 3 baseline runs",     phaseGroups.baseline.length     === 3);
assert("C3: 3 perturbation runs", phaseGroups.perturbation.length === 3);
assert("C4: 3 return runs",       phaseGroups.return.length       === 3);

// replay_sequence_index is 0–8 in order
const seqIndices = rows.map(r => r.replay_sequence_index).sort((a, b) => a - b);
assert("C5: replay_sequence_index covers 0..8",
    JSON.stringify(seqIndices) === "[0,1,2,3,4,5,6,7,8]");

// Phase order: baseline first, perturbation second, return third
const baselineIdxs    = phaseGroups.baseline.map(r => r.replay_sequence_index);
const perturbIdxs     = phaseGroups.perturbation.map(r => r.replay_sequence_index);
const returnIdxs      = phaseGroups.return.map(r => r.replay_sequence_index);
assert("C6: baseline runs come before perturbation",
    Math.max(...baselineIdxs) < Math.min(...perturbIdxs));
assert("C7: perturbation runs come before return",
    Math.max(...perturbIdxs) < Math.min(...returnIdxs));

// run_index_in_phase counts 0, 1, 2 within each phase
for (const [ph, phRows] of Object.entries(phaseGroups)) {
    const localIdxs = phRows.map(r => r.run_index_in_phase).sort((a, b) => a - b);
    assert(`C8 (${ph}): run_index_in_phase = [0,1,2]`,
        JSON.stringify(localIdxs) === "[0,1,2]");
}

// Amplitude matches phase
assert("C9: baseline runs have amp=0.50",
    phaseGroups.baseline.every(r => r.harmonic_amp === 0.50));
assert("C10: perturbation runs have amp=0.75",
    phaseGroups.perturbation.every(r => r.harmonic_amp === 0.75));
assert("C11: return runs have amp=0.50",
    phaseGroups.return.every(r => r.harmonic_amp === 0.50));

// ════════════════════════════════════════════════════════════════════════════
// D. Replay-honest lineage fields
// ════════════════════════════════════════════════════════════════════════════
section("D. Lineage fields");

const lineageRequired = ["run_label","replay_phase","replay_sequence_index",
    "run_index_in_phase","source_id","stream_id"];
assert("D1: all lineage fields present on every run row",
    rows.every(r => lineageRequired.every(f => f in r && r[f] != null)));

// source_ids are unique per run (each run has its own receipt reference)
const sourceIds = rows.map(r => r.source_id);
assert("D2: all source_ids are unique",
    new Set(sourceIds).size === rows.length, `got ${new Set(sourceIds).size} unique`);

// stream_ids are unique per run
const streamIds = rows.map(r => r.stream_id);
assert("D3: all stream_ids are unique",
    new Set(streamIds).size === rows.length);

// run_labels are unique
const runLabels = rows.map(r => r.run_label);
assert("D4: all run_labels are unique",
    new Set(runLabels).size === rows.length);

// source_id encodes phase and run index
assert("D5: source_ids contain phase name",
    rows.every(r => r.source_id.includes(r.replay_phase)));

// ════════════════════════════════════════════════════════════════════════════
// E. Bounded output shape
// ════════════════════════════════════════════════════════════════════════════
section("E. Output shape");

const flowFields = ["boundary_band_pair","signed_cross_boundary_flow","oscillatory_flow_strength",
    "flow_direction_consistency","diff_lag1_autocorr","boundary_phase_lag_proxy",
    "sign_flip_rate","flow_mode"];
assert("E1: all flow fields present on every row",
    rows.every(r => flowFields.every(f => f in r)));

assert("E2: basin_count present on every row",
    rows.every(r => typeof r.basin_count === "number"));
assert("E3: splitting_observed present on every row",
    rows.every(r => typeof r.splitting_observed === "boolean"));
assert("E4: inter_window_variance present",
    rows.every(r => typeof r.inter_window_variance === "number"));
assert("E5: interpretation present and non-empty",
    rows.every(r => typeof r.interpretation === "string" && r.interpretation.length > 0));

// Replay summary has required fields
const summaryFields = ["baseline_flow_mode","perturbation_flow_mode","return_flow_mode",
    "exchange_persistence_class","flow_regime_transition_count",
    "basin_split_persistence_summary","interpretation"];
assert("E6: all summary fields present",
    summaryFields.every(f => f in rs));

assert("E7: flow_regime_transition_count is a number",
    typeof rs.flow_regime_transition_count === "number");
assert("E8: basin_split_persistence_summary has all three phases",
    "baseline" in rs.basin_split_persistence_summary &&
    "perturbation" in rs.basin_split_persistence_summary &&
    "return" in rs.basin_split_persistence_summary);

// ════════════════════════════════════════════════════════════════════════════
// F. Replay summary — exchange persistence classification
// ════════════════════════════════════════════════════════════════════════════
section("F. Replay summary classification");

// Expected from the probe: oscillatory_exchange in baseline, one_way_drift in perturbation,
// oscillatory_exchange in return → exchange_recovers_on_return
assert("F1: baseline_flow_mode = oscillatory_exchange",
    rs.baseline_flow_mode === "oscillatory_exchange", `got ${rs.baseline_flow_mode}`);
assert("F2: perturbation_flow_mode = one_way_drift",
    rs.perturbation_flow_mode === "one_way_drift", `got ${rs.perturbation_flow_mode}`);
assert("F3: return_flow_mode = oscillatory_exchange",
    rs.return_flow_mode === "oscillatory_exchange", `got ${rs.return_flow_mode}`);
assert("F4: exchange_persistence_class = exchange_recovers_on_return",
    rs.exchange_persistence_class === "exchange_recovers_on_return");

// Exactly 2 regime transitions (baseline→perturbation, perturbation→return)
assert("F5: flow_regime_transition_count = 2 (two phase boundaries)",
    rs.flow_regime_transition_count === 2, `got ${rs.flow_regime_transition_count}`);

// Basin splits match expected pattern
const splitSummary = rs.basin_split_persistence_summary;
assert("F6: baseline splits = 3/3",     splitSummary.baseline     === "3/3 runs split");
assert("F7: perturbation splits = 0/3", splitSummary.perturbation === "0/3 runs split");
assert("F8: return splits = 3/3",       splitSummary.return       === "3/3 runs split");

// Baseline and return rows all have oscillatory_exchange; perturbation rows all one_way_drift
assert("F9: all baseline rows have oscillatory_exchange",
    phaseGroups.baseline.every(r => r.flow_mode === "oscillatory_exchange"));
assert("F10: all perturbation rows have one_way_drift",
    phaseGroups.perturbation.every(r => r.flow_mode === "one_way_drift"));
assert("F11: all return rows have oscillatory_exchange",
    phaseGroups.return.every(r => r.flow_mode === "oscillatory_exchange"));

// Osc strength means differ between phases
assert("F12: baseline osc_strength mean > perturbation osc_strength mean",
    (rs.baseline_osc_strength_mean ?? 0) > (rs.perturbation_osc_strength_mean ?? 1));
assert("F13: return osc_strength mean ≈ baseline osc_strength mean (recovery)",
    Math.abs((rs.return_osc_strength_mean ?? 0) - (rs.baseline_osc_strength_mean ?? 0)) < 0.02);

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
