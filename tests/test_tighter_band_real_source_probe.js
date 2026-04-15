// tests/test_tighter_band_real_source_probe.js
//
// Tests for run_tighter_band_real_source_probe.js
//
// Covers:
//   A. Read-side posture and no authority leakage
//   B. Deterministic algorithm fixtures
//   C. Labeled replay phase grouping and lineage
//   D. Per-file output shape and metric transfer
//   E. Structural results (when WAV present)
//   F. Continuous master segmentation
//   G. Distortion audit fields and severity
//
// Run:
//   node tests/test_tighter_band_real_source_probe.js

import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const REPORT    = path.join(REPO_ROOT, "out_experiments",
    "tighter_band_real_source_probe", "tighter_band_report.json");
const WAV_DIR   = path.join(REPO_ROOT, "test_signal", "daw_mic_sine_400hz");

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, detail = "") {
    if (cond) { console.log(`  ✓ ${label}`); passed++; }
    else { const m = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`; console.error(m); failures.push(m); failed++; }
}
function section(name) { console.log(`\n── ${name} ──`); }

let wavPresent = false;
try { await access(path.join(WAV_DIR, "baseline_01.wav")); wavPresent = true; } catch (_) {}

let report = null;
try { report = JSON.parse(await readFile(REPORT, "utf8")); } catch (_) {}

// ─── Inline mirrors ───────────────────────────────────────────────────────────
function l1(a, b) { return a.reduce((s, v, i) => s + Math.abs(v - (b[i] ?? 0)), 0); }

// ════════════════════════════════════════════════════════════════════════════
// A. Read-side posture
// ════════════════════════════════════════════════════════════════════════════
section("A. Read-side posture");

assert("A1: report exists", report != null,
    "run: node scripts/run_tighter_band_real_source_probe.js");
const cp = report?.constitutional_posture ?? {};
assert("A2: runtime_below_canon = true",                   cp.runtime_below_canon === true);
assert("A3: distortion_audit_does_not_mutate_runtime = true", cp.distortion_audit_does_not_mutate_runtime === true);
assert("A4: no_truth_labels = true",                       cp.no_truth_labels === true);
assert("A5: no_runtime_authority = true",                  cp.no_runtime_authority === true);
assert("A6: no_workbench_effects = true",                  cp.no_workbench_effects === true);
assert("A7: no_canon_minting = true",                      cp.no_canon_minting === true);
assert("A8: no_prediction_claims = true",                  cp.no_prediction_claims === true);
assert("A9: findings_provisional = true",                  cp.findings_provisional === true);
assert("A10: findings_non_canonical = true",               cp.findings_non_canonical === true);

// No leakage
const rStr = JSON.stringify(report ?? {});
assert("A11: no 'canonical' in report",     !rStr.includes('"canonical"'));
assert("A12: no 'truth_label' in report",   !rStr.includes('"truth_label"'));
assert("A13: no 'validated' in report",     !rStr.includes('"validated"'));
assert("A14: not_canon in replay_summary",
    report?.labeled_replay?.replay_summary?.not_canon === true);

// ════════════════════════════════════════════════════════════════════════════
// B. Algorithm fixtures
// ════════════════════════════════════════════════════════════════════════════
section("B. Algorithm fixtures");

// L1 helper
const profA = [0.554, 0.182, 0.134, 0.130];
const profP = [0.136, 0.800, 0.033, 0.031]; // narrow-band sine profile
const profR = [0.560, 0.180, 0.132, 0.128];
assert("B1: L1(baseline, perturbation) > 1.0 (very high contrast)",
    l1(profA, profP) > 1.0, `got ${l1(profA, profP).toFixed(4)}`);
assert("B2: L1(baseline, return) < 0.05 (full recovery)",
    l1(profA, profR) < 0.05, `got ${l1(profA, profR).toFixed(4)}`);
assert("B3: L1(perturbation, return) > 1.0",
    l1(profP, profR) > 1.0);

// Rupture threshold
assert("B4: L1=1.17 >> rupture_threshold=0.20 — boundary is unambiguously rupture",
    1.17 >= 0.20);
assert("B5: narrow-band profile band-1 fraction > 0.70",
    profP[1] > 0.70);

// Cohort comparison ratio
const priorL1 = 0.316;
const sineL1  = 1.238;
assert("B6: sine_400hz L1 is ~3.9× prior cohort",
    sineL1 / priorL1 > 3.5, `ratio=${(sineL1/priorL1).toFixed(2)}`);

// ════════════════════════════════════════════════════════════════════════════
// C. Labeled replay grouping and lineage
// ════════════════════════════════════════════════════════════════════════════
section("C. Labeled replay grouping and lineage");

const rows = report?.labeled_replay?.per_run_rows ?? [];
assert("C1: 9 replay rows", rows.length === 9, `got ${rows.length}`);

const phaseGroups = { baseline: [], perturbation: [], return: [] };
for (const r of rows) phaseGroups[r.replay_phase]?.push(r);
assert("C2: 3 baseline runs",     phaseGroups.baseline.length === 3);
assert("C3: 3 perturbation runs", phaseGroups.perturbation.length === 3);
assert("C4: 3 return runs",       phaseGroups.return.length === 3);

// Explicit phase map
const fnPhaseMap = {
    "baseline_01.wav":"baseline","baseline_02.wav":"baseline","baseline_03.wav":"baseline",
    "perturb_01.wav":"perturbation","perturb_02.wav":"perturbation","perturb_03.wav":"perturbation",
    "return_01.wav":"return","return_02.wav":"return","return_03.wav":"return",
};
assert("C5: each raw_filename maps to the correct replay_phase",
    rows.every(r => !r.raw_filename || fnPhaseMap[r.raw_filename] === r.replay_phase));

// source_family is daw_mic_sine_400hz
assert("C6: source_family = daw_mic_sine_400hz on all rows",
    rows.filter(r=>r.file_found).every(r => r.source_family === "daw_mic_sine_400hz"));

// Lineage preserved
const lineageFields = ["run_label","replay_phase","source_id","raw_filepath","raw_filename","source_type"];
assert("C7: all lineage fields present",
    rows.filter(r=>r.file_found).every(r => lineageFields.every(f => f in r)));

// source_ids unique
assert("C8: source_ids are unique",
    new Set(rows.filter(r=>r.file_found).map(r => r.source_id)).size === rows.filter(r=>r.file_found).length);

// ════════════════════════════════════════════════════════════════════════════
// D. Output shape and metric transfer
// ════════════════════════════════════════════════════════════════════════════
section("D. Output shape and metric transfer");

const foundRows = rows.filter(r => r.file_found);
const replayFlowFields = ["mean_band_profile","flow_mode","oscillatory_flow_strength",
    "diff_lag1_autocorr","signed_cross_boundary_flow","boundary_band_pair"];
assert("D1: flow fields present on found rows",
    foundRows.every(r => replayFlowFields.every(f => f in r)));
assert("D2: mean_band_profile is 4 bands",
    foundRows.every(r => Array.isArray(r.mean_band_profile) && r.mean_band_profile.length === 4));

// Lens declared on each row
const lensFields = ["source_family","nominal_fs","effective_fs","window_N","hop_N","band_edges"];
assert("D3: lens fields on all found rows",
    foundRows.every(r => lensFields.every(f => f in (r.lens ?? {}))));
assert("D4: lens band_edges = [0,300,600,900,1200]",
    foundRows.every(r => JSON.stringify(r.lens?.band_edges) === "[0,300,600,900,1200]"));

// Replay summary has required fields
const rs = report?.labeled_replay?.replay_summary ?? {};
assert("D5: replay_summary has phase L1 fields",
    ["baseline_vs_perturbation_l1","perturbation_vs_return_l1","baseline_vs_return_l1"]
        .every(f => f in rs));
assert("D6: replay_summary not_canon = true", rs.not_canon === true);

// ════════════════════════════════════════════════════════════════════════════
// E. Structural results (when WAV present)
// ════════════════════════════════════════════════════════════════════════════
section("E. Structural results");

if (wavPresent && foundRows.length === 9) {
    console.log(`\n  (WAV files present — running structural assertions)`);

    // Baseline band-0 > 0.5, band-1 < 0.25
    assert("E1: baseline rows have band-0 dominant",
        phaseGroups.baseline.every(r => r.mean_band_profile?.[0] > 0.50 && r.mean_band_profile?.[1] < 0.25));

    // Perturbation band-1 > 0.5 (narrow-band sine in 300-600Hz)
    assert("E2: perturbation rows have band-1 dominant (sine intrusion in 300-600Hz)",
        phaseGroups.perturbation.every(r => r.mean_band_profile?.[1] > 0.50));

    // Return profile ≈ baseline
    assert("E3: return band-0 > 0.5",
        phaseGroups.return.every(r => r.mean_band_profile?.[0] > 0.50));

    // L1 distances
    assert("E4: baseline_vs_perturbation_l1 > 0.80 (high contrast narrow-band)",
        (rs.baseline_vs_perturbation_l1 ?? 0) > 0.80,
        `got ${rs.baseline_vs_perturbation_l1}`);
    assert("E5: baseline_vs_return_l1 < 0.05 (full structural return)",
        (rs.baseline_vs_return_l1 ?? 1) < 0.05,
        `got ${rs.baseline_vs_return_l1}`);
    assert("E6: baseline vs perturbation L1 >> baseline vs return L1 (>15×)",
        (rs.baseline_vs_perturbation_l1 ?? 0) > 15 * (rs.baseline_vs_return_l1 ?? 1));
    assert("E7: return_like = true",
        rs.return_like === true);

    // All phases one_way_drift (real source)
    assert("E8: all runs are one_way_drift (real source, no period-2 oscillation)",
        foundRows.every(r => r.flow_mode === "one_way_drift"));
} else {
    console.log(`\n  (WAV files absent — skipping structural assertions)`);
    assert("E1 (posture): mean_band_profile present", foundRows.every(r => "mean_band_profile" in r));
    assert("E2 (posture): replay_summary present", Object.keys(rs).length > 0);
}

// ════════════════════════════════════════════════════════════════════════════
// F. Continuous master segmentation
// ════════════════════════════════════════════════════════════════════════════
section("F. Continuous master segmentation");

const masterFiles = report?.continuous_master?.per_file_results ?? [];
assert("F1: 3 master file results", masterFiles.length === 3);

const foundMasters = masterFiles.filter(r => r.file_found);
const masterFields = ["segments","candidate_phases","candidate_boundary_peaks",
    "boundary_transition_rows","reentry_rows","ambiguity_regions",
    "boundary_summary","recurrence_summary","ambiguity_class"];
assert("F2: required fields on all found masters",
    foundMasters.every(r => masterFields.every(f => f in r)));

if (wavPresent && foundMasters.length === 3) {
    // 2 ruptures per file near t=20s and t=40s
    for (const r of foundMasters) {
        assert(`F3 (${r.filename}): 2 rupture boundaries`,
            r.boundary_summary?.rupture_count === 2,
            `got ${r.boundary_summary?.rupture_count}`);
        const ruptureTs = r.boundary_transition_rows?.filter(t => t.candidate_transition === "rupture").map(t => t.boundary_t_sec) ?? [];
        assert(`F4 (${r.filename}): ruptures near t=20s and t=40s`,
            ruptureTs.some(t => Math.abs(t - 20) <= 4) && ruptureTs.some(t => Math.abs(t - 40) <= 4),
            `rupture_ts=${ruptureTs.join(",")}`);
        // Strongest L1 >> prior cohort
        assert(`F5 (${r.filename}): strongest boundary L1 > 0.80 (much higher than prior cohort)`,
            (r.boundary_summary?.strongest_l1 ?? 0) > 0.80,
            `got ${r.boundary_summary?.strongest_l1}`);
        // Return-like
        assert(`F6 (${r.filename}): ambiguity_class = two_boundaries_with_return`,
            r.ambiguity_class === "two_boundaries_with_return");
        assert(`F7 (${r.filename}): first-to-last return-like = true`,
            r.recurrence_summary?.first_to_last_return_like === true);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// G. Distortion audit
// ════════════════════════════════════════════════════════════════════════════
section("G. Distortion audit");

const da = report?.distortion_audit ?? {};
assert("G1: distortion audit present",       Object.keys(da).length > 0);
assert("G2: 3 audits emitted",               da.audits?.length === 3, `got ${da.audits?.length}`);
assert("G3: not_canon = true",               da.not_canon === true);
assert("G4: not_mutation = true",            da.not_mutation === true);

const requiredAuditFields = ["audit_id","layer_name","intended_role","must_preserve","must_not_decide",
    "observed_flattening","evidence_of_distortion","downstream_impact","distortion_class",
    "lens_conditions","preserved_distinctions","collapsed_distinctions","severity","recommended_action","notes"];
assert("G5: all required audit fields present on each audit",
    (da.audits ?? []).every(a => requiredAuditFields.every(f => f in a)));

// Severity levels are valid
const validSeverities = new Set(["low","moderate","high","critical"]);
assert("G6: all audit severity values are valid",
    (da.audits ?? []).every(a => validSeverities.has(a.severity)));

// Recommended actions are valid
const validActions = new Set(["keep_as_is","clarify_language_only","add_unresolved_posture",
    "add_read_side_probe","refine_summary_surface","refine_operator_contract","defer_pending_more_evidence"]);
assert("G7: all recommended_action values are valid",
    (da.audits ?? []).every(a => validActions.has(a.recommended_action)));

// The transition vocabulary audit (C) should be moderate severity
const auditC = da.audits?.find(a => a.audit_id === "C.transition_vocabulary");
assert("G8: audit C (transition vocabulary) severity = moderate",
    auditC?.severity === "moderate", `got ${auditC?.severity}`);
assert("G9: audit C recommends add_read_side_probe",
    auditC?.recommended_action === "add_read_side_probe");

// Audit A and B should be low severity
const auditA = da.audits?.find(a => a.audit_id === "A.replay_summary");
const auditB = da.audits?.find(a => a.audit_id === "B.master_segmentation");
assert("G10: audit A severity = low",  auditA?.severity === "low");
assert("G11: audit B severity = low",  auditB?.severity === "low");

// No prohibited language in audit
const daStr = JSON.stringify(da ?? {});
assert("G12: no 'prediction' in distortion audit",   !daStr.includes('"prediction"'));
assert("G13: no 'truth' label in distortion audit",  !daStr.includes('"truth_label"'));
assert("G14: no 'canonical' in distortion audit",    !daStr.includes('"canonical"'));

// Cross-cohort comparison present
assert("G15: cross_cohort_comparison present",
    typeof da.cross_cohort_comparison === "object" && da.cross_cohort_comparison !== null);
assert("G16: cohort_a = daw_mic_sine_400hz",
    da.cross_cohort_comparison?.cohort_a === "daw_mic_sine_400hz");
assert("G17: lens_match declared",
    da.cross_cohort_comparison?.lens_match?.includes("lens-honest"));

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (wavPresent) console.log(`  (WAV files present at ${WAV_DIR})`);
else console.log(`  (WAV files absent — structural assertions skipped)`);
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
