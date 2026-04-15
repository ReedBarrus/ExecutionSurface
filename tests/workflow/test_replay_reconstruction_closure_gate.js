// tests/workflow/test_replay_reconstruction_closure_gate.js
//
// Focused mechanization closure-gate enforcement test for replay reconstruction.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

let PASS = 0, FAIL = 0;
function section(t) { console.log(`\n── ${t} ──`); }
function ok(cond, label) {
  if (cond) { PASS++; console.log(`  ✓ ${label}`); }
  else { FAIL++; console.error(`  ✗ ${label}`); }
}
function finish() {
  console.log("\n══════════════════════════════════════════════════════");
  console.log(`  ${PASS} passed   ${FAIL} failed`);
  console.log(FAIL === 0 ? "  ALL TESTS PASSED ✓" : "  TESTS FAILED ✗");
  if (FAIL > 0) process.exit(1);
}

const gateSrc = await readFile(path.join(ROOT, "README/WorkflowMechanization/README.MechanizationClosureGate.md"), "utf8");
const backendSrc = await readFile(path.join(ROOT, "runtime/reconstruction/ProvenanceReconstructionPipeline.js"), "utf8");
const modelSrc = await readFile(path.join(ROOT, "hud/replayModel.js"), "utf8");
const renderSrc = await readFile(path.join(ROOT, "hud/ReplayRegion.jsx"), "utf8");

section("A. Closure-gate note exists and preserves compact status model");
ok(gateSrc.includes("declared") && gateSrc.includes("displayed") && gateSrc.includes("partially_mechanized") && gateSrc.includes("mechanized"), "A1: four closure statuses declared");
ok(gateSrc.includes("backend implementation exists"), "A2: backend existence condition declared");
ok(gateSrc.includes("reachable from a real execution/model path"), "A3: real path reachability condition declared");
ok(gateSrc.includes("user-facing surface renders backend-produced result fields"), "A4: rendered backend-field condition declared");
ok(gateSrc.includes("insufficiency/failure path is explicit"), "A5: explicit failure condition declared");
ok(gateSrc.includes("downgrade posture is explicit where applicable"), "A6: explicit downgrade condition declared");
ok(gateSrc.includes("no stronger semantic claim is made than the backend supports"), "A7: semantic overclaim condition declared");
ok(gateSrc.includes("Workflow mechanization does **not** itself imply mechanized engine capability"), "A8: workflow-vs-engine distinction preserved");

section("B. Replay reconstruction backend exists");
ok(backendSrc.includes("export function reconstructFromReplayRequest"), "B1: reconstruction backend exported");
ok(backendSrc.includes("support-trace reconstruction") || backendSrc.includes("support_trace"), "B2: backend remains support-trace bounded");
ok(backendSrc.includes("Tier 1 (durable receipts): positive path"), "B3: backend includes Tier 1 positive path");
ok(backendSrc.includes("Tier 2-4: explicit downgrade / insufficiency posture only"), "B4: backend includes Tier 2-4 explicit posture");
ok(backendSrc.includes("RECONSTRUCTION_FAILED"), "B5: backend includes explicit failure path");
ok(backendSrc.includes("RETAINED_TIER_INSUFFICIENT") || backendSrc.includes("retained_tier_insufficient"), "B6: backend includes explicit downgrade vocabulary");
ok(backendSrc.includes("replay_fidelity_record_v0"), "B7: backend emits replay_fidelity_record_v0");

section("C. Replay model reaches backend through real execution/model path");
ok(modelSrc.includes('import { reconstructFromReplayRequest } from "../runtime/reconstruction/ProvenanceReconstructionPipeline.js";'), "C1: replay model imports reconstruction backend");
ok(modelSrc.includes("attachReconstruction(") && modelSrc.includes("reconstructFromReplayRequest({"), "C2: replay model calls backend through helper path");
ok(modelSrc.includes("buildRuntimeReconstructionReplay") && modelSrc.includes("return attachReconstruction(baseReplay, runResult, workbench);"), "C3: runtime replay builder reaches backend");
ok(modelSrc.includes("buildRequestSupportReplay") && modelSrc.includes("return attachReconstruction(baseReplay, runResult, workbench);"), "C4: request-support replay builder reaches backend");
ok(modelSrc.includes("replay_fidelity_record_v0"), "C5: replay model threads backend fidelity record");

section("D. Active replay surface renders backend-produced result fields");
ok(renderSrc.includes("replay_fidelity_record_v0") && renderSrc.includes("reconstruction_summary") && renderSrc.includes("threshold_posture") && renderSrc.includes("reconstruction_trace"), "D1: replay surface reads backend-produced reconstruction and fidelity fields");
ok(renderSrc.includes("2 · Replay Fidelity Record"), "D2: fidelity record rendered on active surface");
ok(renderSrc.includes("3 · Reconstruction Summary"), "D3: reconstruction summary rendered on active surface");
ok(renderSrc.includes("4 · Threshold Posture / Downgrade"), "D4: threshold posture rendered on active surface");
ok(renderSrc.includes("5 · Reconstruction Trace"), "D5: reconstruction trace rendered on active surface");

section("E. Explicit insufficiency/failure posture is preserved on active surface");
ok(renderSrc.includes("replay failed:"), "E1: failure path rendered explicitly");
ok(renderSrc.includes("explicit downgrade:"), "E2: downgrade posture rendered explicitly");
ok(renderSrc.includes("failure_posture"), "E3: failure posture rendered explicitly");
ok(renderSrc.includes("this is not fulfillment"), "E4: request-support replay still preserves non-fulfillment notice");
ok(!renderSrc.includes("raw restoration") || renderSrc.includes("not truth") || renderSrc.includes("not authority"), "E5: surface does not escalate semantics beyond support posture");

finish();
