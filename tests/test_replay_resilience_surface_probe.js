// tests/test_replay_resilience_surface_probe.js
//
// Tests for run_replay_resilience_surface_probe.js
//
// Covers:
//   A. Read-side posture and no authority leakage
//   B. Deterministic classification on fixed fixtures
//   C. Perturbation family and phase labeling
//   D. Lineage fields
//   E. Bounded output shape
//   F. Family-level summaries
//   G. Cross-family summary
//
// Run:
//   node tests/test_replay_resilience_surface_probe.js

import { readFile } from "node:fs/promises";

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, detail = "") {
    if (cond) { console.log(`  ✓ ${label}`); passed++; }
    else { const m = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`; console.error(m); failures.push(m); failed++; }
}
function section(name) { console.log(`\n── ${name} ──`); }

// ─── Inline mirrors ───────────────────────────────────────────────────────────

function classifyFlowModeTest(oscStr, lag1AC, flipRate) {
    if (oscStr < 0.02) return "weak_or_inert";
    if (oscStr > 0.15 && Math.abs(lag1AC) > 0.90) return "oscillatory_exchange";
    if (flipRate > 0.45 && oscStr > 0.02) return "oscillatory_exchange";
    return "one_way_drift";
}

function classifyExchangePersistenceTest(bMode, pMode, rMode) {
    const baseOsc = bMode === "oscillatory_exchange";
    const pertOsc = pMode === "oscillatory_exchange";
    const retOsc  = rMode === "oscillatory_exchange";
    if (baseOsc && pertOsc && retOsc)    return "stable_persistent_exchange";
    if (baseOsc && !pertOsc && retOsc)   return "exchange_recovers_on_return";
    if (baseOsc && !pertOsc && !retOsc)  return "exchange_degrades_without_recovery";
    if (!baseOsc && !pertOsc && !retOsc) return "weak_or_inert_throughout";
    if (baseOsc && pertOsc && !retOsc)   return "exchange_lost_on_return";
    return "unresolved";
}

function classifyResilienceHintTest(exchangeClass) {
    switch (exchangeClass) {
        case "stable_persistent_exchange":         return "axis_does_not_disrupt_exchange";
        case "exchange_recovers_on_return":        return "axis_specific_recovery";
        case "exchange_degrades_without_recovery": return "fragile_exchange_regime";
        case "weak_or_inert_throughout":           return "inert_throughout";
        default:                                   return "unresolved";
    }
}

function buildCrossFamilySummaryTest(families) {
    const recovery    = families.filter(f => f.ep === "exchange_recovers_on_return").map(f => f.id);
    const stable      = families.filter(f => f.ep === "stable_persistent_exchange").map(f => f.id);
    const nonRecovery = families.filter(f =>
        f.ep !== "exchange_recovers_on_return" && f.ep !== "stable_persistent_exchange").map(f => f.id);
    const allRecover = nonRecovery.length === 0;
    const surfaceClass = allRecover && recovery.length === families.length
        ? "broad_recovery_pattern"
        : allRecover && stable.length > 0 ? "broad_recovery_or_stability"
        : nonRecovery.length === families.length ? "fragile_exchange_regime"
        : recovery.length > nonRecovery.length ? "mostly_recoverable"
        : "mixed";
    return { recovery, stable, nonRecovery, surfaceClass };
}

// ════════════════════════════════════════════════════════════════════════════
// A. Read-side posture and authority checks
// ════════════════════════════════════════════════════════════════════════════
section("A. Read-side posture and authority checks");

let report = null;
try {
    report = JSON.parse(await readFile(
        "./out_experiments/replay_resilience_surface_probe/replay_resilience_surface_report.json", "utf8"
    ));
} catch (_) {}

assert("A1: report exists", report != null);
assert("A2: probe_type = replay_resilience_surface_probe",
    report?.probe_type === "replay_resilience_surface_probe");

const cp = report?.constitutional_posture ?? {};
assert("A3: runtime_below_canon = true",              cp.runtime_below_canon === true);
assert("A4: cross_run_observational_only = true",     cp.cross_run_observational_only === true);
assert("A5: flow_mode_not_runtime_authority = true",  cp.flow_mode_not_runtime_authority === true);
assert("A6: resilience_class_not_runtime = true",     cp.resilience_class_not_runtime === true);
assert("A7: no_workbench_effects = true",             cp.no_workbench_effects === true);
assert("A8: no_canon_minting = true",                 cp.no_canon_minting === true);
assert("A9: no_prediction_claims = true",             cp.no_prediction_claims === true);
assert("A10: findings_provisional = true",            cp.findings_provisional === true);
assert("A11: findings_probe_local = true",            cp.findings_probe_local === true);
assert("A12: findings_non_canonical = true",          cp.findings_non_canonical === true);

// No leakage in row strings
const rowStr = JSON.stringify(report?.per_run_rows ?? []);
assert("A13: no 'canonical' in per_run_rows",   !rowStr.includes('"canonical"'));
assert("A14: no 'promoted' in per_run_rows",    !rowStr.includes('"promoted"'));
assert("A15: no 'prediction' in per_run_rows",  !rowStr.includes('"prediction"'));

const crossStr = JSON.stringify(report?.cross_family_summary ?? {});
assert("A16: cross_family_summary not_canon = true",
    report?.cross_family_summary?.not_canon === true);
assert("A17: cross_family_summary not_prediction = true",
    report?.cross_family_summary?.not_prediction === true);

// ════════════════════════════════════════════════════════════════════════════
// B. Deterministic classification on fixed fixtures
// ════════════════════════════════════════════════════════════════════════════
section("B. Deterministic classification on fixtures");

// Exchange persistence classes
assert("B1: osc/osc/osc → stable_persistent_exchange",
    classifyExchangePersistenceTest("oscillatory_exchange","oscillatory_exchange","oscillatory_exchange")
    === "stable_persistent_exchange");
assert("B2: osc/drift/osc → exchange_recovers_on_return",
    classifyExchangePersistenceTest("oscillatory_exchange","one_way_drift","oscillatory_exchange")
    === "exchange_recovers_on_return");
assert("B3: osc/inert/osc → exchange_recovers_on_return",
    classifyExchangePersistenceTest("oscillatory_exchange","weak_or_inert","oscillatory_exchange")
    === "exchange_recovers_on_return");
assert("B4: osc/drift/drift → exchange_degrades_without_recovery",
    classifyExchangePersistenceTest("oscillatory_exchange","one_way_drift","one_way_drift")
    === "exchange_degrades_without_recovery");
assert("B5: drift/drift/drift → weak_or_inert_throughout",
    classifyExchangePersistenceTest("one_way_drift","one_way_drift","one_way_drift")
    === "weak_or_inert_throughout");

// Resilience hints
assert("B6: recovers_on_return → axis_specific_recovery",
    classifyResilienceHintTest("exchange_recovers_on_return") === "axis_specific_recovery");
assert("B7: stable_persistent → axis_does_not_disrupt_exchange",
    classifyResilienceHintTest("stable_persistent_exchange") === "axis_does_not_disrupt_exchange");
assert("B8: degrades_without_recovery → fragile_exchange_regime",
    classifyResilienceHintTest("exchange_degrades_without_recovery") === "fragile_exchange_regime");

// Cross-family summary
const allRecoverFamilies = [
    {id:"a", ep:"exchange_recovers_on_return"},
    {id:"b", ep:"exchange_recovers_on_return"},
    {id:"c", ep:"exchange_recovers_on_return"},
    {id:"d", ep:"exchange_recovers_on_return"},
];
assert("B9: all_recover → broad_recovery_pattern",
    buildCrossFamilySummaryTest(allRecoverFamilies).surfaceClass === "broad_recovery_pattern");

const mixedFamilies = [
    {id:"a", ep:"exchange_recovers_on_return"},
    {id:"b", ep:"exchange_recovers_on_return"},
    {id:"c", ep:"exchange_degrades_without_recovery"},
];
assert("B10: mixed → mostly_recoverable when recovery > non-recovery",
    buildCrossFamilySummaryTest(mixedFamilies).surfaceClass === "mostly_recoverable");

// ════════════════════════════════════════════════════════════════════════════
// C. Perturbation family and phase labeling
// ════════════════════════════════════════════════════════════════════════════
section("C. Perturbation family and phase labeling");

const rows = report?.per_run_rows ?? [];
assert("C1: 36 total runs (4 families × 3 phases × 3 runs)", rows.length === 36,
    `got ${rows.length}`);

const EXPECTED_FAMILIES = ["amplitude", "boundary_detuning", "harmonic_offset", "noise_depth"];
for (const fam of EXPECTED_FAMILIES) {
    const famRows = rows.filter(r => r.perturbation_family === fam);
    assert(`C2 (${fam}): 9 runs`, famRows.length === 9, `got ${famRows.length}`);

    const phaseGroups = {
        baseline:     famRows.filter(r => r.replay_phase === "baseline"),
        perturbation: famRows.filter(r => r.replay_phase === "perturbation"),
        return:       famRows.filter(r => r.replay_phase === "return"),
    };
    assert(`C3 (${fam}): 3 phases × 3 runs`,
        phaseGroups.baseline.length === 3 &&
        phaseGroups.perturbation.length === 3 &&
        phaseGroups.return.length === 3);
}

// replay_sequence_index is unique and covers 0..35
const seqIdxs = rows.map(r => r.replay_sequence_index).sort((a, b) => a - b);
assert("C4: replay_sequence_index 0..35 all present",
    JSON.stringify(seqIdxs) === JSON.stringify([...Array(36).keys()]));

// Family rows are ordered by family then phase within the global sequence
const ampRows = rows.filter(r => r.perturbation_family === "amplitude").sort((a,b) => a.replay_sequence_index - b.replay_sequence_index);
const bdRows  = rows.filter(r => r.perturbation_family === "boundary_detuning").sort((a,b) => a.replay_sequence_index - b.replay_sequence_index);
assert("C5: amplitude family comes before boundary_detuning in global sequence",
    Math.max(...ampRows.map(r => r.replay_sequence_index)) <
    Math.min(...bdRows.map(r => r.replay_sequence_index)));

// Perturbation axis labeling
assert("C6: amplitude family axis = harmonic_amp",
    rows.filter(r => r.perturbation_family === "amplitude").every(r => r.perturbation_axis === "harmonic_amp"));
assert("C7: noise_depth family axis = noise_std",
    rows.filter(r => r.perturbation_family === "noise_depth").every(r => r.perturbation_axis === "noise_std"));

// ════════════════════════════════════════════════════════════════════════════
// D. Lineage fields
// ════════════════════════════════════════════════════════════════════════════
section("D. Lineage fields");

const lineageRequired = ["run_label","perturbation_family","perturbation_axis",
    "replay_phase","replay_sequence_index","run_index_in_phase","source_id","stream_id"];
assert("D1: all lineage fields present on every row",
    rows.every(r => lineageRequired.every(f => f in r && r[f] != null)));

// source_ids are unique
assert("D2: all source_ids unique", new Set(rows.map(r => r.source_id)).size === 36);
// stream_ids are unique
assert("D3: all stream_ids unique", new Set(rows.map(r => r.stream_id)).size === 36);
// source_id encodes family and phase
assert("D4: source_ids encode family name",
    rows.every(r => r.source_id.includes(r.perturbation_family)));
assert("D5: source_ids encode phase",
    rows.every(r => r.source_id.includes(r.replay_phase)));

// ════════════════════════════════════════════════════════════════════════════
// E. Bounded output shape
// ════════════════════════════════════════════════════════════════════════════
section("E. Output shape");

const flowFields = ["boundary_band_pair","signed_cross_boundary_flow","oscillatory_flow_strength",
    "flow_direction_consistency","diff_lag1_autocorr","boundary_phase_lag_proxy",
    "sign_flip_rate","flow_mode","basin_count","splitting_observed","inter_window_variance"];
assert("E1: all flow fields present on every row",
    rows.every(r => flowFields.every(f => f in r)));

const familySummaries = report?.family_summaries ?? [];
assert("E2: 4 family summaries",      familySummaries.length === 4);
assert("E3: cross_family_summary present",
    typeof report?.cross_family_summary === "object");

const familySummaryFields = ["perturbation_family","exchange_persistence_class",
    "baseline_flow_mode","perturbation_flow_mode","return_flow_mode",
    "flow_regime_transition_count","basin_split_persistence_summary",
    "resilience_surface_hint","interpretation"];
assert("E4: all family summary fields present",
    familySummaries.every(s => familySummaryFields.every(f => f in s)));

const crossFields = ["perturbation_families_tested","recovery_families","non_recovery_families",
    "resilience_surface_class","interpretation","deferred_axes"];
assert("E5: all cross-family fields present",
    crossFields.every(f => f in (report?.cross_family_summary ?? {})));

// ════════════════════════════════════════════════════════════════════════════
// F. Family-level summaries
// ════════════════════════════════════════════════════════════════════════════
section("F. Family-level summaries");

for (const fam of EXPECTED_FAMILIES) {
    const s = familySummaries.find(s => s.perturbation_family === fam);
    assert(`F1 (${fam}): exchange_persistence = exchange_recovers_on_return`,
        s?.exchange_persistence_class === "exchange_recovers_on_return",
        `got ${s?.exchange_persistence_class}`);
    assert(`F2 (${fam}): baseline_flow_mode = oscillatory_exchange`,
        s?.baseline_flow_mode === "oscillatory_exchange");
    assert(`F3 (${fam}): return_flow_mode = oscillatory_exchange`,
        s?.return_flow_mode === "oscillatory_exchange");
    // perturbation mode should NOT be oscillatory_exchange
    assert(`F4 (${fam}): perturbation_flow_mode != oscillatory_exchange`,
        s?.perturbation_flow_mode !== "oscillatory_exchange",
        `got ${s?.perturbation_flow_mode}`);
}

// harmonic_offset collapses to weak_or_inert (interaction zone disappears)
const hoSummary = familySummaries.find(s => s.perturbation_family === "harmonic_offset");
assert("F5: harmonic_offset perturbation = weak_or_inert (full collapse)",
    hoSummary?.perturbation_flow_mode === "weak_or_inert",
    `got ${hoSummary?.perturbation_flow_mode}`);

// amplitude and boundary_detuning collapse to one_way_drift (weakens but doesn't disappear)
const ampSummary = familySummaries.find(s => s.perturbation_family === "amplitude");
const bdSummary  = familySummaries.find(s => s.perturbation_family === "boundary_detuning");
assert("F6: amplitude perturbation = one_way_drift",
    ampSummary?.perturbation_flow_mode === "one_way_drift");
assert("F7: boundary_detuning perturbation = one_way_drift",
    bdSummary?.perturbation_flow_mode === "one_way_drift");

// flow_regime_transition_count = 2 for all families (two transitions per 9-run session)
assert("F8: all families have flow_regime_transition_count = 2",
    familySummaries.every(s => s.flow_regime_transition_count === 2));

// Basin split: 3/3 baseline, 0/3 perturbation, 3/3 return for all families
for (const s of familySummaries) {
    assert(`F9 (${s.perturbation_family}): 3/3 baseline splits`,
        s.basin_split_persistence_summary.baseline === "3/3 runs split");
    assert(`F10 (${s.perturbation_family}): 0/3 perturbation splits`,
        s.basin_split_persistence_summary.perturbation === "0/3 runs split",
        `got ${s.basin_split_persistence_summary.perturbation}`);
    assert(`F11 (${s.perturbation_family}): 3/3 return splits`,
        s.basin_split_persistence_summary.return === "3/3 runs split");
}

// ════════════════════════════════════════════════════════════════════════════
// G. Cross-family summary
// ════════════════════════════════════════════════════════════════════════════
section("G. Cross-family summary");

const cfs = report?.cross_family_summary ?? {};
assert("G1: resilience_surface_class = broad_recovery_pattern",
    cfs.resilience_surface_class === "broad_recovery_pattern",
    `got ${cfs.resilience_surface_class}`);
assert("G2: all 4 families in recovery_families",
    cfs.recovery_families?.length === 4 &&
    EXPECTED_FAMILIES.every(f => cfs.recovery_families.includes(f)));
assert("G3: non_recovery_families is empty",
    cfs.non_recovery_families?.length === 0);
assert("G4: all 4 families in perturbation_families_tested",
    cfs.perturbation_families_tested?.length === 4);
assert("G5: deferred_axes present and non-empty",
    Array.isArray(cfs.deferred_axes) && cfs.deferred_axes.length > 0);
assert("G6: deferred_axes mentions phase_ratio",
    cfs.deferred_axes.some(d => d.includes("phase_ratio")));

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
