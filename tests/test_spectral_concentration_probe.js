// tests/test_spectral_concentration_probe.js
//
// Tests for run_spectral_concentration_probe.js
//
// Covers:
//   A. Read-side posture and no authority leakage
//   B. Concentration descriptor computation on fixtures
//   C. Cross-cohort separation correctness
//   D. Output shape and required fields
//   E. Structural results (when WAV present)
//   F. Distortion-audit follow-through
//
// Run:
//   node tests/test_spectral_concentration_probe.js

import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const REPORT    = path.join(REPO_ROOT, "out_experiments",
    "spectral_concentration_probe", "spectral_concentration_report.json");
const WAV_DIR_PRIOR = path.join(REPO_ROOT, "test_signal", "daw_mic_input");
const WAV_DIR_SINE  = path.join(REPO_ROOT, "test_signal", "daw_mic_sine_400hz");

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, detail = "") {
    if (cond) { console.log(`  ✓ ${label}`); passed++; }
    else { const m = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`; console.error(m); failures.push(m); failed++; }
}
function section(name) { console.log(`\n── ${name} ──`); }

let priorPresent = false, sinePresent = false;
try { await access(path.join(WAV_DIR_PRIOR, "baseline_01.wav")); priorPresent = true; } catch (_) {}
try { await access(path.join(WAV_DIR_SINE,  "baseline_01.wav")); sinePresent  = true; } catch (_) {}
const wavPresent = priorPresent && sinePresent;

let report = null;
try { report = JSON.parse(await readFile(REPORT, "utf8")); } catch (_) {}

// ─── Inline algorithm mirrors ─────────────────────────────────────────────────
const CONCENTRATION_THRESHOLD = 4.0;
const NONTRIVIAL_THRESHOLD    = 0.05;

function concentrationDescriptors(profile) {
    const sorted = [...profile].sort((a, b) => b - a);
    const ratio  = sorted[1] > 0 ? sorted[0] / sorted[1] : 999;
    const domIdx = profile.indexOf(Math.max(...profile));
    const nontrivial = profile.filter(v => v >= NONTRIVIAL_THRESHOLD).length;
    const entropy = -profile.filter(v => v > 0).reduce((s, v) => s + v * Math.log(v), 0);
    const supportClass = sorted[0] < NONTRIVIAL_THRESHOLD ? "unresolved"
        : ratio >= CONCENTRATION_THRESHOLD ? "concentration_high"
        : "redistribution_broad";
    return { dominant_band_index: domIdx, concentration_ratio: parseFloat(ratio.toFixed(4)),
        nontrivial_band_count: nontrivial, profile_entropy: parseFloat(entropy.toFixed(4)),
        rupture_support_class: supportClass };
}

function classifyRuptureMechanism(before, after) {
    const intoConc = after  === "concentration_high";
    const outOfConc = before === "concentration_high";
    if (intoConc && !outOfConc)  return "onset_concentration";
    if (!intoConc && outOfConc)  return "release_concentration";
    if (intoConc && outOfConc)   return "concentration_shift";
    return "redistribution_transition";
}

// ════════════════════════════════════════════════════════════════════════════
// A. Read-side posture
// ════════════════════════════════════════════════════════════════════════════
section("A. Read-side posture");

assert("A1: report exists", report != null,
    "run: node scripts/run_spectral_concentration_probe.js");
const cp = report?.constitutional_posture ?? {};
assert("A2: runtime_below_canon = true",                   cp.runtime_below_canon === true);
assert("A3: concentration_descriptors_are_support = true", cp.concentration_descriptors_are_support === true);
assert("A4: rupture_class_not_redefined = true",           cp.rupture_class_not_redefined === true);
assert("A5: no_truth_labels = true",                       cp.no_truth_labels === true);
assert("A6: no_runtime_authority = true",                  cp.no_runtime_authority === true);
assert("A7: no_canon_minting = true",                      cp.no_canon_minting === true);
assert("A8: no_prediction_claims = true",                  cp.no_prediction_claims === true);
assert("A9: findings_provisional = true",                  cp.findings_provisional === true);

// No leakage
const rStr = JSON.stringify(report ?? {});
assert("A10: no 'canonical' in report",   !rStr.includes('"canonical"'));
assert("A11: no 'truth_label' in report", !rStr.includes('"truth_label"'));
assert("A12: no 'validated' in report",   !rStr.includes('"validated"'));

// Descriptor definitions present
const dd = report?.probe_config?.descriptor_definitions ?? {};
assert("A13: descriptor_definitions has all required keys",
    ["concentration_ratio","nontrivial_band_count","profile_entropy","rupture_support_class","rupture_mechanism"]
        .every(k => k in dd));

// Threshold justification present
assert("A14: threshold_justification present",
    typeof report?.probe_config?.threshold_justification === "object");

// ════════════════════════════════════════════════════════════════════════════
// B. Concentration descriptor computation on fixtures
// ════════════════════════════════════════════════════════════════════════════
section("B. Concentration descriptor computation");

// Narrow-band profile (sine perturbation)
const sinePerturb = [0.136, 0.800, 0.033, 0.031];
const sineConc    = concentrationDescriptors(sinePerturb);
assert("B1: sine profile → concentration_high",
    sineConc.rupture_support_class === "concentration_high",
    `ratio=${sineConc.concentration_ratio}`);
assert("B2: sine profile → dominant_band_index = 1 (300-600Hz)",
    sineConc.dominant_band_index === 1);
assert("B3: sine profile → concentration_ratio > 4.0",
    sineConc.concentration_ratio >= CONCENTRATION_THRESHOLD);
assert("B4: sine profile → nontrivial_band_count = 2",
    sineConc.nontrivial_band_count === 2,
    `got ${sineConc.nontrivial_band_count}`);
assert("B5: sine profile → entropy < 0.80 (concentrated)",
    sineConc.profile_entropy < 0.80, `got ${sineConc.profile_entropy}`);

// Broadband profile (prior cohort perturbation)
const priorPerturb = [0.392, 0.251, 0.221, 0.136];
const priorConc    = concentrationDescriptors(priorPerturb);
assert("B6: prior broadband → redistribution_broad",
    priorConc.rupture_support_class === "redistribution_broad",
    `ratio=${priorConc.concentration_ratio}`);
assert("B7: prior broadband → concentration_ratio < 2.0",
    priorConc.concentration_ratio < 2.0);
assert("B8: prior broadband → nontrivial_band_count = 4",
    priorConc.nontrivial_band_count === 4);
assert("B9: prior broadband → entropy > 1.0 (distributed)",
    priorConc.profile_entropy > 1.0);

// Baseline profile (room noise — both cohorts)
const baseline = [0.554, 0.182, 0.134, 0.130];
const baseConc  = concentrationDescriptors(baseline);
assert("B10: baseline profile → redistribution_broad",
    baseConc.rupture_support_class === "redistribution_broad");
assert("B11: baseline profile → nontrivial_band_count = 4",
    baseConc.nontrivial_band_count === 4);

// Unresolved (near-zero signal)
const zeroProf = [0.001, 0.001, 0.001, 0.001];
assert("B12: near-zero profile → unresolved",
    concentrationDescriptors(zeroProf).rupture_support_class === "unresolved");

// Rupture mechanism classification
assert("B13: broad→concentrated = onset_concentration",
    classifyRuptureMechanism("redistribution_broad", "concentration_high") === "onset_concentration");
assert("B14: concentrated→broad = release_concentration",
    classifyRuptureMechanism("concentration_high", "redistribution_broad") === "release_concentration");
assert("B15: broad→broad = redistribution_transition",
    classifyRuptureMechanism("redistribution_broad", "redistribution_broad") === "redistribution_transition");
assert("B16: concentrated→concentrated = concentration_shift",
    classifyRuptureMechanism("concentration_high", "concentration_high") === "concentration_shift");

// ════════════════════════════════════════════════════════════════════════════
// C. Cross-cohort separation
// ════════════════════════════════════════════════════════════════════════════
section("C. Cross-cohort separation");

const ccc = report?.cross_cohort_comparison ?? {};
assert("C1: cross_cohort_comparison present",     Object.keys(ccc).length > 0);
assert("C2: separation_clean = true",             ccc.separation_clean === true,
    `got ${ccc.separation_clean}`);
assert("C3: comparison_rows present (2 rows)",    ccc.comparison_rows?.length === 2);
assert("C4: lens_match declared",                 ccc.lens_match?.includes("lens-honest"));

if (wavPresent && ccc.comparison_rows?.length === 2) {
    const priorRow = ccc.comparison_rows.find(r => r.cohort_family === "daw_mic_input");
    const sineRow  = ccc.comparison_rows.find(r => r.cohort_family === "daw_mic_sine_400hz");

    assert("C5: prior cohort perturbation → redistribution_broad",
        priorRow?.perturbation_support_class === "redistribution_broad");
    assert("C6: sine cohort perturbation → concentration_high",
        sineRow?.perturbation_support_class === "concentration_high");

    // Ratio separation
    assert("C7: sine perturbation ratio > 4.0",
        (sineRow?.perturbation_mean_ratio ?? 0) >= CONCENTRATION_THRESHOLD,
        `got ${sineRow?.perturbation_mean_ratio}`);
    assert("C8: prior perturbation ratio < 4.0",
        (priorRow?.perturbation_mean_ratio ?? 99) < CONCENTRATION_THRESHOLD,
        `got ${priorRow?.perturbation_mean_ratio}`);

    // Both baselines are redistribution_broad
    assert("C9: both baselines are redistribution_broad",
        priorRow?.baseline_support_class === "redistribution_broad" &&
        sineRow?.baseline_support_class  === "redistribution_broad");

    // Both returns are redistribution_broad
    assert("C10: both returns are redistribution_broad",
        priorRow?.return_support_class === "redistribution_broad" &&
        sineRow?.return_support_class  === "redistribution_broad");

    // Expected classes match
    assert("C11: classification_correct = true for both cohorts",
        ccc.comparison_rows.every(r => r.classification_correct === true));
}

// ════════════════════════════════════════════════════════════════════════════
// D. Output shape and required fields
// ════════════════════════════════════════════════════════════════════════════
section("D. Output shape");

assert("D1: 2 cohort results", report?.per_cohort_results?.length === 2);

const allReplayRows = report?.per_cohort_results?.flatMap(c => c.labeled_replay_rows ?? []) ?? [];
const foundReplayRows = allReplayRows.filter(r => r.file_found);
const concFields = ["dominant_band_index","dominant_band_hz","concentration_ratio",
    "nontrivial_band_count","profile_entropy","rupture_support_class"];
assert("D2: all concentration fields on found replay rows",
    foundReplayRows.every(r => concFields.every(f => f in r)));

// mean_band_profile present
assert("D3: mean_band_profile on all found rows",
    foundReplayRows.every(r => Array.isArray(r.mean_band_profile) && r.mean_band_profile.length === 4));

// Lens declared on all rows
assert("D4: lens fields on all found rows",
    foundReplayRows.every(r => r.lens?.band_edges && r.lens?.concentration_threshold === CONCENTRATION_THRESHOLD));

// Master boundary rows have required mechanism fields
const allBoundaryRows = report?.per_cohort_results
    ?.flatMap(c => c.master_boundary_results ?? [])
    ?.filter(r => r.file_found)
    ?.flatMap(r => r.rupture_rows ?? []) ?? [];
const ruptureFields = ["before_rupture_support","after_rupture_support","rupture_mechanism",
    "before_concentration_ratio","after_concentration_ratio"];
assert("D5: rupture boundary rows have mechanism fields",
    allBoundaryRows.every(r => ruptureFields.every(f => f in r)));

// rupture_support_class values are from allowed set
const allowedClasses = new Set(["concentration_high","redistribution_broad","unresolved"]);
assert("D6: rupture_support_class values are from allowed set",
    foundReplayRows.every(r => allowedClasses.has(r.rupture_support_class)));

// rupture_mechanism values are from allowed set
const allowedMechanisms = new Set(["onset_concentration","release_concentration","concentration_shift","redistribution_transition"]);
assert("D7: rupture_mechanism values are from allowed set",
    allBoundaryRows.every(r => !r.rupture_mechanism || allowedMechanisms.has(r.rupture_mechanism)));

// ════════════════════════════════════════════════════════════════════════════
// E. Structural results (when WAV present)
// ════════════════════════════════════════════════════════════════════════════
section("E. Structural results");

if (wavPresent) {
    console.log(`\n  (Both WAV cohorts present — running structural assertions)`);

    // Prior cohort: all phases redistribution_broad
    const priorCohort = report?.per_cohort_results?.find(c => c.cohort_family === "daw_mic_input");
    const priorRows = priorCohort?.labeled_replay_rows?.filter(r => r.file_found) ?? [];
    assert("E1: all prior cohort rows → redistribution_broad",
        priorRows.every(r => r.rupture_support_class === "redistribution_broad"),
        `failing: ${priorRows.filter(r=>r.rupture_support_class!=="redistribution_broad").map(r=>r.filename)}`);

    // Sine cohort: baseline/return redistribution_broad; perturbation concentration_high
    const sineCohort = report?.per_cohort_results?.find(c => c.cohort_family === "daw_mic_sine_400hz");
    const sineRows   = sineCohort?.labeled_replay_rows?.filter(r => r.file_found) ?? [];
    const baseSine   = sineRows.filter(r => r.replay_phase === "baseline");
    const pertSine   = sineRows.filter(r => r.replay_phase === "perturbation");
    const retSine    = sineRows.filter(r => r.replay_phase === "return");
    assert("E2: sine baseline rows → redistribution_broad",
        baseSine.every(r => r.rupture_support_class === "redistribution_broad"));
    assert("E3: sine perturbation rows → concentration_high",
        pertSine.every(r => r.rupture_support_class === "concentration_high"),
        `failing: ${pertSine.filter(r=>r.rupture_support_class!=="concentration_high").map(r=>r.filename)}`);
    assert("E4: sine return rows → redistribution_broad",
        retSine.every(r => r.rupture_support_class === "redistribution_broad"));

    // Sine master ruptures: onset_concentration at t≈20s, release_concentration at t≈40s
    const sineMasterResults = sineCohort?.master_boundary_results?.filter(r => r.file_found) ?? [];
    for (const r of sineMasterResults) {
        const onsets  = r.rupture_rows?.filter(b => b.rupture_mechanism === "onset_concentration") ?? [];
        const releases = r.rupture_rows?.filter(b => b.rupture_mechanism === "release_concentration") ?? [];
        assert(`E5 (${r.filename}): onset_concentration at t≈20s`,
            onsets.some(b => Math.abs(b.boundary_t_sec - 20) <= 4));
        assert(`E6 (${r.filename}): release_concentration at t≈40s`,
            releases.some(b => Math.abs(b.boundary_t_sec - 40) <= 4));
    }

    // Prior master ruptures: all redistribution_transition
    const priorMasterResults = priorCohort?.master_boundary_results?.filter(r => r.file_found) ?? [];
    for (const r of priorMasterResults) {
        assert(`E7 (${r.filename}): all prior master ruptures → redistribution_transition`,
            r.rupture_rows?.every(b => b.rupture_mechanism === "redistribution_transition"));
    }

    // Sine perturbation nontrivial_band_count = 2; prior = 4
    assert("E8: sine perturbation rows have nontrivial_band_count = 2",
        pertSine.every(r => r.nontrivial_band_count === 2),
        `got: ${pertSine.map(r=>r.nontrivial_band_count).join(",")}`);
    assert("E9: prior perturbation rows have nontrivial_band_count = 4",
        priorRows.filter(r=>r.replay_phase==="perturbation").every(r => r.nontrivial_band_count === 4));
} else {
    console.log(`\n  (WAV files absent — skipping structural assertions)`);
    assert("E1 (posture): concentration_ratio present on all rows",
        foundReplayRows.every(r => typeof r.concentration_ratio === "number"));
    assert("E2 (posture): rupture_support_class present on all rows",
        foundReplayRows.every(r => typeof r.rupture_support_class === "string"));
}

// ════════════════════════════════════════════════════════════════════════════
// F. Distortion-audit follow-through
// ════════════════════════════════════════════════════════════════════════════
section("F. Distortion-audit follow-through");

const ft = report?.distortion_audit_followthrough ?? {};
assert("F1: distortion_audit_followthrough present",     Object.keys(ft).length > 0);
assert("F2: audit_reference cites audit C",              ft.audit_reference?.includes("C.transition_vocabulary") ||
                                                         ft.audit_reference?.includes("Audit C"));
assert("F3: resolution_status = distinction_preserved",  ft.resolution_status === "distinction_preserved",
    `got ${ft.resolution_status}`);
assert("F4: rupture_class_unchanged = true",             ft.rupture_class_unchanged === true);
assert("F5: updated_severity = low",                     ft.updated_severity === "low",
    `got ${ft.updated_severity}`);
assert("F6: recommended_action = clarify_language_only", ft.recommended_action === "clarify_language_only");
assert("F7: not_canon = true",                           ft.not_canon === true);
assert("F8: not_promotion = true",                       ft.not_promotion === true);

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (wavPresent) console.log(`  (Both WAV cohorts present)`);
else console.log(`  (WAV files absent — structural assertions skipped)`);
if (failures.length) {
    console.log("\nFailed:"); failures.forEach(f => console.log(f));
    console.log(`\n  SOME TESTS FAILED ✗`); process.exit(1);
} else { console.log(`  ALL TESTS PASSED ✓`); }
