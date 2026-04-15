import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    deriveAndValidateProbeReportReceipt,
    deriveProbeReportReceipt,
    readAndValidateProbeReportReceipt,
    writeValidatedProbeReportReceipt,
} from "../runtime/probe/ProbeReportReceipt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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
        console.error(`  not ok ${label}`);
    }
}

function eq(actual, expected, label) {
    ok(Object.is(actual, expected), `${label}${Object.is(actual, expected) ? "" : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`}`);
}

function finish() {
    console.log(`\n${PASS} passed   ${FAIL} failed`);
    if (FAIL > 0) process.exit(1);
}

section("A. Schema file parses");
const rawSchema = await readFile(
    path.join(ROOT, "schemas/probe/probe_report_receipt.schema.json"),
    "utf8"
);
const schema = JSON.parse(rawSchema);
ok(schema.$id.includes("probe_report_receipt"), "A1: probe report receipt schema parses");

section("B. Per-cohort probe receipt");
const activeInteractionReport = {
    probe_type: "active_interaction_zone_probe",
    constitutional_posture: {
        runtime_below_canon: true,
        no_prediction_claims: true,
    },
    disclaimers: {
        not_canon: true,
        probe_is_read_side_only: true,
    },
    per_cohort_rows: [{ cohort_label: "c1" }, { cohort_label: "c2" }],
    comparisons: [{ comparison_type: "active_vs_inert" }],
    probe_summary: {
        hypothesis_supported: true,
    },
};
const activeReceipt = deriveAndValidateProbeReportReceipt(activeInteractionReport, {
    report_path: "./out_experiments/active_interaction_zone_probe/active_interaction_zone_report.json",
});

eq(activeReceipt.validation.ok, true, `B1: active interaction receipt validates${activeReceipt.validation.ok ? "" : ` ${activeReceipt.validation.errors.join("; ")}`}`);
eq(activeReceipt.receipt.row_surface.path, "per_cohort_rows", "B2: per-cohort row surface detected");
eq(activeReceipt.receipt.row_surface.row_count, 2, "B3: per-cohort row count preserved");
eq(activeReceipt.receipt.summary_surface.path, "probe_summary", "B4: probe_summary surface detected");
eq(activeReceipt.receipt.counts.comparison_count, 1, "B5: comparison count preserved");
eq(activeReceipt.receipt.authority_posture.advisory_only, true, "B6: advisory-only posture is explicit");
eq(activeReceipt.receipt.authority_posture.read_side_only, true, "B7: read-side-only posture is explicit");
eq(activeReceipt.receipt.authority_posture.runtime_authority, false, "B8: runtime authority is explicitly denied");
eq(activeReceipt.receipt.authority_posture.canon_authority, false, "B9: canon authority is explicitly denied");

section("C. Replay probe receipt");
const continuousReplayReport = {
    probe_type: "continuous_replay_flow_probe",
    constitutional_posture: {
        runtime_below_canon: true,
        no_prediction_claims: true,
    },
    per_run_rows: [{ run_label: "r1" }, { run_label: "r2" }, { run_label: "r3" }],
    replay_summary: {
        not_canon: true,
        not_prediction: true,
    },
};
const replayReceipt = deriveAndValidateProbeReportReceipt(continuousReplayReport);

eq(replayReceipt.validation.ok, true, `C1: continuous replay receipt validates${replayReceipt.validation.ok ? "" : ` ${replayReceipt.validation.errors.join("; ")}`}`);
eq(replayReceipt.receipt.row_surface.path, "per_run_rows", "C2: per-run row surface detected");
eq(replayReceipt.receipt.summary_surface.path, "replay_summary", "C3: replay_summary surface detected");
eq(replayReceipt.receipt.posture_flags.not_prediction_evidence, true, "C4: not_prediction evidence detected");
eq(replayReceipt.receipt.authority_posture.read_side_only, true, "C5: replay receipt stays read-side only");

section("D. Nested replay receipt");
const tighterBandReport = {
    probe_type: "tighter_band_real_source_probe",
    constitutional_posture: {
        runtime_below_canon: true,
        no_prediction_claims: true,
    },
    labeled_replay: {
        per_run_rows: [{ run_label: "r1" }],
        replay_summary: {
            not_canon: true,
            not_prediction: true,
        },
    },
};
const tighterReceipt = deriveProbeReportReceipt(tighterBandReport);

eq(tighterReceipt.row_surface.path, "labeled_replay.per_run_rows", "D1: nested replay row surface detected");
eq(tighterReceipt.summary_surface.path, "labeled_replay.replay_summary", "D2: nested replay summary detected");
eq(tighterReceipt.posture_flags.not_canon_evidence, true, "D3: nested replay not_canon evidence detected");
eq(tighterReceipt.authority_posture.runtime_authority, false, "D4: nested replay receipt denies runtime authority");

section("E. Cross-family probe receipt");
const resilienceReport = {
    probe_type: "replay_resilience_surface_probe",
    constitutional_posture: {
        runtime_below_canon: true,
        no_prediction_claims: true,
    },
    per_run_rows: [{ run_label: "r1" }, { run_label: "r2" }],
    family_summaries: [{ perturbation_family: "amp" }, { perturbation_family: "noise" }],
    cross_family_summary: {
        not_canon: true,
        not_prediction: true,
    },
};
const resilienceReceipt = deriveAndValidateProbeReportReceipt(resilienceReport);

eq(resilienceReceipt.validation.ok, true, `E1: resilience receipt validates${resilienceReceipt.validation.ok ? "" : ` ${resilienceReceipt.validation.errors.join("; ")}`}`);
eq(resilienceReceipt.receipt.counts.family_summary_count, 2, "E2: family summary count preserved");
eq(resilienceReceipt.receipt.summary_surface.path, "cross_family_summary", "E3: cross-family summary surface detected");
eq(resilienceReceipt.receipt.posture_flags.has_constitutional_posture, true, "E4: constitutional posture detected");
eq(resilienceReceipt.receipt.authority_posture.canon_authority, false, "E5: resilience receipt denies canon authority");

section("F. Receipt write/read validation");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "dme-probe-receipt-"));
try {
    const outputPath = path.join(tempDir, "active_interaction_zone_probe.receipt.json");
    const writtenReceipt = await writeValidatedProbeReportReceipt(outputPath, activeInteractionReport, {
        report_path: "./out_experiments/active_interaction_zone_probe/active_interaction_zone_report.json",
    });
    const writtenRaw = await readFile(outputPath, "utf8");
    const readBack = await readAndValidateProbeReportReceipt(outputPath);

    eq(readBack.validation.ok, true, `F1: read-back probe receipt validates${readBack.validation.ok ? "" : ` ${readBack.validation.errors.join("; ")}`}`);
    eq(readBack.receipt.receipt_type, "runtime:probe_report_receipt", "F2: receipt type preserved on disk");
    eq(readBack.receipt.authority_posture.advisory_only, true, "F3: disk receipt preserves advisory posture");
    eq(readBack.receipt.authority_posture.runtime_authority, false, "F4: disk receipt preserves non-authority posture");
    eq(writtenRaw.endsWith("\n"), true, "F5: receipt artifact is newline-terminated for clean diffs");
    eq(JSON.stringify(readBack.receipt), JSON.stringify(writtenReceipt), "F6: read-back receipt matches written receipt");
} finally {
    await rm(tempDir, { recursive: true, force: true });
}

section("G. Boundary integrity");
const boundaryReceipt = deriveProbeReportReceipt(activeInteractionReport);
const boundaryReceiptString = JSON.stringify(boundaryReceipt);
ok(!boundaryReceiptString.includes("\"canonical\""), "G1: receipt does not carry canonical authority");
ok(!boundaryReceiptString.includes("\"promoted\""), "G2: receipt does not carry promotion authority");
ok(!boundaryReceiptString.includes("\"truth\""), "G3: receipt does not carry truth authority");
eq(boundaryReceipt.authority_posture.advisory_only, true, "G4: receipt states advisory-only posture");
eq(boundaryReceipt.authority_posture.read_side_only, true, "G5: receipt states read-side-only posture");

finish();
