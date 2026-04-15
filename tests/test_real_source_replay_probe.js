// tests/test_real_source_replay_probe.js
//
// Tests for run_real_source_replay_probe.js
//
// Covers:
//   A. Read-side posture and no authority leakage
//   B. Deterministic classification on fixtures (including real-source cases)
//   C. Phase labeling and cohort mapping
//   D. Lineage fields and file provenance
//   E. Output shape and metric transfer posture
//   F. Replay summary — band-profile separation and exchange class
//
// Two test modes:
//   1. Always: fixture-based classification logic, posture fields, output shape
//   2. When WAV files present: per-run metrics, band-profile separation values
//
// Run:
//   node tests/test_real_source_replay_probe.js

import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const REPORT_PATH = path.join(REPO_ROOT, "out_experiments",
    "real_source_replay_probe", "real_source_replay_report.json");
const WAV_DIR = path.join(REPO_ROOT, "test_signal", "daw_mic_input");

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, detail = "") {
    if (cond) { console.log(`  ✓ ${label}`); passed++; }
    else { const m = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`; console.error(m); failures.push(m); failed++; }
}
function section(name) { console.log(`\n── ${name} ──`); }

// ─── Check presence of WAV files ──────────────────────────────────────────────
let wavFilesPresent = false;
try {
    await access(path.join(WAV_DIR, "baseline_01.wav"));
    wavFilesPresent = true;
} catch (_) {}

let report = null;
try { report = JSON.parse(await readFile(REPORT_PATH, "utf8")); } catch (_) {}

// ─── Inline mirrors ───────────────────────────────────────────────────────────

function classifyExchangePersistenceTest(bMode, pMode, rMode) {
    const baseOsc = bMode === "oscillatory_exchange";
    const pertOsc = pMode === "oscillatory_exchange";
    const retOsc  = rMode === "oscillatory_exchange";
    if (baseOsc && pertOsc && retOsc)    return "stable_persistent_exchange";
    if (baseOsc && !pertOsc && retOsc)   return "exchange_recovers_on_return";
    if (baseOsc && !pertOsc && !retOsc)  return "exchange_degrades_without_recovery";
    if (baseOsc && pertOsc && !retOsc)   return "exchange_lost_on_return";
    if (bMode === "weak_or_inert" && pMode === "weak_or_inert" && rMode === "weak_or_inert")
        return "weak_or_inert_throughout";
    if (!baseOsc && !pertOsc && !retOsc) return "non_oscillatory_throughout";
    return "unresolved";
}

function classifyFlowModeTest(osc, lag1AC, flip) {
    if (osc < 0.02) return "weak_or_inert";
    if (osc > 0.15 && Math.abs(lag1AC) > 0.90) return "oscillatory_exchange";
    if (flip > 0.45 && osc > 0.02) return "oscillatory_exchange";
    return "one_way_drift";
}

// ════════════════════════════════════════════════════════════════════════════
// A. Read-side posture and authority checks
// ════════════════════════════════════════════════════════════════════════════
section("A. Read-side posture");

assert("A1: report exists",        report != null,
    `run the probe first: node scripts/run_real_source_replay_probe.js`);

const cp = report?.constitutional_posture ?? {};
assert("A2: runtime_below_canon = true",             cp.runtime_below_canon === true);
assert("A3: cross_run_observational_only = true",    cp.cross_run_observational_only === true);
assert("A4: flow_mode_not_runtime_authority = true", cp.flow_mode_not_runtime_authority === true);
assert("A5: no_workbench_effects = true",            cp.no_workbench_effects === true);
assert("A6: no_canon_minting = true",                cp.no_canon_minting === true);
assert("A7: no_prediction_claims = true",            cp.no_prediction_claims === true);
assert("A8: findings_provisional = true",            cp.findings_provisional === true);
assert("A9: findings_non_canonical = true",          cp.findings_non_canonical === true);

const rowStr = JSON.stringify(report?.per_run_rows ?? []);
assert("A10: no 'canonical' in per_run_rows",   !rowStr.includes('"canonical"'));
assert("A11: no 'promoted' in per_run_rows",    !rowStr.includes('"promoted"'));
assert("A12: not_canon in replay_summary",
    report?.replay_summary?.not_canon === true);
assert("A13: not_prediction in replay_summary", report?.replay_summary?.not_prediction === true);

// ════════════════════════════════════════════════════════════════════════════
// B. Deterministic classification on fixtures (always runs)
// ════════════════════════════════════════════════════════════════════════════
section("B. Classification logic on fixtures");

// Exchange persistence — synthetic cases still need to work
assert("B1: osc/osc/osc → stable_persistent_exchange",
    classifyExchangePersistenceTest("oscillatory_exchange","oscillatory_exchange","oscillatory_exchange")
    === "stable_persistent_exchange");
assert("B2: osc/drift/osc → exchange_recovers_on_return",
    classifyExchangePersistenceTest("oscillatory_exchange","one_way_drift","oscillatory_exchange")
    === "exchange_recovers_on_return");
// Real-source cases
assert("B3: drift/drift/drift → non_oscillatory_throughout (real-source case)",
    classifyExchangePersistenceTest("one_way_drift","one_way_drift","one_way_drift")
    === "non_oscillatory_throughout");
assert("B4: inert/inert/inert → weak_or_inert_throughout",
    classifyExchangePersistenceTest("weak_or_inert","weak_or_inert","weak_or_inert")
    === "weak_or_inert_throughout");
assert("B5: drift/osc/drift → unresolved (base not oscillatory)",
    classifyExchangePersistenceTest("one_way_drift","oscillatory_exchange","one_way_drift")
    === "unresolved");

// Flow mode classification for real-source parameters (osc≈0.13–0.21, lag≈0.2–0.4)
assert("B6: osc=0.17, lag=0.45, flip=0.005 → one_way_drift (real baseline signature)",
    classifyFlowModeTest(0.17, 0.45, 0.005) === "one_way_drift");
assert("B7: osc=0.21, lag=0.11, flip=0.07 → one_way_drift (real perturb signature)",
    classifyFlowModeTest(0.21, 0.11, 0.07) === "one_way_drift");
assert("B8: osc=0.01, lag=0.90, flip=0.0 → weak_or_inert",
    classifyFlowModeTest(0.01, 0.90, 0.0) === "weak_or_inert");

// ════════════════════════════════════════════════════════════════════════════
// C. Phase labeling and cohort mapping
// ════════════════════════════════════════════════════════════════════════════
section("C. Phase labeling and cohort mapping");

assert("C1: report probe_type correct",
    report?.probe_type === "real_source_replay_probe");

const rows = report?.per_run_rows ?? [];
assert("C2: 9 per_run_rows (3 per phase)", rows.length === 9);

// Explicit phase map — not inferred from filename alone
const phaseGroups = { baseline: [], perturbation: [], return: [] };
for (const r of rows) phaseGroups[r.replay_phase]?.push(r);
assert("C3: 3 baseline runs",     phaseGroups.baseline?.length === 3);
assert("C4: 3 perturbation runs", phaseGroups.perturbation?.length === 3);
assert("C5: 3 return runs",       phaseGroups.return?.length === 3);

// Sequence ordering: baseline → perturbation → return
const baseIdxs = phaseGroups.baseline.map(r => r.replay_sequence_index);
const pertIdxs = phaseGroups.perturbation.map(r => r.replay_sequence_index);
const retIdxs  = phaseGroups.return.map(r => r.replay_sequence_index);
assert("C6: baseline runs before perturbation",
    Math.max(...baseIdxs) < Math.min(...pertIdxs));
assert("C7: perturbation runs before return",
    Math.max(...pertIdxs) < Math.min(...retIdxs));

// Filename–phase alignment matches spec
const fnPhaseMap = {
    "baseline_01.wav": "baseline",  "baseline_02.wav": "baseline", "baseline_03.wav": "baseline",
    "perturb_01.wav":  "perturbation", "perturb_02.wav": "perturbation", "perturb_03.wav": "perturbation",
    "return_01.wav":   "return",    "return_02.wav": "return",    "return_03.wav": "return",
};
assert("C8: each raw_filename maps to the correct replay_phase",
    rows.every(r => !r.raw_filename || fnPhaseMap[r.raw_filename] === r.replay_phase));

// ════════════════════════════════════════════════════════════════════════════
// D. Lineage fields and file provenance
// ════════════════════════════════════════════════════════════════════════════
section("D. Lineage and provenance");

const lineageFields = ["run_label","replay_phase","replay_sequence_index",
    "run_index_in_phase","source_id","raw_filepath","raw_filename","source_type"];
assert("D1: all lineage fields present on every row",
    rows.every(r => lineageFields.every(f => f in r && r[f] != null)));

// source_type must be "wav_file" for all rows
assert("D2: source_type = wav_file on every row",
    rows.every(r => r.source_type === "wav_file"));

// raw_filename preserved exactly (not normalized/renamed)
const expectedFilenames = ["baseline_01.wav","baseline_02.wav","baseline_03.wav",
    "perturb_01.wav","perturb_02.wav","perturb_03.wav",
    "return_01.wav","return_02.wav","return_03.wav"];
assert("D3: raw_filenames match declared cohort exactly",
    rows.map(r => r.raw_filename).sort().join(",") === expectedFilenames.sort().join(","));

// raw_filepath contains the raw_filename
assert("D4: raw_filepath contains raw_filename",
    rows.every(r => r.raw_filepath?.endsWith(r.raw_filename)));

// Master files: present as lineage references only
const masterLineage = report?.master_lineage ?? [];
assert("D5: 3 master lineage entries", masterLineage.length === 3);
assert("D6: masters role = lineage_reference_only",
    masterLineage.every(m => m.role === "lineage_reference_only"));
assert("D7: masters not in per_run_rows",
    !rows.some(r => r.raw_filename?.startsWith("master_")));

// ════════════════════════════════════════════════════════════════════════════
// E. Output shape and metric transfer posture
// ════════════════════════════════════════════════════════════════════════════
section("E. Output shape and metric transfer posture");

const requiredRowFields = ["run_label","replay_phase","source_id","raw_filepath","raw_filename",
    "file_found","flow_mode","sufficient_support","basin_count","splitting_observed",
    "inter_window_variance","window_count","interpretation"];
assert("E1: required fields on every row",
    rows.every(r => requiredRowFields.every(f => f in r)));

// All filed-found rows have flow fields
const foundRows = rows.filter(r => r.file_found);
const flowFields = ["boundary_band_pair","signed_cross_boundary_flow","oscillatory_flow_strength",
    "flow_direction_consistency","diff_lag1_autocorr","boundary_phase_lag_proxy","sign_flip_rate"];
assert("E2: flow fields present on every file-found row",
    foundRows.every(r => flowFields.every(f => f in r)));

// mean_band_profile present on file-found rows
assert("E3: mean_band_profile present on file-found rows",
    foundRows.every(r => Array.isArray(r.mean_band_profile) && r.mean_band_profile.length === 4));

// WAV meta present on file-found rows
assert("E4: wav_meta present on file-found rows",
    foundRows.every(r => r.wav_meta != null));

// Metric transfer fields in probe_config
const mt = report?.probe_config?.metric_transfer_notes;
assert("E5: metric_transfer_notes present",           mt != null);
assert("E6: 'transfers' list present",                Array.isArray(mt?.transfers));
assert("E7: 'excluded' list present (harmonic metrics excluded)", Array.isArray(mt?.excluded));
assert("E8: excluded note mentions harmonic placement",
    mt?.excluded?.some(s => s.includes("harmonic")));

// resilience_surface_class is not_computed for single-family cohort
assert("E9: resilience_surface_class = not_computed_single_family",
    report?.replay_summary?.resilience_surface_class === "not_computed_single_family");

// ════════════════════════════════════════════════════════════════════════════
// F. Replay summary — band-profile separation and exchange class
// ════════════════════════════════════════════════════════════════════════════
section("F. Replay summary");

const rs = report?.replay_summary ?? {};

// When WAV files are present: check the actual structural findings
if (wavFilesPresent && foundRows.length === 9) {
    console.log(`\n  (WAV files present — running metric assertions)`);

    // All phases are one_way_drift for this real-source cohort
    assert("F1: baseline_flow_mode = one_way_drift",
        rs.baseline_flow_mode === "one_way_drift", `got ${rs.baseline_flow_mode}`);
    assert("F2: perturbation_flow_mode = one_way_drift",
        rs.perturbation_flow_mode === "one_way_drift");
    assert("F3: return_flow_mode = one_way_drift",
        rs.return_flow_mode === "one_way_drift");
    assert("F4: exchange_persistence = non_oscillatory_throughout",
        rs.exchange_persistence_class === "non_oscillatory_throughout",
        `got ${rs.exchange_persistence_class}`);

    // Band-profile separation: perturbation should differ from baseline and return
    const bVsP = rs.baseline_vs_perturbation_band_l1;
    const pVsR = rs.perturbation_vs_return_band_l1;
    const bVsR = rs.baseline_vs_return_band_l1;
    assert("F5: band-profile L1 distances present",
        bVsP != null && pVsR != null && bVsR != null);
    assert("F6: baseline vs perturbation L1 is substantial (> 0.10) — perturbation shifts energy",
        bVsP > 0.10, `got ${bVsP}`);
    assert("F7: baseline vs return L1 is small (< 0.05) — return restores baseline profile",
        bVsR < 0.05, `got ${bVsR}`);
    assert("F8: baseline vs perturbation L1 >> baseline vs return L1 (phase separation legible)",
        bVsP > 5 * bVsR, `bVsP=${bVsP} bVsR=${bVsR}`);

    // Mean band profiles: perturbation should have lower band-0 energy
    const baseBand0   = rs.baseline_mean_band_profile?.[0];
    const pertBand0   = rs.perturbation_mean_band_profile?.[0];
    const returnBand0 = rs.return_mean_band_profile?.[0];
    assert("F9: perturbation band-0 lower than baseline (energy shifted to higher bands)",
        pertBand0 < baseBand0, `pert=${pertBand0} base=${baseBand0}`);
    assert("F10: return band-0 ≈ baseline band-0 (within 0.05)",
        Math.abs(returnBand0 - baseBand0) < 0.05, `ret=${returnBand0} base=${baseBand0}`);

    // real_source_notes present
    assert("F11: real_source_notes present",
        typeof rs.real_source_notes === "object");
    assert("F12: real_source_notes explains non_oscillatory_throughout is structural finding",
        rs.real_source_notes?.oscillatory_exchange_note?.includes("structural finding") ||
        rs.real_source_notes?.flow_mode_all_phases?.includes("expected and honest"));
} else {
    console.log(`\n  (WAV files not present — skipping metric assertions; posture assertions still run)`);
    // Still check summary fields exist
    assert("F1 (posture): exchange_persistence_class field present",
        "exchange_persistence_class" in rs);
    assert("F2 (posture): flow_regime_transition_count field present",
        "flow_regime_transition_count" in rs);
    assert("F3 (posture): real_source_notes field present",
        "real_source_notes" in rs);
}

// Always: cohort_complete and file tracking
assert("F13: cohort_complete field present", "cohort_complete" in rs);
assert("F14: files_found + files_missing = 9",
    (rs.files_found ?? 0) + (rs.files_missing ?? 0) === 9);

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (wavFilesPresent) {
    console.log(`  (WAV files present at ${WAV_DIR})`);
} else {
    console.log(`  (WAV files absent — some metric assertions skipped)`);
}
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
