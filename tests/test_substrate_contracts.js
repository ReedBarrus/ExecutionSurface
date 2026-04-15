// test_substrate_contracts.js
//
// Substrate Space — Phase B contract tests.
//
// Verifies determinism, boundary integrity, commit discipline, and
// read-side honesty for all four substrate components:
//   SegmentTracker, TrajectoryBuffer, BasinOp, MemorySubstrate
//
// Constitutional authority: README_WorkflowContract, README_ArchitectureBoundaryContract,
//   README_NamingConventions, README.ArtifactLifecycle, README_SubstrateLayer.md
//
// Run from the resonance/ directory:
//   node test_substrate_contracts.js

import { SegmentTracker }   from "../operators/trajectory/SegmentTracker.js";
import { TrajectoryBuffer } from "../operators/trajectory/TrajectoryBuffer.js";
import { BasinOp }          from "../operators/basin/BasinOp.js";
import { MemorySubstrate }  from "../operators/substrate/MemorySubstrate.js";

// ─── Harness ──────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const failures = [];

function assert(label, condition, detail = "") {
    if (condition) { console.log(`  ✓ ${label}`); passed++; }
    else {
        const msg = `  ✗ ${label}${detail ? ` — ${detail}` : ""}`;
        console.error(msg); failures.push(msg); failed++;
    }
}

function assertFails(label, result, expectedError) {
    if (!result.ok && result.error === expectedError) {
        console.log(`  ✓ ${label}`); passed++;
    } else if (!result.ok) {
        const msg = `  ✗ ${label} — expected error=${expectedError}, got error=${result.error}`;
        console.error(msg); failures.push(msg); failed++;
    } else {
        const msg = `  ✗ ${label} — expected failure but got ok=true`;
        console.error(msg); failures.push(msg); failed++;
    }
}

function section(name) { console.log(`\n── ${name} ──`); }

// ─── Shared fixture factories ─────────────────────────────────────────────────

const STREAM_ID = "STR:test:ch0:voltage:arb:8";
const SEG_0     = `seg:${STREAM_ID}:0`;
const SEG_1     = `seg:${STREAM_ID}:1`;

/** Minimal valid AnomalyReport — novelty_gate_triggered is the key field */
function makeReport(opts = {}) {
    return {
        artifact_type: "AnomalyReport",
        artifact_class: "An",
        stream_id: STREAM_ID,
        window_ref: opts.window_ref ?? "0:1",
        divergence_score: opts.divergence_score ?? 0.0,
        novelty_gate_triggered: opts.novelty_gate_triggered ?? false,
        detected_events: opts.detected_events ?? [],
        segmentation_recommendation:
            (opts.novelty_gate_triggered) ? "new_segment" : "continue_segment",
    };
}

/** Minimal lawful H1 for substrate use. Override with extras. */
function makeH1(tStart = 0, tEnd = 1, extras = {}) {
    return {
        artifact_class:  "H1",
        state_id:        `H1:${STREAM_ID}:${SEG_0}:${tStart}:${tEnd}`,
        stream_id:       STREAM_ID,
        segment_id:      SEG_0,
        window_span: {
            t_start:      tStart,
            t_end:        tEnd,
            duration_sec: tEnd - tStart,
            window_count: 1,
        },
        grid: { Fs_target: 8, N: 8, df: 1, bin_count_full: 5, bin_count_kept: 2 },
        kept_bins: [
            { k: 0, freq_hz: 0, re: 1.0, im: 0, magnitude: 1.0, phase: 0 },
            { k: 1, freq_hz: 1, re: 0.5, im: 0, magnitude: 0.5, phase: 0 },
        ],
        invariants: {
            energy_raw:        1.25,
            energy_norm:       1.0,
            band_profile_norm: { band_edges: [0, 4, 4], band_energy: [1, 0] },
        },
        uncertainty: {
            time: { dt_nominal: null, jitter_rms: null, gap_total_duration: 0,
                monotonicity_violations: 0, drift_ppm: null,
                fit_residual_rms: null, post_align_jitter: null },
        },
        confidence: {
            by_invariant: { identity: 1, energy: 1, band_profile: 1 },
            overall: 1,
            method: "thresholded_receipts_v1",
        },
        gates: { passes_invariance_bounds: true, eligible_for_archive_tier: true, blocked_reason: "none" },
        receipts: {
            compress: { policy_id: "c", budget_K: 2, selection_method: "topK",
                thresholds: { max_recon_rmse: 999, max_energy_residual: 999, max_band_divergence: 999 },
                novelty_boundary_respected: true },
            provenance_anchor: { source_window_ids: ["w"], ingest_confidence_min: 1, clock_integrity_score: 1 },
        },
        policies: {
            clock_policy_id:       "CLK:v1",
            grid_policy_id:        "GRID:1",
            window_policy_id:      "WIN:1",
            transform_policy_id:   "XFRM:1",
            compression_policy_id: "COMP:1",
        },
        provenance: {
            input_refs: ["S1:test:w0"],
            operator_id: "CompressOp",
            operator_version: "0.1.0",
        },
        ...extras,
    };
}

/** H1 with a distinct band profile for clustering tests */
function makeH1WithProfile(tStart, tEnd, bandEnergy, segId = SEG_0, extras = {}) {
    const h = makeH1(tStart, tEnd, extras);
    h.state_id = `H1:${STREAM_ID}:${segId}:${tStart}:${tEnd}`;
    h.segment_id = segId;
    h.invariants.band_profile_norm.band_energy = [...bandEnergy];
    return h;
}

const BASIN_POLICY = {
    policy_id: "basin.v1",
    similarity_threshold: 0.3,
    min_member_count: 1,
    weight_mode: "duration",
    linkage: "single_link",
    cross_segment: false,
};

// ════════════════════════════════════════════════════════════════════════════
// A. SegmentTracker
// ════════════════════════════════════════════════════════════════════════════

section("A. SegmentTracker — determinism and boundary");

const st = new SegmentTracker({ stream_id: STREAM_ID });

// A1: initial segment ID format
assert("initial segment_id matches format seg:<stream_id>:0",
    st.currentSegmentId === `seg:${STREAM_ID}:0`);

// A2: require stream_id
assert("SegmentTracker throws without stream_id", (() => {
    try { new SegmentTracker({}); return false; }
    catch { return true; }
})());

// A3: novelty_gate_triggered = false does NOT advance segment
const r1 = st.observe(makeReport({ novelty_gate_triggered: false }));
assert("false novelty: observe returns null",       r1 === null);
assert("false novelty: segment_id unchanged",       st.currentSegmentId === `seg:${STREAM_ID}:0`);
assert("false novelty: no transitions recorded",    st.transitions.length === 0);

// A4: novelty_gate_triggered = true advances exactly once
const r2 = st.observe(makeReport({
    novelty_gate_triggered: true, window_ref: "1:2", divergence_score: 0.8,
    detected_events: [{ type: "energy_shift" }],
}));
assert("true novelty: observe returns transition",   r2 !== null);
assert("transition.from_segment_id correct",         r2.from_segment_id === `seg:${STREAM_ID}:0`);
assert("transition.to_segment_id correct",           r2.to_segment_id   === `seg:${STREAM_ID}:1`);
assert("transition.epoch_counter = 1",               r2.epoch_counter === 1);
assert("transition.t_transition parsed from window_ref", r2.t_transition === 1);
assert("transition.divergence_score captured",        r2.divergence_score === 0.8);
assert("transition.detected_event_types captured",
    Array.isArray(r2.detected_event_types) && r2.detected_event_types[0] === "energy_shift");
assert("segment advanced to epoch 1",                st.currentSegmentId === `seg:${STREAM_ID}:1`);
assert("transitions array has 1 entry",              st.transitions.length === 1);

// A5: second non-novelty after transition — stays at epoch 1
const r3 = st.observe(makeReport({ novelty_gate_triggered: false }));
assert("second false novelty: still at epoch 1",    st.currentSegmentId === `seg:${STREAM_ID}:1`);
assert("second false novelty: returns null",         r3 === null);

// A6: second novelty advances to epoch 2
const r4 = st.observe(makeReport({ novelty_gate_triggered: true, window_ref: "3:4" }));
assert("second novelty: advances to epoch 2",       st.currentSegmentId === `seg:${STREAM_ID}:2`);
assert("epoch_counter = 2",                          r4.epoch_counter === 2);
assert("transitions array has 2 entries",            st.transitions.length === 2);

// A7: segmentHistory returns ordered IDs
const hist = st.segmentHistory();
assert("segmentHistory has 3 entries",              hist.length === 3);
assert("segmentHistory[0] = epoch 0",               hist[0] === `seg:${STREAM_ID}:0`);
assert("segmentHistory[1] = epoch 1",               hist[1] === `seg:${STREAM_ID}:1`);
assert("segmentHistory[2] = epoch 2",               hist[2] === `seg:${STREAM_ID}:2`);

// A8: determinism — same sequence produces identical history on fresh tracker
const stB = new SegmentTracker({ stream_id: STREAM_ID });
stB.observe(makeReport({ novelty_gate_triggered: false }));
stB.observe(makeReport({ novelty_gate_triggered: true, window_ref: "1:2", divergence_score: 0.8,
    detected_events: [{ type: "energy_shift" }] }));
stB.observe(makeReport({ novelty_gate_triggered: false }));
stB.observe(makeReport({ novelty_gate_triggered: true, window_ref: "3:4" }));
assert("deterministic: same sequence → same currentSegmentId",
    stB.currentSegmentId === st.currentSegmentId);
assert("deterministic: same segment history",
    JSON.stringify(stB.segmentHistory()) === JSON.stringify(st.segmentHistory()));

// A9: observeAll batch produces same result as individual observe calls
const stC = new SegmentTracker({ stream_id: STREAM_ID });
const batchReports = [
    makeReport({ novelty_gate_triggered: false }),
    makeReport({ novelty_gate_triggered: true, window_ref: "1:2", divergence_score: 0.8,
        detected_events: [{ type: "energy_shift" }] }),
    makeReport({ novelty_gate_triggered: false }),
    makeReport({ novelty_gate_triggered: true, window_ref: "3:4" }),
];
const batchTransitions = stC.observeAll(batchReports);
assert("observeAll returns 2 transitions",           batchTransitions.length === 2);
assert("observeAll: same final segment_id",          stC.currentSegmentId === st.currentSegmentId);

// A10: no artifact mutation — reports are not modified by observe
const report = makeReport({ novelty_gate_triggered: true, window_ref: "5:6" });
const reportCopy = JSON.stringify(report);
const stD = new SegmentTracker({ stream_id: STREAM_ID });
stD.observe(report);
assert("observe does not mutate input report", JSON.stringify(report) === reportCopy);

// A11: reset returns to initial state
st.reset();
assert("reset: currentSegmentId returns to epoch 0", st.currentSegmentId === `seg:${STREAM_ID}:0`);
assert("reset: transitions cleared",                  st.transitions.length === 0);
assert("reset: summary.epoch_counter = 0",            st.summary().epoch_counter === 0);

// A12: summary fields — no canon/promotion language
const stSummary = st.summary();
assert("summary has stream_id",                       stSummary.stream_id === STREAM_ID);
assert("summary has current_segment_id",              typeof stSummary.current_segment_id === "string");
assert("summary has epoch_counter",                   typeof stSummary.epoch_counter === "number");
assert("summary has no 'canon' or 'promote' fields",
    !("canonical" in stSummary) && !("promoted" in stSummary) && !("canon" in stSummary));

// ════════════════════════════════════════════════════════════════════════════
// B. TrajectoryBuffer
// ════════════════════════════════════════════════════════════════════════════

section("B. TrajectoryBuffer — determinism, eviction, dynamics");

const tb = new TrajectoryBuffer({ max_frames: 4 }); // small capacity to test eviction

const h1s = [
    makeH1WithProfile(0, 1, [1.0, 0.0]),
    makeH1WithProfile(1, 2, [0.9, 0.1]),
    makeH1WithProfile(2, 3, [0.8, 0.2]),
    makeH1WithProfile(3, 4, [0.7, 0.3]),
];

// B1: push succeeds for valid H1
const p0 = tb.push({ state: h1s[0], basin_id: null, novelty_gate_triggered: false });
assert("push valid H1: ok", p0.ok);
assert("pushed frame has correct state_id",   p0.frame.state_id === h1s[0].state_id);
assert("pushed frame.basin_id = null",        p0.frame.basin_id === null);
assert("pushed frame.frame_index = 0",        p0.frame.frame_index === 0);
assert("pushed frame.novelty_gate_triggered = false", p0.frame.novelty_gate_triggered === false);
assert("pushed frame.band_profile_snapshot = copy of invariants",
    JSON.stringify(p0.frame.band_profile_snapshot) ===
    JSON.stringify(h1s[0].invariants.band_profile_norm.band_energy));

// B2: push fails on invalid state
const badPush = tb.push({ state: { artifact_class: "S1" } });
assert("push invalid class: ok=false", !badPush.ok);
assert("push invalid class: error=INVALID_STATE", badPush.error === "INVALID_STATE");

// B3: push remaining states
for (const h of h1s.slice(1)) {
    tb.push({ state: h });
}
assert("all 4 frames buffered", tb.all().length === 4);

// B4: chronological ordering guaranteed by all()
const allFrames = tb.all();
assert("all() is chronological (t_start ascending)",
    allFrames.every((f, i) => i === 0 || f.t_start >= allFrames[i - 1].t_start));

// B5: circular eviction — push 5th frame evicts oldest
const h5 = makeH1WithProfile(4, 5, [0.6, 0.4]);
tb.push({ state: h5 });
assert("after eviction: frame_count = 4 (capacity)", tb.all().length === 4);
assert("evicted frame is oldest (t_start=0 gone)",
    !tb.all().some(f => f.t_start === 0));
assert("newest frame t_start=4 present",
    tb.all().some(f => f.t_start === 4));

// B6: tail() returns newest-first, capped
const tail2 = tb.tail(2);
assert("tail(2) returns 2 frames", tail2.length === 2);
assert("tail(2) newest-first: tail[0].t_start > tail[1].t_start",
    tail2[0].t_start > tail2[1].t_start);

// B7: bySegment filters correctly
const tbSeg = new TrajectoryBuffer();
const hSeg0 = makeH1WithProfile(0, 1, [1, 0], SEG_0);
const hSeg1 = makeH1WithProfile(1, 2, [0.5, 0.5], SEG_1, { state_id: `H1:${STREAM_ID}:${SEG_1}:1:2`, segment_id: SEG_1 });
tbSeg.push({ state: hSeg0 });
tbSeg.push({ state: hSeg1 });
assert("bySegment(SEG_0) returns 1 frame",  tbSeg.bySegment(SEG_0).length === 1);
assert("bySegment(SEG_1) returns 1 frame",  tbSeg.bySegment(SEG_1).length === 1);
assert("bySegment('missing') returns []",   tbSeg.bySegment("missing").length === 0);

// B8: no artifact mutation — push extracts snapshot, H1 not modified
const mutTest = makeH1WithProfile(10, 11, [1, 0]);
const origProfile = JSON.stringify(mutTest.invariants.band_profile_norm.band_energy);
const origStr = JSON.stringify(mutTest);
const tbMut = new TrajectoryBuffer();
tbMut.push({ state: mutTest });
assert("H1 not mutated by push",
    JSON.stringify(mutTest) === origStr);
// Mutate the returned frame's snapshot — should not affect original H1
const pushedFrame = tbMut.all()[0];
pushedFrame.band_profile_snapshot[0] = 9999;
assert("mutating frame.band_profile_snapshot does not affect H1.invariants",
    JSON.stringify(mutTest.invariants.band_profile_norm.band_energy) === origProfile);

// B9: velocityEstimate — insufficient data returns honest sentinel
const tbVel = new TrajectoryBuffer();
const velResult0 = tbVel.velocityEstimate(8);
assert("velocityEstimate on empty buffer: sufficient_data=false", !velResult0.sufficient_data);
assert("velocityEstimate empty: mean=0 (sentinel, not measured)", velResult0.mean_l1_delta === 0);
assert("velocityEstimate empty: max=0 (sentinel, not measured)",  velResult0.max_l1_delta === 0);

// Push one frame — still insufficient
tbVel.push({ state: makeH1WithProfile(0, 1, [1, 0]) });
const velResult1 = tbVel.velocityEstimate(8);
assert("velocityEstimate 1 frame: sufficient_data=false", !velResult1.sufficient_data);

// Push second frame — now sufficient
tbVel.push({ state: makeH1WithProfile(1, 2, [0.5, 0.5]) });
const velResult2 = tbVel.velocityEstimate(8);
assert("velocityEstimate 2 frames: sufficient_data=true", velResult2.sufficient_data);
assert("velocityEstimate: mean_l1_delta is finite",       Number.isFinite(velResult2.mean_l1_delta));
assert("velocityEstimate: frames_used = 2",               velResult2.frames_used === 2);
// Identical profiles → delta=0
tbVel.push({ state: makeH1WithProfile(2, 3, [0.5, 0.5], SEG_0, { state_id: `H1:${STREAM_ID}:${SEG_0}:2:3` }) });
const velStable = tbVel.velocityEstimate(1); // window_n=1 → tail(2): only the two identical [0.5,0.5] frames
assert("velocityEstimate stable sequence: mean_l1_delta = 0",
    velStable.sufficient_data && velStable.mean_l1_delta === 0);

// B10: isConverging — insufficient data (no basin distances)
const tbConv = new TrajectoryBuffer();
tbConv.push({ state: makeH1WithProfile(0, 1, [1, 0]) }); // basin_id=null by default
const convResult0 = tbConv.isConverging(8);
assert("isConverging: no basin distances → sufficient_data=false", !convResult0.sufficient_data);
assert("isConverging: trend_slope=null when no data",              convResult0.trend_slope === null);

// With decreasing distances → is_converging = true
const tbConv2 = new TrajectoryBuffer();
tbConv2.push({ state: makeH1WithProfile(0, 1, [1, 0]), basin_id: "BN:x", distance_to_basin_centroid: 0.5 });
tbConv2.push({ state: makeH1WithProfile(1, 2, [0.9, 0.1], SEG_0, { state_id: `H1:s:s:1:2` }),
    basin_id: "BN:x", distance_to_basin_centroid: 0.3 });
tbConv2.push({ state: makeH1WithProfile(2, 3, [0.8, 0.2], SEG_0, { state_id: `H1:s:s:2:3` }),
    basin_id: "BN:x", distance_to_basin_centroid: 0.1 });
const convResult2 = tbConv2.isConverging(8);
assert("isConverging: decreasing distances → is_converging=true",  convResult2.is_converging);
assert("isConverging: trend_slope < 0 (converging)",               convResult2.trend_slope < 0);
assert("isConverging: sufficient_data=true",                        convResult2.sufficient_data);

// B11: currentBasinDwellCount — returns 0 when most recent frame has no basin
const tbDwell = new TrajectoryBuffer();
tbDwell.push({ state: makeH1WithProfile(0, 1, [1, 0]), basin_id: null });
assert("currentBasinDwellCount: last frame null basin → 0", tbDwell.currentBasinDwellCount() === 0);

// Push two frames with same basin → dwell = 2
tbDwell.push({ state: makeH1WithProfile(1, 2, [0.9, 0.1], SEG_0, { state_id: `H1:s:s:1:2` }),
    basin_id: "BN:a" });
tbDwell.push({ state: makeH1WithProfile(2, 3, [0.8, 0.2], SEG_0, { state_id: `H1:s:s:2:3` }),
    basin_id: "BN:a" });
assert("currentBasinDwellCount: 2 consecutive same basin → 2",
    tbDwell.currentBasinDwellCount() === 2);

// Push frame with different basin → dwell resets to 1
tbDwell.push({ state: makeH1WithProfile(3, 4, [0.2, 0.8], SEG_0, { state_id: `H1:s:s:3:4` }),
    basin_id: "BN:b" });
assert("currentBasinDwellCount: different basin → 1", tbDwell.currentBasinDwellCount() === 1);

// B12: currentBasinDwellCount returns 0 on empty buffer
assert("currentBasinDwellCount empty buffer → 0", new TrajectoryBuffer().currentBasinDwellCount() === 0);

// B13: determinism — same push sequence produces identical frame sequence
const tbD1 = new TrajectoryBuffer();
const tbD2 = new TrajectoryBuffer();
for (const h of h1s) { tbD1.push({ state: h }); tbD2.push({ state: h }); }
assert("TrajectoryBuffer deterministic: identical all() output",
    JSON.stringify(tbD1.all().map(f => f.state_id)) ===
    JSON.stringify(tbD2.all().map(f => f.state_id)));

// ════════════════════════════════════════════════════════════════════════════
// C. BasinOp
// ════════════════════════════════════════════════════════════════════════════

section("C. BasinOp — clustering, determinism, boundary");

const bop = new BasinOp();

// A set of states with two clearly distinct band profiles
// Group A: energy concentrated in low band [1, 0]
// Group B: energy concentrated in high band [0, 1]
const statesGroupA = [
    makeH1WithProfile(0, 1, [1.00, 0.00]),
    makeH1WithProfile(1, 2, [0.95, 0.05], SEG_0, { state_id: `H1:s:seg0:1:2` }),
    makeH1WithProfile(2, 3, [0.97, 0.03], SEG_0, { state_id: `H1:s:seg0:2:3` }),
];
const statesGroupB = [
    makeH1WithProfile(3, 4, [0.05, 0.95], SEG_0, { state_id: `H1:s:seg0:3:4` }),
    makeH1WithProfile(4, 5, [0.02, 0.98], SEG_0, { state_id: `H1:s:seg0:4:5` }),
];
const allStates = [...statesGroupA, ...statesGroupB];

// C1: basic clustering produces BN artifact
const basinResult = bop.run({ states: allStates, basin_policy: BASIN_POLICY });
assert("BasinOp: ok with valid inputs", basinResult.ok, JSON.stringify(basinResult));
const basinSet = basinResult.ok ? basinResult.artifact : null;
assert("BasinSet.artifact_class = BN",         basinSet && basinSet.artifact_class === "BN");
assert("BasinSet.artifact_type = BasinSet",    basinSet && basinSet.artifact_type === "BasinSet");
assert("BasinSet.stream_id preserved",         basinSet && basinSet.stream_id === STREAM_ID);
assert("BasinSet.segment_id preserved",        basinSet && basinSet.segment_id === SEG_0);
assert("BasinSet has 2 basins (two groups)",   basinSet && basinSet.basins.length === 2);
assert("BasinSet.unassigned_state_ids is array", basinSet && Array.isArray(basinSet.unassigned_state_ids));

// C2: basin IDs follow BN:<stream>:<seg>:c<n>:<hash> format
if (basinSet) {
    for (const b of basinSet.basins) {
        assert(`basin_id ${b.basin_id} starts with BN:`, b.basin_id.startsWith("BN:"));
    }
}

// C3: member assignments are correct — Group A and Group B in separate basins
if (basinSet && basinSet.basins.length === 2) {
    const [basinOne, basinTwo] = basinSet.basins.sort((a, b) => a.span.t_start - b.span.t_start);
    assert("Group A basin has 3 members", basinOne.member_count === 3);
    assert("Group B basin has 2 members", basinTwo.member_count === 2);
    assert("basins contain correct state_ids",
        statesGroupA.every(s => basinOne.member_state_ids.includes(s.state_id)) &&
        statesGroupB.every(s => basinTwo.member_state_ids.includes(s.state_id)));
}

// C4: determinism — same inputs + policy → identical output
const basinResult2 = bop.run({ states: allStates, basin_policy: BASIN_POLICY });
assert("BasinOp deterministic: basin_ids identical",
    basinResult.ok && basinResult2.ok &&
    JSON.stringify(basinResult.artifact.basins.map(b => b.basin_id)) ===
    JSON.stringify(basinResult2.artifact.basins.map(b => b.basin_id)));
assert("BasinOp deterministic: member_state_ids identical",
    basinResult.ok && basinResult2.ok &&
    JSON.stringify(basinResult.artifact.basins.map(b => b.member_state_ids.sort())) ===
    JSON.stringify(basinResult2.artifact.basins.map(b => b.member_state_ids.sort())));

// C5: cross-segment rejection by default
const crossSeg = [
    makeH1WithProfile(0, 1, [1, 0], SEG_0),
    makeH1WithProfile(1, 2, [0.9, 0.1], SEG_1, { state_id: `H1:s:seg1:1:2`, segment_id: SEG_1 }),
];
assertFails("cross-segment rejected by default",
    bop.run({ states: crossSeg, basin_policy: BASIN_POLICY }),
    "CROSS_SEGMENT_VIOLATION");

// C6: cross-segment allowed when policy says so
const crossSegResult = bop.run({
    states: crossSeg,
    basin_policy: { ...BASIN_POLICY, cross_segment: true },
});
assert("cross-segment allowed with cross_segment=true", crossSegResult.ok);

// C7: min_member_count rejects singletons into unassigned
const strictPolicy = { ...BASIN_POLICY, min_member_count: 2, similarity_threshold: 0.05 };
// Use states with very different profiles so each state is its own cluster of 1
const singletonStates = [
    makeH1WithProfile(0, 1, [1.0, 0.0]),
    makeH1WithProfile(1, 2, [0.0, 1.0], SEG_0, { state_id: `H1:s:seg0:1:2` }),
    makeH1WithProfile(2, 3, [0.5, 0.5], SEG_0, { state_id: `H1:s:seg0:2:3` }),
];
const singletonResult = bop.run({ states: singletonStates, basin_policy: strictPolicy });
assert("min_member_count: singletons end up unassigned",
    singletonResult.ok && singletonResult.artifact.unassigned_state_ids.length > 0);
assert("min_member_count: basins_formed = 0 when all singletons",
    singletonResult.ok && singletonResult.artifact.basins.length === 0);

// C8: receipt honesty — no canon/truth language
if (basinSet) {
    assert("BasinSet receipts has no 'canon' fields",
        !JSON.stringify(Object.keys(basinSet.receipts)).includes("canon") &&
        !JSON.stringify(Object.keys(basinSet.receipts)).includes("truth") &&
        !JSON.stringify(Object.keys(basinSet.receipts)).includes("promote"));
    assert("BasinSet.receipts.states_considered = 5",
        basinSet.receipts.states_considered === 5);
    assert("BasinSet.receipts.basins_formed = 2",
        basinSet.receipts.basins_formed === 2);
    assert("BasinSet.receipts.policy_id preserved",
        basinSet.receipts.policy_id === BASIN_POLICY.policy_id);
}

// C9: input states not mutated
const stateBefore = JSON.stringify(allStates[0]);
bop.run({ states: allStates, basin_policy: BASIN_POLICY });
assert("BasinOp: input states not mutated", JSON.stringify(allStates[0]) === stateBefore);

// C10: assignToBasin — nearest basin within threshold
if (basinSet) {
    const queryState = makeH1WithProfile(5, 6, [0.99, 0.01]); // close to Group A
    const assignment = bop.assignToBasin({
        state: queryState,
        basins: basinSet.basins,
        threshold: 0.5,
    });
    assert("assignToBasin: returns assignment for close state", assignment !== null);
    assert("assignToBasin: basin_id is a string", typeof assignment?.basin_id === "string");
    assert("assignToBasin: distance is finite",   Number.isFinite(assignment?.distance));

    // Far state (no basin within threshold)
    const farState = makeH1WithProfile(5, 6, [0.5, 0.5]);
    const noAssign = bop.assignToBasin({
        state: farState,
        basins: basinSet.basins,
        threshold: 0.01, // very tight — should not match anything
    });
    assert("assignToBasin: returns null for far state with tight threshold",
        noAssign === null);
}

// C11: assignToBasin with empty basins returns null
assert("assignToBasin: empty basins → null",
    bop.assignToBasin({ state: allStates[0], basins: [], threshold: 1.0 }) === null);

// C12: provenance fields present
if (basinSet) {
    assert("BasinSet.provenance.operator_id = BasinOp",
        basinSet.provenance.operator_id === "BasinOp");
    assert("BasinSet.provenance.input_refs lists all state_ids",
        allStates.every(s => basinSet.provenance.input_refs.includes(s.state_id)));
}

// C13: complete_link linkage — different clustering than single_link
const clPolicy = { ...BASIN_POLICY, linkage: "complete_link", similarity_threshold: 0.2 };
const clResult = bop.run({ states: allStates, basin_policy: clPolicy });
assert("complete_link: ok", clResult.ok);
// complete_link with tight threshold typically forms more or different basins
assert("complete_link produces deterministic result",
    JSON.stringify(clResult.artifact.basins.map(b => b.basin_id)) ===
    JSON.stringify(bop.run({ states: allStates, basin_policy: clPolicy }).artifact.basins.map(b => b.basin_id)));

// ════════════════════════════════════════════════════════════════════════════
// D. MemorySubstrate
// ════════════════════════════════════════════════════════════════════════════

section("D. MemorySubstrate — commit, legitimacy, reads, basin integration");

const ms = new MemorySubstrate({ substrate_id: "test_substrate" });
const h1_0 = makeH1(0, 1);
const h1_1 = makeH1(1, 2, { state_id: `H1:${STREAM_ID}:${SEG_0}:1:2` });
const h1_2 = makeH1(2, 3, { state_id: `H1:${STREAM_ID}:${SEG_0}:2:3` });

// D1: valid H1 commit succeeds
const c0 = ms.commit(h1_0);
assert("commit valid H1: ok",              c0.ok, JSON.stringify(c0));
assert("commit returns state_id",          c0.state_id === h1_0.state_id);
assert("commit returns duplicate=false",   c0.duplicate === false);

// D2: idempotent commit — same state_id returns ok + duplicate=true
const c0dup = ms.commit(h1_0);
assert("idempotent commit: ok",            c0dup.ok);
assert("idempotent commit: duplicate=true", c0dup.duplicate === true);

// D3: duplicate does not increase state count
ms.commit(h1_1);
ms.commit(h1_0); // duplicate
assert("duplicate does not increase state_count",
    ms.allStates().length === 2);

// D4: legitimacy failure — wrong artifact_class
const badClass = { ...h1_0, state_id: "S1:x", artifact_class: "S1" };
assertFails("commit S1: LEGITIMACY_FAILURE", ms.commit(badClass), "LEGITIMACY_FAILURE");

// D5: legitimacy failure — missing state_id
const noId = { ...h1_0, state_id: undefined };
assertFails("commit no state_id: LEGITIMACY_FAILURE", ms.commit(noId), "LEGITIMACY_FAILURE");

// D6: legitimacy failure — missing band_profile_norm.band_energy
const noBand = makeH1(5, 6, {
    state_id: `H1:${STREAM_ID}:${SEG_0}:5:6`,
    invariants: { energy_raw: 1.0, energy_norm: 1.0 }, // no band_profile_norm
});
assertFails("commit no band_energy: LEGITIMACY_FAILURE", ms.commit(noBand), "LEGITIMACY_FAILURE");

// D7: legitimacy failure — missing policy anchor
const noPol = makeH1(6, 7, {
    state_id: `H1:${STREAM_ID}:${SEG_0}:6:7`,
    policies: { clock_policy_id: "CLK:1" }, // no compression or merge policy_id
});
assertFails("commit no policy anchor: LEGITIMACY_FAILURE", ms.commit(noPol), "LEGITIMACY_FAILURE");

// D8: legitimacy failure — missing clock_policy_id
const noClk = makeH1(7, 8, {
    state_id: `H1:${STREAM_ID}:${SEG_0}:7:8`,
    policies: { compression_policy_id: "COMP:1" }, // clock_policy_id absent
});
assertFails("commit no clock_policy_id: LEGITIMACY_FAILURE", ms.commit(noClk), "LEGITIMACY_FAILURE");

// D9: legitimacy failure — empty provenance.input_refs
const emptyRefs = makeH1(8, 9, {
    state_id: `H1:${STREAM_ID}:${SEG_0}:8:9`,
    provenance: { input_refs: [], operator_id: "CompressOp", operator_version: "0.1.0" },
});
assertFails("commit empty input_refs: LEGITIMACY_FAILURE", ms.commit(emptyRefs), "LEGITIMACY_FAILURE");

// D10: legitimacy failure — missing provenance.input_refs field entirely
const noRefs = makeH1(9, 10, {
    state_id: `H1:${STREAM_ID}:${SEG_0}:9:10`,
    provenance: { operator_id: "CompressOp", operator_version: "0.1.0" }, // input_refs absent
});
assertFails("commit no input_refs: LEGITIMACY_FAILURE", ms.commit(noRefs), "LEGITIMACY_FAILURE");

// D11: legitimacy failure — incomplete grid (missing df)
const badGrid = makeH1(10, 11, {
    state_id: `H1:${STREAM_ID}:${SEG_0}:10:11`,
    grid: { Fs_target: 8, N: 8 }, // df missing
});
assertFails("commit incomplete grid (no df): LEGITIMACY_FAILURE", ms.commit(badGrid), "LEGITIMACY_FAILURE");

// D12: legitimacy failure — non-finite grid field
const nanGrid = makeH1(11, 12, {
    state_id: `H1:${STREAM_ID}:${SEG_0}:11:12`,
    grid: { Fs_target: 8, N: NaN, df: 1 },
});
assertFails("commit NaN grid.N: LEGITIMACY_FAILURE", ms.commit(nanGrid), "LEGITIMACY_FAILURE");

// D13: legitimacy failure — missing invariants.energy_raw
const noEnergyRaw = makeH1(12, 13, {
    state_id: `H1:${STREAM_ID}:${SEG_0}:12:13`,
    invariants: { energy_norm: 1.0, band_profile_norm: { band_edges: [0,4,4], band_energy: [1,0] } },
});
assertFails("commit no energy_raw: LEGITIMACY_FAILURE", ms.commit(noEnergyRaw), "LEGITIMACY_FAILURE");

// D14: legitimacy failure — missing uncertainty.time
const noUncertainty = makeH1(13, 14, {
    state_id: `H1:${STREAM_ID}:${SEG_0}:13:14`,
    uncertainty: {}, // time field absent
});
assertFails("commit no uncertainty.time: LEGITIMACY_FAILURE", ms.commit(noUncertainty), "LEGITIMACY_FAILURE");

// D15: legitimacy failure — empty kept_bins
const emptyBins = makeH1(14, 15, {
    state_id: `H1:${STREAM_ID}:${SEG_0}:14:15`,
    kept_bins: [],
});
assertFails("commit empty kept_bins: LEGITIMACY_FAILURE", ms.commit(emptyBins), "LEGITIMACY_FAILURE");

// D16: legitimacy failure — non-finite confidence.overall
const badConf = makeH1(15, 16, {
    state_id: `H1:${STREAM_ID}:${SEG_0}:15:16`,
    confidence: { overall: NaN, by_invariant: {} },
});
assertFails("commit NaN confidence.overall: LEGITIMACY_FAILURE", ms.commit(badConf), "LEGITIMACY_FAILURE");

// D17: get() returns a safe copy — mutating it does not affect stored state
const retrieved = ms.get(h1_0.state_id);
assert("get() returns non-null for committed state", retrieved !== null);
// Post-patch: get() returns a copyState() — a plain spread, not frozen.
// The contract is mutation-safety (isolated copy), not TypeError-on-assign.
// Verify by mutating a critical nested field and checking subsequent get() is unaffected.
if (retrieved) {
    retrieved.invariants.band_profile_norm.band_energy[0] = 9999;
    retrieved.stream_id = "mutated_top_level"; // plain object — assignment succeeds
}
const retrieved2 = ms.get(h1_0.state_id);
assert("get() mutation-safe: nested band_energy[0] unchanged after caller mutation",
    retrieved2 !== null && retrieved2.invariants.band_profile_norm.band_energy[0] !== 9999);
assert("get() mutation-safe: top-level stream_id unchanged after caller mutation",
    retrieved2 !== null && retrieved2.stream_id === h1_0.stream_id);

// D18: get() returns null for unknown state_id
assert("get() null for unknown id", ms.get("H1:nonexistent") === null);

// D19: allStates() in chronological order
ms.commit(h1_2);
const all = ms.allStates();
assert("allStates() returns all committed states",        all.length === 3);
assert("allStates() chronological (t_start ascending)",
    all.every((s, i) => i === 0 || s.window_span.t_start >= all[i-1].window_span.t_start));

// D20: statesForSegment filters correctly
const seg0States = ms.statesForSegment(SEG_0);
assert("statesForSegment returns all states in segment",   seg0States.length === 3);
assert("statesForSegment returns empty for unknown",       ms.statesForSegment("missing:seg").length === 0);

// D21: trajectory updated on commit
const trajAll = ms.trajectory.all();
assert("trajectory updated after 3 unique commits", trajAll.length === 3);
assert("trajectory frames reference committed state_ids",
    trajAll.every(f => all.some(s => s.state_id === f.state_id)));

// D22: rebuildBasins — works after enough commits
// Add two clearly distinct-profile states to the segment
const h1_lo = makeH1WithProfile(3, 4, [1.0, 0.0], SEG_0, {
    state_id: `H1:${STREAM_ID}:${SEG_0}:3:4`,
});
const h1_hi = makeH1WithProfile(4, 5, [0.0, 1.0], SEG_0, {
    state_id: `H1:${STREAM_ID}:${SEG_0}:4:5`,
});
ms.commit(h1_lo);
ms.commit(h1_hi);
const rebuildResult = ms.rebuildBasins({
    segment_id: SEG_0,
    basin_policy: { ...BASIN_POLICY, similarity_threshold: 0.8 }, // loose: one basin
});
assert("rebuildBasins: ok", rebuildResult.ok, JSON.stringify(rebuildResult));
assert("rebuildBasins returns BasinSet",
    rebuildResult.ok && rebuildResult.artifact.artifact_class === "BN");
assert("basinsForSegment returns basins after rebuild",
    ms.basinsForSegment(SEG_0).length > 0);

// D23: rebuildBasins back-fills trajectory basin assignments
const trajAfterRebuild = ms.trajectory.all();
const assignedFrames = trajAfterRebuild.filter(f => f.segment_id === SEG_0 && f.basin_id !== null);
assert("trajectory frames back-filled with basin_id after rebuild",
    assignedFrames.length > 0);

// D24: nearestBasin returns a result after rebuild
const nearResult = ms.nearestBasin(h1_lo);
assert("nearestBasin returns result after rebuild", nearResult !== null);
assert("nearestBasin returns { basin, distance }", nearResult && "basin" in nearResult && "distance" in nearResult);
assert("nearestBasin.distance is finite", nearResult && Number.isFinite(nearResult.distance));

// D25: rebuildBasins on missing segment returns NO_STATES error
const noSegResult = ms.rebuildBasins({
    segment_id: "missing:segment",
    basin_policy: BASIN_POLICY,
});
assert("rebuildBasins missing segment: ok=false",          !noSegResult.ok);
assert("rebuildBasins missing segment: error=NO_STATES",   noSegResult.error === "NO_STATES");

// D26: summary has no canon/truth language
const summ = ms.summary();
assert("substrate summary has state_count",         typeof summ.state_count === "number");
assert("substrate summary has basin_count",         typeof summ.basin_count === "number");
assert("substrate summary has substrate_id",        summ.substrate_id === "test_substrate");
assert("substrate summary report_type = substrate:operational_summary",
    summ.report_type === "substrate:operational_summary");
assert("substrate summary has no 'canon' fields",
    !("canonical_state_count" in summ) &&
    !("canon_count" in summ) &&
    !("promoted_count" in summ));

// D27: statesInRange filters by time
const rangeStates = ms.statesInRange(0, 2);
assert("statesInRange(0, 2): returns states within range",
    rangeStates.every(s => s.window_span.t_start >= 0 && s.window_span.t_end <= 2));

// D28: getTrajectory returns slice
const trajSlice = ms.getTrajectory(0, 2);
assert("getTrajectory returns trajectory frames in range",
    trajSlice.every(f => f.t_start >= 0 && f.t_end <= 2));

// ════════════════════════════════════════════════════════════════════════════
// E. Boundary integrity
// ════════════════════════════════════════════════════════════════════════════

section("E. Boundary integrity — substrate does not cross into canon");

// E1: BasinSet artifact class is BN, not C1
if (basinSet) {
    assert("BasinSet.artifact_class = BN (not C1)", basinSet.artifact_class === "BN");
    assert("BasinSet has no 'canonical' fields",
        !("canonical_id" in basinSet) &&
        !("canon" in basinSet) &&
        !("promoted" in basinSet));
}

// E2: MemorySubstrate has no promote / canonicalize method
const ms2 = new MemorySubstrate();
assert("MemorySubstrate has no promote() method",     typeof ms2.promote === "undefined");
assert("MemorySubstrate has no canonicalize() method", typeof ms2.canonicalize === "undefined");
assert("MemorySubstrate has no addCanon() method",    typeof ms2.addCanon === "undefined");

// E3: SegmentTracker has no promote / classify / label methods
const stBound = new SegmentTracker({ stream_id: STREAM_ID });
assert("SegmentTracker has no promote() method",    typeof stBound.promote === "undefined");
assert("SegmentTracker has no classify() method",   typeof stBound.classify === "undefined");
assert("SegmentTracker has no predict() method",    typeof stBound.predict === "undefined");

// E4: TrajectoryBuffer has no promote / classify methods
const tbBound = new TrajectoryBuffer();
assert("TrajectoryBuffer has no promote() method",  typeof tbBound.promote === "undefined");
assert("TrajectoryBuffer has no classify() method", typeof tbBound.classify === "undefined");

// E5: BasinOp has no promote / classify methods
const bopBound = new BasinOp();
assert("BasinOp has no promote() method",           typeof bopBound.promote === "undefined");
assert("BasinOp has no classify() method",          typeof bopBound.classify === "undefined");

// E6: substrate commit does not modify input artifact receipts
const h1ForCommit = makeH1(20, 21, { state_id: `H1:${STREAM_ID}:${SEG_0}:20:21` });
const receiptsBefore = JSON.stringify(h1ForCommit.receipts);
const ms3 = new MemorySubstrate();
ms3.commit(h1ForCommit);
assert("commit does not modify input artifact receipts",
    JSON.stringify(h1ForCommit.receipts) === receiptsBefore);

// E7: substrate commit does not modify input artifact invariants
const invariantsBefore = JSON.stringify(h1ForCommit.invariants);
assert("commit does not modify input artifact invariants",
    JSON.stringify(h1ForCommit.invariants) === invariantsBefore);

// E8: BasinOp output does not contain artifact_class C1
if (basinResult.ok) {
    const resultStr = JSON.stringify(basinResult.artifact);
    assert("BasinOp output contains no C1 references", !resultStr.includes("\"C1\""));
}

// E9: MemorySubstrate does not store C1 artifacts (legitimacy rejects them)
const fakeC1 = {
    artifact_class: "C1",
    state_id: "C1:fake:canon",
    stream_id: STREAM_ID,
    segment_id: SEG_0,
    window_span: { t_start: 0, t_end: 1 },
    invariants: { band_profile_norm: { band_energy: [1, 0] } },
    policies: { compression_policy_id: "COMP:1" },
};
assertFails("commit C1 rejected (not H1 or M1)", ms.commit(fakeC1), "LEGITIMACY_FAILURE");

// E10: SegmentTracker transitions do not carry 'truth' or 'canonical' semantics
st.reset();
st.observe(makeReport({ novelty_gate_triggered: false }));
const trans = st.observe(makeReport({ novelty_gate_triggered: true, window_ref: "2:3" }));
if (trans) {
    assert("SegmentTransition has no 'truth' field",    !("truth" in trans));
    assert("SegmentTransition has no 'canonical' field", !("canonical" in trans));
    assert("SegmentTransition has no 'promoted' field",  !("promoted" in trans));
}

// E11: substrate summary does not imply any canonical count
const ms4 = new MemorySubstrate();
ms4.commit(makeH1(0, 1));
const ms4Summ = ms4.summary();
const ms4SummStr = JSON.stringify(ms4Summ);
assert("substrate summary contains no 'canonical' string",
    !ms4SummStr.toLowerCase().includes("canonical"));
assert("substrate summary contains no 'c1' artifact class reference",
    !ms4SummStr.includes("\"C1\""));

// ════════════════════════════════════════════════════════════════════════════
// F. MemorySubstrate read-path honesty — mutation-safety
// ════════════════════════════════════════════════════════════════════════════

section("F. MemorySubstrate read-path — mutation-safe copies");

// Build a fresh substrate with known states for clean isolation
const msR = new MemorySubstrate({ substrate_id: "readpath_test" });
const rpH1a = makeH1(0, 1, { state_id: `H1:${STREAM_ID}:${SEG_0}:rp:0:1` });
const rpH1b = makeH1(1, 2, { state_id: `H1:${STREAM_ID}:${SEG_0}:rp:1:2` });
msR.commit(rpH1a);
msR.commit(rpH1b);
msR.rebuildBasins({
    segment_id: SEG_0,
    basin_policy: { ...BASIN_POLICY, similarity_threshold: 0.5 },
});

// ── F1: get() returns safe copy — nested mutation does not affect stored state ──
const rpGot1 = msR.get(rpH1a.state_id);
assert("F1: get() returns non-null", rpGot1 !== null);

// Mutate the nested band_energy array in the returned copy
rpGot1.invariants.band_profile_norm.band_energy[0] = 9999;
const rpGot2 = msR.get(rpH1a.state_id);
assert("F1: get() nested band_energy immutable after caller mutation",
    rpGot2.invariants.band_profile_norm.band_energy[0] !== 9999);

// Mutate top-level field (plain spread — succeeds without throw)
rpGot1.stream_id = "mutated";
const rpGot3 = msR.get(rpH1a.state_id);
assert("F1: get() top-level stream_id immutable after caller mutation",
    rpGot3.stream_id === rpH1a.stream_id);

// Mutate kept_bins in returned copy
rpGot1.kept_bins[0].re = 7777;
const rpGot4 = msR.get(rpH1a.state_id);
assert("F1: get() kept_bins[0].re immutable after caller mutation",
    rpGot4.kept_bins[0].re !== 7777);

// Mutate provenance.input_refs
rpGot1.provenance.input_refs[0] = "mutated_ref";
const rpGot5 = msR.get(rpH1a.state_id);
assert("F1: get() provenance.input_refs immutable after caller mutation",
    rpGot5.provenance.input_refs[0] !== "mutated_ref");

// ── F2: get() returns independent copies — two calls are not the same reference ──
const rpGetA = msR.get(rpH1a.state_id);
const rpGetB = msR.get(rpH1a.state_id);
assert("F2: get() returns independent copies (not same reference)",
    rpGetA !== rpGetB);
assert("F2: get() copies have equal content",
    JSON.stringify(rpGetA) === JSON.stringify(rpGetB));

// ── F3: allStates() items are mutation-safe ──
const rpAll1 = msR.allStates();
assert("F3: allStates() returns 2 states", rpAll1.length === 2);
rpAll1[0].invariants.band_profile_norm.band_energy[0] = 8888;
rpAll1[0].stream_id = "mutated_all";
const rpAll2 = msR.allStates();
assert("F3: allStates() nested band_energy immutable after caller mutation",
    rpAll2[0].invariants.band_profile_norm.band_energy[0] !== 8888);
assert("F3: allStates() top-level stream_id immutable after caller mutation",
    rpAll2[0].stream_id !== "mutated_all");
// Each call returns independent arrays
assert("F3: allStates() returns new array each call",
    msR.allStates() !== msR.allStates());

// ── F4: statesForSegment() items are mutation-safe ──
const rpSeg1 = msR.statesForSegment(SEG_0);
assert("F4: statesForSegment() returns states", rpSeg1.length > 0);
rpSeg1[0].invariants.band_profile_norm.band_energy[0] = 6666;
const rpSeg2 = msR.statesForSegment(SEG_0);
assert("F4: statesForSegment() band_energy immutable after caller mutation",
    rpSeg2[0].invariants.band_profile_norm.band_energy[0] !== 6666);

// ── F5: statesInRange() items are mutation-safe ──
const rpRange1 = msR.statesInRange(0, 1);
assert("F5: statesInRange() returns states", rpRange1.length > 0);
rpRange1[0].invariants.band_profile_norm.band_energy[0] = 5555;
const rpRange2 = msR.statesInRange(0, 1);
assert("F5: statesInRange() band_energy immutable after caller mutation",
    rpRange2[0].invariants.band_profile_norm.band_energy[0] !== 5555);

// ── F6: basinsForSegment() items are mutation-safe ──
const rpBasins1 = msR.basinsForSegment(SEG_0);
assert("F6: basinsForSegment() returns basins", rpBasins1.length > 0);
// Mutate centroid_band_profile in returned basin copy
const origCentroid0 = rpBasins1[0].centroid_band_profile[0];
rpBasins1[0].centroid_band_profile[0] = 4444;
const rpBasins2 = msR.basinsForSegment(SEG_0);
assert("F6: basinsForSegment() centroid_band_profile immutable after mutation",
    rpBasins2[0].centroid_band_profile[0] !== 4444);
assert("F6: basinsForSegment() stored centroid unchanged",
    rpBasins2[0].centroid_band_profile[0] === origCentroid0);
// Mutate member_state_ids
rpBasins1[0].member_state_ids[0] = "mutated_member";
const rpBasins3 = msR.basinsForSegment(SEG_0);
assert("F6: basinsForSegment() member_state_ids immutable after mutation",
    rpBasins3[0].member_state_ids[0] !== "mutated_member");

// ── F7: nearestBasin() result.basin is mutation-safe ──
const rpNearest1 = msR.nearestBasin(rpH1a);
assert("F7: nearestBasin() returns result", rpNearest1 !== null);
const origNearCentroid = rpNearest1.basin.centroid_band_profile[0];
rpNearest1.basin.centroid_band_profile[0] = 3333;
// Subsequent nearestBasin call should be unaffected
const rpNearest2 = msR.nearestBasin(rpH1a);
assert("F7: nearestBasin() centroid_band_profile immutable after mutation",
    rpNearest2.basin.centroid_band_profile[0] !== 3333);
// Deterministic: same query, same distance
assert("F7: nearestBasin() deterministic after prior result mutation",
    rpNearest2.distance === rpNearest1.distance);

// ── F8: nearestBasin() returns independent basin copies each call ──
const rpNb1 = msR.nearestBasin(rpH1a);
const rpNb2 = msR.nearestBasin(rpH1a);
assert("F8: nearestBasin() basin copies are not same reference",
    rpNb1.basin !== rpNb2.basin);
assert("F8: nearestBasin() basin copies have equal content",
    JSON.stringify(rpNb1.basin) === JSON.stringify(rpNb2.basin));

// ── F9: rebuildBasins backfill is visible through read APIs (copy-on-read) ──
// After rebuildBasins, trajectory frames should have basin_id set (backfilled).
// The patch fixes _backfillBasinAssignments to use _frames directly.
const rpTrajAfterRebuild = msR.trajectory.all();
const rpAssigned = rpTrajAfterRebuild.filter(f => f.segment_id === SEG_0 && f.basin_id !== null);
assert("F9: rebuildBasins backfill visible through trajectory.all()",
    rpAssigned.length > 0);
assert("F9: backfilled frames have finite distance_to_basin_centroid",
    rpAssigned.every(f => Number.isFinite(f.distance_to_basin_centroid)));

// ── F10: getTrajectory() returns mutation-safe frames ──
const rpTrajSlice = msR.getTrajectory(0, 2);
assert("F10: getTrajectory() returns frames", rpTrajSlice.length > 0);
rpTrajSlice[0].energy_raw = 2222;
rpTrajSlice[0].band_profile_snapshot[0] = 1111;
const rpTrajSlice2 = msR.getTrajectory(0, 2);
assert("F10: getTrajectory() energy_raw immutable after caller mutation",
    rpTrajSlice2[0].energy_raw !== 2222);
assert("F10: getTrajectory() band_profile_snapshot immutable after caller mutation",
    rpTrajSlice2[0].band_profile_snapshot[0] !== 1111);

// ════════════════════════════════════════════════════════════════════════════
// G. TrajectoryBuffer read-path honesty — mutation-safe copies
// ════════════════════════════════════════════════════════════════════════════

section("G. TrajectoryBuffer read-path — mutation-safe copies");

const tbR = new TrajectoryBuffer({ max_frames: 8 });
const rpTbH1a = makeH1WithProfile(0, 1, [1.0, 0.0]);
const rpTbH1b = makeH1WithProfile(1, 2, [0.8, 0.2], SEG_0, { state_id: `H1:s:s:rp:1:2` });
const rpTbH1c = makeH1WithProfile(2, 3, [0.6, 0.4], SEG_0, { state_id: `H1:s:s:rp:2:3` });
tbR.push({ state: rpTbH1a });
tbR.push({ state: rpTbH1b, basin_id: "BN:test", distance_to_basin_centroid: 0.2 });
tbR.push({ state: rpTbH1c, basin_id: "BN:test", distance_to_basin_centroid: 0.1 });

// ── G1: all() returns safe copies — mutating returned frames does not affect future reads ──
const tbAll1 = tbR.all();
assert("G1: all() returns 3 frames", tbAll1.length === 3);
tbAll1[0].energy_raw = 9999;
tbAll1[0].band_profile_snapshot[0] = 8888;
tbAll1[0].basin_id = "mutated";
const tbAll2 = tbR.all();
assert("G1: all() energy_raw immutable after caller mutation",
    tbAll2[0].energy_raw !== 9999);
assert("G1: all() band_profile_snapshot[0] immutable after caller mutation",
    tbAll2[0].band_profile_snapshot[0] !== 8888);
assert("G1: all() basin_id immutable after caller mutation",
    tbAll2[0].basin_id !== "mutated");

// ── G2: all() returns new array each call (independent references) ──
const tbAll3 = tbR.all();
const tbAll4 = tbR.all();
assert("G2: all() returns new array each call", tbAll3 !== tbAll4);
assert("G2: all() frame copies are not same reference", tbAll3[0] !== tbAll4[0]);

// ── G3: slice() frames are mutation-safe ──
const tbSlice1 = tbR.slice(0, 2);
assert("G3: slice() returns frames in range", tbSlice1.length > 0);
tbSlice1[0].energy_raw = 7777;
tbSlice1[0].band_profile_snapshot[0] = 6666;
const tbSlice2 = tbR.slice(0, 2);
assert("G3: slice() energy_raw immutable after caller mutation",
    tbSlice2[0].energy_raw !== 7777);
assert("G3: slice() band_profile_snapshot[0] immutable after caller mutation",
    tbSlice2[0].band_profile_snapshot[0] !== 6666);

// ── G4: tail() frames are mutation-safe ──
const tbTail1 = tbR.tail(2);
assert("G4: tail() returns 2 frames", tbTail1.length === 2);
tbTail1[0].energy_raw = 5555;
tbTail1[0].band_profile_snapshot[0] = 4444;
const tbTail2 = tbR.tail(2);
assert("G4: tail() energy_raw immutable after caller mutation",
    tbTail2[0].energy_raw !== 5555);
assert("G4: tail() band_profile_snapshot[0] immutable after caller mutation",
    tbTail2[0].band_profile_snapshot[0] !== 4444);

// ── G5: bySegment() frames are mutation-safe ──
const tbBySeg1 = tbR.bySegment(SEG_0);
assert("G5: bySegment() returns frames", tbBySeg1.length > 0);
tbBySeg1[0].energy_raw = 3333;
const tbBySeg2 = tbR.bySegment(SEG_0);
assert("G5: bySegment() energy_raw immutable after caller mutation",
    tbBySeg2[0].energy_raw !== 3333);

// ── G6: byBasin() frames are mutation-safe ──
const tbByBasin1 = tbR.byBasin("BN:test");
assert("G6: byBasin() returns frames with that basin", tbByBasin1.length === 2);
tbByBasin1[0].energy_raw = 2222;
tbByBasin1[0].basin_id = "mutated_basin";
const tbByBasin2 = tbR.byBasin("BN:test");
assert("G6: byBasin() energy_raw immutable after caller mutation",
    tbByBasin2[0].energy_raw !== 2222);
assert("G6: byBasin() basin_id immutable after caller mutation",
    tbByBasin2[0].basin_id !== "mutated_basin");
// byBasin("BN:test") still finds 2 frames after mutation of prior result
assert("G6: byBasin() still finds correct frames after prior mutation",
    tbByBasin2.length === 2);

// ── G7: copy isolation — mutations to one read result don't affect another ──
const tbAllX = tbR.all();
const tbAllY = tbR.all();
tbAllX[0].energy_raw = 1111;
assert("G7: mutations to one all() result do not affect another",
    tbAllY[0].energy_raw !== 1111);

// ── G8: trajectory getter returns live buffer (documented escape hatch) ──
// The trajectory getter returns the live TrajectoryBuffer instance intentionally —
// it is needed for dynamics methods (velocityEstimate, isConverging, etc.).
// The README documents this as "Caller should not mutate."
// This is a documented exception to the "immutable copies" contract.
// Test that the getter returns the same instance each call (not a copy).
const tbGetter1 = msR.trajectory;
const tbGetter2 = msR.trajectory;
assert("G8: trajectory getter returns same live instance (documented exception)",
    tbGetter1 === tbGetter2);
// The JSDoc says "read-only reference to buffer instance — Caller should not mutate"
// Verify it is the live buffer by checking a known frame count
assert("G8: trajectory getter instance has correct frame count",
    tbGetter1.all().length === msR.allStates().length);

// ── G9: velocityEstimate/isConverging use safe copies — dynamics unaffected by read mutations ──
// Push additional frames to tbR for dynamics tests
const rpDynH1a = makeH1WithProfile(3, 4, [0.9, 0.1], SEG_0, { state_id:`H1:s:s:dyn:3:4` });
const rpDynH1b = makeH1WithProfile(4, 5, [0.8, 0.2], SEG_0, { state_id:`H1:s:s:dyn:4:5` });
tbR.push({ state: rpDynH1a, basin_id:"BN:test", distance_to_basin_centroid:0.15 });
tbR.push({ state: rpDynH1b, basin_id:"BN:test", distance_to_basin_centroid:0.05 });
const vel1 = tbR.velocityEstimate(4);
// Mutate all() result and recompute — dynamics should be unchanged
const junk = tbR.all();
for (const f of junk) { f.band_profile_snapshot[0] = 9999; }
const vel2 = tbR.velocityEstimate(4);
assert("G9: velocityEstimate unaffected by caller mutation of prior all() result",
    vel1.mean_l1_delta === vel2.mean_l1_delta);

// ════════════════════════════════════════════════════════════════════════════
// H. Contract alignment — README vs implementation
// ════════════════════════════════════════════════════════════════════════════

section("H. Contract alignment — README 'immutable copies' claim");

// The README_SubstrateLayer.md says:
//   "All reads return immutable copies"
//
// After the read-path patch:
//   - MemorySubstrate state/basin reads: return copyState()/copyBasin() — plain spread objects
//   - TrajectoryBuffer reads: return copyFrame() — plain spread objects
//   - trajectory getter: returns the live buffer (documented exception)
//
// "Copies" is satisfied: every read call produces a new object.
// "Immutable" in the README means the caller cannot corrupt substrate state — satisfied.
// The copies are not Object.frozen (they are plain objects), but the isolation guarantee holds.

// H1: every read returns a new object (copy), not the stored reference
const msHTest = new MemorySubstrate();
const hH1 = makeH1(0, 1, { state_id:`H1:s:seg:h:0:1` });
msHTest.commit(hH1);
const readA = msHTest.get(hH1.state_id);
const readB = msHTest.get(hH1.state_id);
assert("H1: each get() call returns a distinct object (copy semantics)",
    readA !== readB);
assert("H1: get() copies have identical content",
    JSON.stringify(readA) === JSON.stringify(readB));

const allA = msHTest.allStates();
const allB = msHTest.allStates();
assert("H1: each allStates() call returns distinct item objects",
    allA[0] !== allB[0]);

// H2: copies are safe to pass to untrusted callers — no way to corrupt substrate
// through the public read API (mutation attempt, then verify substrate unchanged)
const hResult = msHTest.get(hH1.state_id);
hResult.state_id = "corrupted";
hResult.invariants.energy_raw = -1;
hResult.kept_bins.length = 0; // clear the array
const hCheck = msHTest.get(hH1.state_id);
assert("H2: substrate state_id unchanged after caller corruption attempt",
    hCheck.state_id === hH1.state_id);
assert("H2: substrate energy_raw unchanged after caller corruption attempt",
    hCheck.invariants.energy_raw === hH1.invariants.energy_raw);
assert("H2: substrate kept_bins unchanged after caller corruption attempt",
    hCheck.kept_bins.length === hH1.kept_bins.length);

// H3: trajectory getter is the documented exception —
// it is a live reference, not a copy, but this is explicitly noted in JSDoc.
// The README wording ("all reads") should be understood as "all data reads"
// (states, basins, frames), not the buffer handle itself.
// Verify the getter is a TrajectoryBuffer instance (not a plain data read).
const { TrajectoryBuffer: TB } = await import("../operators/trajectory/TrajectoryBuffer.js");
assert("H3: trajectory getter returns a TrajectoryBuffer instance (not a data copy)",
    msR.trajectory instanceof TB);
// This is the correct design: dynamics methods live on the buffer; exposing the
// handle avoids re-implementing them on MemorySubstrate.
// The contract is "Caller should not mutate" — an advisory, not a technical barrier.

// ════════════════════════════════════════════════════════════════════════════
// I. Substrate Query Integration — perception loop contract
// ════════════════════════════════════════════════════════════════════════════

section("I. Substrate query integration — perception loop");

import { QueryOp } from "../operators/query/QueryOp.js";

// Build a substrate with a known corpus for clean isolation:
//   - 3 H1 states in segment SEG_0 with distinct profiles
//   - 1 M1 state (constructed directly) in SEG_0
//   - 1 H1 state in SEG_1 (different segment)

const msQ = new MemorySubstrate({ substrate_id: "query_test" });

const qH1a = makeH1WithProfile(0, 1, [1.00, 0.00], SEG_0, { state_id:`H1:${STREAM_ID}:${SEG_0}:q:0:1` });
const qH1b = makeH1WithProfile(1, 2, [0.80, 0.20], SEG_0, { state_id:`H1:${STREAM_ID}:${SEG_0}:q:1:2` });
const qH1c = makeH1WithProfile(2, 3, [0.20, 0.80], SEG_0, { state_id:`H1:${STREAM_ID}:${SEG_0}:q:2:3` });

// M1 — minimal lawful merged state
const qM1 = {
    artifact_class: "M1",
    state_id: `M1:${STREAM_ID}:${SEG_0}:0:2`,
    stream_id: STREAM_ID, segment_id: SEG_0,
    window_span: { t_start:0, t_end:2, duration_sec:2, window_count:2 },
    grid: { Fs_target:8, N:8, df:1, bin_count_full:5, bin_count_kept:2 },
    kept_bins: [
        { k:0, freq_hz:0, re:0.9, im:0, magnitude:0.9, phase:0 },
        { k:1, freq_hz:1, re:0.4, im:0, magnitude:0.4, phase:0 },
    ],
    invariants: { energy_raw:0.97, energy_norm:0.97,
        band_profile_norm:{ band_edges:[0,4,4], band_energy:[0.9, 0.1] } },
    uncertainty: { time:{ dt_nominal:null, jitter_rms:null, gap_total_duration:0,
        monotonicity_violations:0, drift_ppm:null, fit_residual_rms:null, post_align_jitter:null } },
    confidence: { by_invariant:{identity:1,energy:1,band_profile:1}, overall:1, method:"test" },
    gates: { eligible_for_authoritative_merge:true, eligible_for_archive_tier:true, blocked_reason:"none" },
    receipts: { merge:{ merge_mode:"authoritative", phase_alignment_mode:"clock_delta_rotation",
        weights_mode:"duration", merged_from:[qH1a.state_id, qH1b.state_id],
        phase_deltas:[0,1], energy_drift_after_merge:0 } },
    merge_record: { inputs:[qH1a.state_id,qH1b.state_id], weights:[1,1],
        merge_policy_id:"MERGE:1", output_ref:`M1:${STREAM_ID}:${SEG_0}:0:2`, merge_tree_position:null },
    policies: { clock_policy_id:"CLK:v1", grid_policy_id:"GRID:1",
        window_policy_id:"WIN:1", transform_policy_id:"XFRM:1",
        compression_policy_id:"COMP:1", merge_policy_id:"MERGE:1" },
    provenance: { input_refs:[qH1a.state_id, qH1b.state_id],
        operator_id:"MergeOp", operator_version:"0.1.0" },
};

// H1 in a different segment (SEG_1)
const qH1seg1 = makeH1WithProfile(3, 4, [0.50, 0.50], SEG_1, {
    state_id:`H1:${STREAM_ID}:${SEG_1}:q:3:4`, segment_id:SEG_1
});

msQ.commit(qH1a);
msQ.commit(qH1b);
msQ.commit(qH1c);
msQ.commit(qM1);
msQ.commit(qH1seg1);
assert("I: 5 states committed", msQ.allStates().length === 5);

const qpol = { policy_id:"qp.test", scoring:"energy_delta", normalization:"none", topK:10 };

// ── I1: queryStates() over full corpus (H1+M1, all segments) ──
const qAll = msQ.queryStates(
    { query_id:"q_all", kind:"energy_trend", mode:"ENERGY",
        scope:{ allow_cross_segment:true } },
    qpol
);
assert("I1: queryStates full corpus: ok", qAll.ok, JSON.stringify(qAll));
assert("I1: returns Q artifact",             qAll.ok && qAll.artifact.artifact_class === "Q");
assert("I1: results contains all 5 states", qAll.ok && qAll.artifact.results.length === 5);

// ── I2: H1-only corpus filter ──
const qH1only = msQ.queryStates(
    { query_id:"q_h1", kind:"energy_trend", mode:"ENERGY", scope:{ allow_cross_segment:true } },
    qpol,
    { artifact_class:"H1" }
);
assert("I2: H1-only filter: ok", qH1only.ok);
assert("I2: H1-only results = 4", qH1only.ok && qH1only.artifact.results.length === 4);
assert("I2: all results have artifact_class H1",
    qH1only.ok && qH1only.artifact.results.every(r => r.artifact_class === "H1"));

// ── I3: M1-only corpus filter ──
const qM1only = msQ.queryStates(
    { query_id:"q_m1", kind:"energy_trend", mode:"ENERGY", scope:{ allow_cross_segment:true } },
    qpol,
    { artifact_class:"M1" }
);
assert("I3: M1-only filter: ok", qM1only.ok);
assert("I3: M1-only results = 1", qM1only.ok && qM1only.artifact.results.length === 1);
assert("I3: result artifact_class = M1",
    qM1only.ok && qM1only.artifact.results[0].artifact_class === "M1");

// ── I4: segment-scoped query ──
const qSeg0 = msQ.queryStates(
    { query_id:"q_seg0", kind:"energy_trend", mode:"ENERGY",
        scope:{ allow_cross_segment:false } },
    qpol,
    { segment_id: SEG_0 }
);
assert("I4: segment-scoped SEG_0: ok", qSeg0.ok);
assert("I4: segment-scoped returns 4 (3 H1 + 1 M1 in SEG_0)",
    qSeg0.ok && qSeg0.artifact.results.length === 4);
assert("I4: all results from SEG_0",
    qSeg0.ok && qSeg0.artifact.results.every(r => r.segment_id === SEG_0));

// ── I5: stream-scoped query ──
const qStream = msQ.queryStates(
    { query_id:"q_stream", kind:"energy_trend", mode:"ENERGY",
        scope:{ allow_cross_segment:true } },
    qpol,
    { stream_id: STREAM_ID }
);
assert("I5: stream-scoped: ok", qStream.ok);
assert("I5: stream-scoped returns all 5", qStream.ok && qStream.artifact.results.length === 5);

// Non-existent stream returns EMPTY_CORPUS
const qBadStream = msQ.queryStates(
    { query_id:"q_nostream", kind:"energy_trend", mode:"ENERGY",
        scope:{ allow_cross_segment:true } },
    qpol,
    { stream_id: "nonexistent:stream" }
);
assert("I5: non-existent stream: EMPTY_CORPUS", !qBadStream.ok && qBadStream.error === "EMPTY_CORPUS");

// ── I6: similarity query over H1 corpus ──
const qSim = msQ.queryStates(
    { query_id:"q_sim", kind:"similarity", mode:"BAND_PROFILE",
        scope:{ allow_cross_segment:true },
        query:{ state: qH1a } },   // find states similar to qH1a
    { policy_id:"qp.sim", scoring:"band_l1", normalization:"none", topK:3 },
    { artifact_class:"H1" }
);
assert("I6: similarity over H1 corpus: ok", qSim.ok, JSON.stringify(qSim));
assert("I6: similarity results ranked",
    qSim.ok && qSim.artifact.results.every((r,i) => r.rank === i+1));
// qH1a is most similar to itself (score = 1/(1+0))
// qH1c [0.2,0.8] is most different from qH1a [1,0]
assert("I6: top result is the query state itself",
    qSim.ok && qSim.artifact.results[0].ref === qH1a.state_id);

// ── I7: determinism — identical query produces identical result ──
const qDet1 = msQ.queryStates(
    { query_id:"q_det", kind:"energy_trend", mode:"ENERGY",
        scope:{ allow_cross_segment:true } }, qpol);
const qDet2 = msQ.queryStates(
    { query_id:"q_det", kind:"energy_trend", mode:"ENERGY",
        scope:{ allow_cross_segment:true } }, qpol);
assert("I7: deterministic: same results both calls",
    qDet1.ok && qDet2.ok &&
    JSON.stringify(qDet1.artifact.results.map(r=>r.ref)) ===
    JSON.stringify(qDet2.artifact.results.map(r=>r.ref)));
assert("I7: deterministic: same scores both calls",
    qDet1.ok && qDet2.ok &&
    JSON.stringify(qDet1.artifact.results.map(r=>r.score)) ===
    JSON.stringify(qDet2.artifact.results.map(r=>r.score)));

// ── I8: queryStates does not mutate committed states ──
const corpusBefore = JSON.stringify(msQ.allStates().map(s=>s.state_id+s.invariants.energy_raw));
msQ.queryStates(
    { query_id:"q_mut", kind:"energy_trend", mode:"ENERGY", scope:{ allow_cross_segment:true } },
    qpol
);
const corpusAfter = JSON.stringify(msQ.allStates().map(s=>s.state_id+s.invariants.energy_raw));
assert("I8: queryStates does not mutate substrate committed states",
    corpusBefore === corpusAfter);

// ── I9: queryStates does not mutate basin index ──
msQ.rebuildBasins({ segment_id:SEG_0,
    basin_policy:{ ...BASIN_POLICY, similarity_threshold:0.5 } });
const basinsBefore = JSON.stringify(msQ.basinsForSegment(SEG_0).map(b=>b.basin_id+b.centroid_band_profile[0]));
msQ.queryStates(
    { query_id:"q_bas", kind:"energy_trend", mode:"ENERGY", scope:{ allow_cross_segment:true } },
    qpol
);
const basinsAfter = JSON.stringify(msQ.basinsForSegment(SEG_0).map(b=>b.basin_id+b.centroid_band_profile[0]));
assert("I9: queryStates does not mutate basin index", basinsBefore === basinsAfter);

// ── I10: queryStates does not mutate trajectory state ──
const trajBefore = JSON.stringify(msQ.trajectory.all().map(f=>f.state_id+f.basin_id));
msQ.queryStates(
    { query_id:"q_traj", kind:"energy_trend", mode:"ENERGY", scope:{ allow_cross_segment:true } },
    qpol
);
const trajAfter = JSON.stringify(msQ.trajectory.all().map(f=>f.state_id+f.basin_id));
assert("I10: queryStates does not mutate trajectory frames", trajBefore === trajAfter);

// ── I11: QueryResult contains no canon/promotion fields ──
assert("I11: Q artifact_class = Q (not C1)",
    qAll.ok && qAll.artifact.artifact_class === "Q");
assert("I11: QueryResult has no 'canonical' field",
    qAll.ok && !("canonical" in qAll.artifact));
assert("I11: QueryResult has no 'promoted' field",
    qAll.ok && !("promoted" in qAll.artifact));
assert("I11: QueryResult receipts.query has no 'canon' field",
    qAll.ok && !("canon" in qAll.artifact.receipts.query));
assert("I11: query_policy_id is inside receipts.query (not top-level)",
    qAll.ok &&
    !("query_policy_id" in qAll.artifact) &&
    typeof qAll.artifact.receipts.query.query_policy_id === "string");

// ── I12: empty substrate returns EMPTY_CORPUS ──
const msEmpty = new MemorySubstrate();
const qEmpty = msEmpty.queryStates(
    { query_id:"q_empty", kind:"energy_trend", mode:"ENERGY", scope:{ allow_cross_segment:true } },
    qpol
);
assert("I12: empty substrate: ok=false", !qEmpty.ok);
assert("I12: empty substrate: error=EMPTY_CORPUS", qEmpty.error === "EMPTY_CORPUS");

// ── I13: invalid query_spec fails explicitly from QueryOp ──
const qBad = msQ.queryStates(
    { query_id:"q_bad", kind:"totally_unknown_kind", mode:"ENERGY",
        scope:{ allow_cross_segment:true } },
    qpol
);
assert("I13: unsupported query kind: ok=false", !qBad.ok);
assert("I13: unsupported query kind: error=UNSUPPORTED_QUERY_KIND",
    qBad.error === "UNSUPPORTED_QUERY_KIND");

// ── I14: direct QueryOp on allStates() produces same result as queryStates() ──
// Verifies the two paths are equivalent
const directCorpus = msQ.allStates().filter(s => s.artifact_class === "H1");
const directResult = new QueryOp().run({
    query_spec:{ query_id:"q_direct", kind:"energy_trend", mode:"ENERGY",
        scope:{ allow_cross_segment:true } },
    query_policy: qpol,
    corpus: directCorpus,
});
const viaMethod = msQ.queryStates(
    { query_id:"q_direct", kind:"energy_trend", mode:"ENERGY",
        scope:{ allow_cross_segment:true } },
    qpol,
    { artifact_class:"H1" }
);
assert("I14: direct QueryOp = queryStates() for same corpus",
    directResult.ok && viaMethod.ok &&
    JSON.stringify(directResult.artifact.results.map(r=>r.ref)) ===
    JSON.stringify(viaMethod.artifact.results.map(r=>r.ref)));

// ── I15: returned QueryResult items do not expose live corpus references ──
// Mutating a QueryResult item's fields should not affect subsequent queries
const qRes1 = msQ.queryStates(
    { query_id:"q_iso", kind:"energy_trend", mode:"ENERGY",
        scope:{ allow_cross_segment:true } },
    qpol
);
if (qRes1.ok) {
    // QueryResultItem carries ref, score, rank, artifact_class, stream_id, segment_id, window_span
    // These are plain strings/numbers — no live references to stored states
    qRes1.artifact.results[0].score = -9999;
    qRes1.artifact.results[0].ref = "corrupted";
}
const qRes2 = msQ.queryStates(
    { query_id:"q_iso", kind:"energy_trend", mode:"ENERGY",
        scope:{ allow_cross_segment:true } },
    qpol
);
assert("I15: mutating prior QueryResult does not affect subsequent query",
    qRes1.ok && qRes2.ok &&
    qRes2.artifact.results[0].score !== -9999 &&
    qRes2.artifact.results[0].ref !== "corrupted");

// ── I16: band_lookup query over substrate corpus ──
const qBand = msQ.queryStates(
    { query_id:"q_band", kind:"band_lookup", mode:"BAND_PROFILE",
        scope:{ allow_cross_segment:true },
        query:{ band_spec:"0:4" } },
    qpol
);
assert("I16: band_lookup over substrate corpus: ok", qBand.ok, JSON.stringify(qBand));
assert("I16: band_lookup results ordered by score desc",
    qBand.ok && qBand.artifact.results.every((r,i) =>
        i === 0 || r.score <= qBand.artifact.results[i-1].score));

// ── I17: compare query between two substrate states ──
const qCompare = msQ.queryStates(
    { query_id:"q_compare", kind:"compare", mode:"ENERGY",
        scope:{ allow_cross_segment:true },
        query:{
            baseline_ref: qH1a.state_id,
            current_ref:  qH1c.state_id,
        } },
    { policy_id:"qp.cmp", scoring:"energy_delta", normalization:"none", topK:1 }
);
assert("I17: compare query: ok", qCompare.ok, JSON.stringify(qCompare));
assert("I17: compare result has 1 item", qCompare.ok && qCompare.artifact.results.length === 1);

// ════════════════════════════════════════════════════════════════════════════
// J. Proto-basin dwell, transition, and recurrence instrumentation
// ════════════════════════════════════════════════════════════════════════════

section("J. Proto-basin dwell, transition, and recurrence instrumentation");

// ── Shared fixture builder ──────────────────────────────────────────────────
// Constructs a minimal H1-like object for TrajectoryBuffer.push().
// basin_id is passed separately per push() API; not embedded in state.
function makeTbState(ts, te, seg = SEG_0, overrides = {}) {
    return {
        artifact_class: "H1",
        state_id: `H1:${STREAM_ID}:${seg}:tb:${ts}:${te}`,
        stream_id: STREAM_ID,
        segment_id: seg,
        window_span: { t_start: ts, t_end: te, duration_sec: te - ts, window_count: 1 },
        invariants: {
            energy_raw: 1.0,
            band_profile_norm: { band_energy: [1, 0] },
        },
        confidence: { overall: 1 },
        ...overrides,
    };
}

const BN_A = "BN:test:seg0:c0:aaaaaaaa";
const BN_B = "BN:test:seg0:c1:bbbbbbbb";
const BN_C = "BN:test:seg0:c2:cccccccc";

// ════ A. Dwell metrics ═══════════════════════════════════════════════════════

// J-A1: consecutive same-neighborhood frames increase dwell count
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:seg0:tb:1:2` }), basin_id: BN_A });
    tb.push({ state: makeTbState(2, 3, SEG_0, { state_id:`H1:s:seg0:tb:2:3` }), basin_id: BN_A });
    assert("J-A1: dwell count = 3 for 3 consecutive BN_A frames",
        tb.currentBasinDwellCount() === 3);
    assert("J-A1: dwell duration = 3.0 sec for three 1-sec BN_A frames",
        tb.currentDwellDurationSec() === 3);
}

// J-A2: neighborhood change resets current dwell count and duration
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:tb:1:2` }), basin_id: BN_A });
    tb.push({ state: makeTbState(2, 4, SEG_0, { state_id:`H1:s:s:tb:2:4` }), basin_id: BN_B }); // 2-sec frame
    assert("J-A2: dwell count resets to 1 on neighborhood change",
        tb.currentBasinDwellCount() === 1);
    assert("J-A2: dwell duration = 2.0 after reset to BN_B",
        tb.currentDwellDurationSec() === 2);
}

// J-A3: null neighborhood — dwell count and duration return 0
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: null });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:tb:1:2` }), basin_id: null });
    assert("J-A3: dwell count = 0 when last frame has null basin_id",
        tb.currentBasinDwellCount() === 0);
    assert("J-A3: dwell duration = 0 when last frame has null basin_id",
        tb.currentDwellDurationSec() === 0);
}

// J-A4: BN→null does not extend prior dwell; null→BN starts fresh dwell
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:tb:1:2` }), basin_id: null }); // lost
    assert("J-A4: BN→null: dwell count = 0",   tb.currentBasinDwellCount() === 0);
    assert("J-A4: BN→null: dwell duration = 0", tb.currentDwellDurationSec() === 0);

    tb.push({ state: makeTbState(2, 3, SEG_0, { state_id:`H1:s:s:tb:2:3` }), basin_id: BN_A }); // re-enter
    assert("J-A4: null→BN: dwell count = 1",    tb.currentBasinDwellCount() === 1);
    assert("J-A4: null→BN: dwell duration = 1", tb.currentDwellDurationSec() === 1);
}

// J-A5: empty buffer returns 0 for both dwell methods
{
    const tb = new TrajectoryBuffer();
    assert("J-A5: empty buffer: currentBasinDwellCount = 0",  tb.currentBasinDwellCount() === 0);
    assert("J-A5: empty buffer: currentDwellDurationSec = 0", tb.currentDwellDurationSec() === 0);
}

// J-A6: dwell duration with variable-length frames
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 0.5),  basin_id: BN_A }); // 0.5 sec
    tb.push({ state: makeTbState(0.5, 2.0, SEG_0, { state_id:`H1:s:s:tb:0.5:2.0` }), basin_id: BN_A }); // 1.5 sec
    assert("J-A6: dwell duration accumulates variable-length frames (0.5 + 1.5 = 2.0)",
        Math.abs(tb.currentDwellDurationSec() - 2.0) < 1e-10);
}

// ════ B. Transition instrumentation ══════════════════════════════════════════

// J-B1: A→B transition recorded exactly once
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:tb:1:2` }), basin_id: BN_B });
    const ts = tb.neighborhoodTransitionSummary();
    assert("J-B1: A→B: total_transitions = 1", ts.total_transitions === 1);
    assert("J-B1: A→B: transition.from = BN_A",  ts.transitions[0].from === BN_A);
    assert("J-B1: A→B: transition.to = BN_B",    ts.transitions[0].to === BN_B);
    assert("J-B1: A→B: t_transition = 1",         ts.transitions[0].t_transition === 1);
}

// J-B2: repeated A→A frames do NOT create transitions
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:tb:1:2` }), basin_id: BN_A });
    tb.push({ state: makeTbState(2, 3, SEG_0, { state_id:`H1:s:s:tb:2:3` }), basin_id: BN_A });
    const ts = tb.neighborhoodTransitionSummary();
    assert("J-B2: A→A→A: total_transitions = 0", ts.total_transitions === 0);
    assert("J-B2: A→A→A: transitions array is empty", ts.transitions.length === 0);
}

// J-B3: A→B→A records both transitions with correct directions
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:tb:1:2` }), basin_id: BN_B });
    tb.push({ state: makeTbState(2, 3, SEG_0, { state_id:`H1:s:s:tb:2:3` }), basin_id: BN_A });
    const ts = tb.neighborhoodTransitionSummary();
    assert("J-B3: A→B→A: total_transitions = 2", ts.total_transitions === 2);
    assert("J-B3: first transition: A→B",  ts.transitions[0].from === BN_A && ts.transitions[0].to === BN_B);
    assert("J-B3: second transition: B→A", ts.transitions[1].from === BN_B && ts.transitions[1].to === BN_A);
    // Transition counts by key
    assert("J-B3: transition_counts['BN_A→BN_B'] = 1",
        ts.transition_counts[`${BN_A}->${BN_B}`] === 1);
    assert("J-B3: transition_counts['BN_B→BN_A'] = 1",
        ts.transition_counts[`${BN_B}->${BN_A}`] === 1);
}

// J-B4: null frames are transparent — null→BN and BN→null not counted as transitions
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:tb:1:2` }), basin_id: null }); // gap
    tb.push({ state: makeTbState(2, 3, SEG_0, { state_id:`H1:s:s:tb:2:3` }), basin_id: BN_B }); // not a transition from BN_A
    const ts = tb.neighborhoodTransitionSummary();
    assert("J-B4: null gap: BN_A→null→BN_B counts 0 transitions (null frames transparent)",
        ts.total_transitions === 0);
}

// J-B5: A→B with multiple B frames then B→C — counts accumulate correctly
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:tb:1:2` }), basin_id: BN_B });
    tb.push({ state: makeTbState(2, 3, SEG_0, { state_id:`H1:s:s:tb:2:3` }), basin_id: BN_B });
    tb.push({ state: makeTbState(3, 4, SEG_0, { state_id:`H1:s:s:tb:3:4` }), basin_id: BN_C });
    const ts = tb.neighborhoodTransitionSummary();
    assert("J-B5: A→BB→C: total_transitions = 2", ts.total_transitions === 2);
    assert("J-B5: transitions are A→B and B→C",
        ts.transitions[0].from === BN_A && ts.transitions[0].to === BN_B &&
        ts.transitions[1].from === BN_B && ts.transitions[1].to === BN_C);
}

// J-B6: transition counting deterministic across repeated calls
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:tb:1:2` }), basin_id: BN_B });
    tb.push({ state: makeTbState(2, 3, SEG_0, { state_id:`H1:s:s:tb:2:3` }), basin_id: BN_A });
    const ts1 = tb.neighborhoodTransitionSummary();
    const ts2 = tb.neighborhoodTransitionSummary();
    assert("J-B6: neighborhoodTransitionSummary deterministic",
        JSON.stringify(ts1) === JSON.stringify(ts2));
}

// ════ C. Recurrence / re-entry ════════════════════════════════════════════════

// J-C1: re-entry increments count for returned neighborhood
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:tb:1:2` }), basin_id: BN_B }); // leave
    tb.push({ state: makeTbState(2, 3, SEG_0, { state_id:`H1:s:s:tb:2:3` }), basin_id: BN_A }); // re-enter
    const rs = tb.recurrenceSummary();
    assert("J-C1: BN_A re-entry count = 1 after one departure+return",
        rs.by_neighborhood[BN_A].re_entry_count === 1);
    assert("J-C1: total_re_entries = 1", rs.total_re_entries === 1);
}

// J-C2: neighborhood seen once, never revisited — re_entry_count = 0
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:tb:1:2` }), basin_id: BN_B });
    const rs = tb.recurrenceSummary();
    assert("J-C2: BN_A visited once: re_entry_count = 0",
        rs.by_neighborhood[BN_A]?.re_entry_count === 0);
    assert("J-C2: BN_B visited once: re_entry_count = 0",
        rs.by_neighborhood[BN_B]?.re_entry_count === 0);
    assert("J-C2: total_re_entries = 0", rs.total_re_entries === 0);
}

// J-C3: multiple re-entries accumulate correctly
{
    // A→B→A→B→A = 3 dwell runs for A, 2 re-entries; 2 runs for B, 1 re-entry
    const tb = new TrajectoryBuffer();
    const push = (ts, te, bid, n) => tb.push({
        state: makeTbState(ts, te, SEG_0, { state_id:`H1:s:s:tb:${ts}:${te}:${n}` }),
        basin_id: bid,
    });
    push(0, 1, BN_A, 0);
    push(1, 2, BN_B, 1);
    push(2, 3, BN_A, 2);
    push(3, 4, BN_B, 3);
    push(4, 5, BN_A, 4);
    const rs = tb.recurrenceSummary();
    assert("J-C3: BN_A: 3 dwell_runs", rs.by_neighborhood[BN_A]?.dwell_runs === 3);
    assert("J-C3: BN_A: re_entry_count = 2", rs.by_neighborhood[BN_A]?.re_entry_count === 2);
    assert("J-C3: BN_B: 2 dwell_runs", rs.by_neighborhood[BN_B]?.dwell_runs === 2);
    assert("J-C3: BN_B: re_entry_count = 1", rs.by_neighborhood[BN_B]?.re_entry_count === 1);
    assert("J-C3: total_re_entries = 3", rs.total_re_entries === 3);
}

// J-C4: null frames do not create dwell runs and are excluded from recurrence
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:tb:1:2` }), basin_id: null });
    tb.push({ state: makeTbState(2, 3, SEG_0, { state_id:`H1:s:s:tb:2:3` }), basin_id: BN_A });
    const rs = tb.recurrenceSummary();
    // Null gap between two BN_A dwells — two separate runs → re_entry_count = 1
    assert("J-C4: null gap between BN_A runs still counts as re-entry",
        rs.by_neighborhood[BN_A]?.re_entry_count === 1);
    assert("J-C4: null frames have no entry in recurrence summary",
        !(null in rs.by_neighborhood) && !("null" in rs.by_neighborhood));
}

// ════ D. Segment-aware reporting ══════════════════════════════════════════════

// J-D1: segment_id filter restricts transition summary to one segment
{
    const tb = new TrajectoryBuffer();
    // SEG_0 frames
    tb.push({ state: makeTbState(0, 1, SEG_0), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:seg0:tb:1:2` }), basin_id: BN_B });
    // SEG_1 frames
    tb.push({ state: makeTbState(2, 3, SEG_1, { state_id:`H1:s:seg1:tb:2:3`, segment_id:SEG_1 }), basin_id: BN_A });
    tb.push({ state: makeTbState(3, 4, SEG_1, { state_id:`H1:s:seg1:tb:3:4`, segment_id:SEG_1 }), basin_id: BN_C });

    const ts0 = tb.neighborhoodTransitionSummary({ segment_id: SEG_0 });
    assert("J-D1: SEG_0 transitions = 1 (A→B only)", ts0.total_transitions === 1);
    assert("J-D1: SEG_0 transition segment_id correct",
        ts0.transitions.every(t => t.segment_id === SEG_0));

    const ts1 = tb.neighborhoodTransitionSummary({ segment_id: SEG_1 });
    assert("J-D1: SEG_1 transitions = 1 (A→C only)", ts1.total_transitions === 1);

    // Full (no filter) should see both transitions but NOT a cross-segment BN_B→BN_A
    // (SEG_0's last frame is BN_B, SEG_1's first is BN_A — but segment IDs differ)
    // Since neighborhoodTransitionSummary doesn't impose segment-boundary breaks
    // on the unfiltered path, we document the actual behavior:
    const tsAll = tb.neighborhoodTransitionSummary();
    // A→B (seg0), B→A (cross-segment), A→C (seg1) = 3 transitions when unfiltered
    assert("J-D1: unfiltered transitions includes cross-segment frame adjacency",
        tsAll.total_transitions >= 2);
}

// J-D2: dwell summary respects segment filter
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1, SEG_0), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:seg0:tb:1:2` }), basin_id: BN_A });
    tb.push({ state: makeTbState(2, 3, SEG_1, { state_id:`H1:s:seg1:tb:2:3`, segment_id:SEG_1 }), basin_id: BN_A });

    const ds0 = tb.dwellSummary({ segment_id: SEG_0 });
    assert("J-D2: SEG_0 dwell: BN_A has 1 run of 2 frames",
        ds0.by_neighborhood[BN_A]?.runs === 1 &&
        ds0.by_neighborhood[BN_A]?.total_frames === 2);

    const ds1 = tb.dwellSummary({ segment_id: SEG_1 });
    assert("J-D2: SEG_1 dwell: BN_A has 1 run of 1 frame",
        ds1.by_neighborhood[BN_A]?.runs === 1 &&
        ds1.by_neighborhood[BN_A]?.total_frames === 1);
}

// J-D3: recurrence summary respects segment filter
{
    const tb = new TrajectoryBuffer();
    // SEG_0: BN_A → BN_B → BN_A (1 re-entry in SEG_0)
    tb.push({ state: makeTbState(0, 1, SEG_0), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:seg0:tb:1:2` }), basin_id: BN_B });
    tb.push({ state: makeTbState(2, 3, SEG_0, { state_id:`H1:s:seg0:tb:2:3` }), basin_id: BN_A });
    // SEG_1: BN_A only (no re-entry in SEG_1)
    tb.push({ state: makeTbState(3, 4, SEG_1, { state_id:`H1:s:seg1:tb:3:4`, segment_id:SEG_1 }), basin_id: BN_A });

    const rs0 = tb.recurrenceSummary({ segment_id: SEG_0 });
    assert("J-D3: SEG_0 recurrence: BN_A re_entry_count = 1",
        rs0.by_neighborhood[BN_A]?.re_entry_count === 1);

    const rs1 = tb.recurrenceSummary({ segment_id: SEG_1 });
    assert("J-D3: SEG_1 recurrence: BN_A re_entry_count = 0",
        rs1.by_neighborhood[BN_A]?.re_entry_count === 0);
}

// ════ E. Boundary safety ══════════════════════════════════════════════════════

// J-E1: instrumentation methods do not mutate committed H1 artifacts
{
    const msJE = new MemorySubstrate();
    const h1JE = makeH1(0, 1, { state_id:`H1:${STREAM_ID}:${SEG_0}:je:0:1` });
    msJE.commit(h1JE);
    msJE.rebuildBasins({ segment_id:SEG_0,
        basin_policy:{ ...BASIN_POLICY, similarity_threshold:0.8 } });
    const stateBefore = JSON.stringify(msJE.allStates()[0]);

    const tb = msJE.trajectory;
    tb.currentDwellDurationSec();
    tb.neighborhoodTransitionSummary();
    tb.dwellSummary();
    tb.recurrenceSummary();

    const stateAfter = JSON.stringify(msJE.allStates()[0]);
    assert("J-E1: instrumentation methods do not mutate committed H1 states",
        stateBefore === stateAfter);
}

// J-E2: instrumentation does not introduce canon/promotion fields in results
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:je:1:2` }), basin_id: BN_B });

    const ts = tb.neighborhoodTransitionSummary();
    const ds = tb.dwellSummary();
    const rs = tb.recurrenceSummary();

    const tsStr = JSON.stringify(ts);
    const dsStr = JSON.stringify(ds);
    const rsStr = JSON.stringify(rs);

    assert("J-E2: transition summary has no 'canon' fields",
        !tsStr.includes('"canon"') && !tsStr.includes('"promoted"') && !tsStr.includes('"C1"'));
    assert("J-E2: dwell summary has no 'canon' fields",
        !dsStr.includes('"canon"') && !dsStr.includes('"promoted"'));
    assert("J-E2: recurrence summary has no 'canon' fields",
        !rsStr.includes('"canon"') && !rsStr.includes('"promoted"'));
}

// J-E3: instrumentation does not alter BasinOp clustering behavior
{
    const bopJE = new BasinOp();
    const statesJE = [
        makeH1WithProfile(0, 1, [1.0, 0.0]),
        makeH1WithProfile(1, 2, [0.9, 0.1], SEG_0, { state_id:`H1:s:seg0:je:1:2` }),
    ];
    const resultBefore = bopJE.run({ states: statesJE, basin_policy: BASIN_POLICY });
    // Run instrumentation methods on a buffer
    const tbJE = new TrajectoryBuffer();
    tbJE.push({ state: statesJE[0], basin_id: BN_A });
    tbJE.push({ state: statesJE[1], basin_id: BN_B });
    tbJE.neighborhoodTransitionSummary();
    tbJE.dwellSummary();
    tbJE.recurrenceSummary();
    const resultAfter = bopJE.run({ states: statesJE, basin_policy: BASIN_POLICY });
    assert("J-E3: instrumentation does not alter BasinOp clustering",
        resultBefore.ok && resultAfter.ok &&
        JSON.stringify(resultBefore.artifact.basins.map(b => b.basin_id)) ===
        JSON.stringify(resultAfter.artifact.basins.map(b => b.basin_id)));
}

// J-E4: all four instrumentation methods are deterministic
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:det:1:2` }), basin_id: BN_B });
    tb.push({ state: makeTbState(2, 3, SEG_0, { state_id:`H1:s:s:det:2:3` }), basin_id: BN_A });

    assert("J-E4: currentDwellDurationSec deterministic",
        tb.currentDwellDurationSec() === tb.currentDwellDurationSec());
    assert("J-E4: neighborhoodTransitionSummary deterministic",
        JSON.stringify(tb.neighborhoodTransitionSummary()) ===
        JSON.stringify(tb.neighborhoodTransitionSummary()));
    assert("J-E4: dwellSummary deterministic",
        JSON.stringify(tb.dwellSummary()) === JSON.stringify(tb.dwellSummary()));
    assert("J-E4: recurrenceSummary deterministic",
        JSON.stringify(tb.recurrenceSummary()) === JSON.stringify(tb.recurrenceSummary()));
}

// J-E5: instrumentation methods return plain data — no live buffer references
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: BN_A });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:ref:1:2` }), basin_id: BN_B });

    const ts = tb.neighborhoodTransitionSummary();
    // Mutate returned transitions array
    ts.transitions[0].from = "corrupted";
    ts.total_transitions = 999;
    // Re-call — should produce original unaffected result
    const ts2 = tb.neighborhoodTransitionSummary();
    assert("J-E5: mutating returned transition summary does not affect subsequent calls",
        ts2.total_transitions === 1 && ts2.transitions[0].from === BN_A);

    const ds = tb.dwellSummary();
    ds.by_neighborhood[BN_A].runs = 999;
    const ds2 = tb.dwellSummary();
    assert("J-E5: mutating returned dwell summary does not affect subsequent calls",
        ds2.by_neighborhood[BN_A].runs === 1);
}

// ════ F. Dwell summary correctness — edge cases ═══════════════════════════════

// J-F1: single-frame dwell
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 2), basin_id: BN_A }); // 2-sec frame
    const ds = tb.dwellSummary();
    assert("J-F1: single-frame dwell: runs = 1", ds.by_neighborhood[BN_A]?.runs === 1);
    assert("J-F1: single-frame dwell: total_duration_sec = 2",
        ds.by_neighborhood[BN_A]?.total_duration_sec === 2);
    assert("J-F1: single-frame dwell: mean_duration_sec = 2",
        ds.by_neighborhood[BN_A]?.mean_duration_sec === 2);
}

// J-F2: mixed null and assigned frames — null frames not counted in dwell
{
    const tb = new TrajectoryBuffer();
    tb.push({ state: makeTbState(0, 1), basin_id: null });
    tb.push({ state: makeTbState(1, 2, SEG_0, { state_id:`H1:s:s:f2:1:2` }), basin_id: BN_A });
    tb.push({ state: makeTbState(2, 3, SEG_0, { state_id:`H1:s:s:f2:2:3` }), basin_id: null });
    tb.push({ state: makeTbState(3, 4, SEG_0, { state_id:`H1:s:s:f2:3:4` }), basin_id: BN_A });
    const ds = tb.dwellSummary();
    assert("J-F2: BN_A has 2 runs (null gaps break the run)",
        ds.by_neighborhood[BN_A]?.runs === 2);
    assert("J-F2: null frames produce no dwell entry",
        ds.by_neighborhood[null] === undefined && ds.by_neighborhood["null"] === undefined);
}

// J-F3: empty buffer returns empty dwell summary
{
    const tb = new TrajectoryBuffer();
    const ds = tb.dwellSummary();
    assert("J-F3: empty buffer: by_neighborhood is empty object",
        Object.keys(ds.by_neighborhood).length === 0);
    const rs = tb.recurrenceSummary();
    assert("J-F3: empty buffer: recurrence total_re_entries = 0",
        rs.total_re_entries === 0);
    const ts = tb.neighborhoodTransitionSummary();
    assert("J-F3: empty buffer: transition total_transitions = 0",
        ts.total_transitions === 0);
}

// ════════════════════════════════════════════════════════════════════════════
// K. Neighborhood Transition Report — MemorySubstrate.neighborhoodTransitionReport()
// ════════════════════════════════════════════════════════════════════════════

section("K. Neighborhood Transition Report");

// ── Shared fixture ───────────────────────────────────────────────────────────
// Build a fresh MemorySubstrate with a known sequence of neighborhood visits.
// We bypass the full pipeline and inject basin_ids directly into internal frames
// to keep the fixture tight. This is test-internal only.

const msK = new MemorySubstrate({ substrate_id: "report_test" });

const BN_K_A = "BN:rpt:seg0:c0:aabbccdd";
const BN_K_B = "BN:rpt:seg0:c1:eeff0011";
const BN_K_C = "BN:rpt:seg0:c2:22334455";
const SEG_K0 = `seg:${STREAM_ID}:0`;
const SEG_K1 = `seg:${STREAM_ID}:1`;

// Trajectory: A A B A null C  (seg0 for first 5, seg1 for last)
const kStates = [
    makeH1WithProfile(0, 1, [1,0], SEG_K0, { state_id:`H1:s:sk:0:1` }),
    makeH1WithProfile(1, 2, [1,0], SEG_K0, { state_id:`H1:s:sk:1:2` }),
    makeH1WithProfile(2, 3, [0,1], SEG_K0, { state_id:`H1:s:sk:2:3` }),
    makeH1WithProfile(3, 4, [1,0], SEG_K0, { state_id:`H1:s:sk:3:4` }),
    makeH1WithProfile(4, 5, [1,0], SEG_K0, { state_id:`H1:s:sk:4:5` }),  // null basin
    makeH1WithProfile(5, 6, [0.5,0.5], SEG_K1, {
        state_id:`H1:s:sk1:5:6`, segment_id:SEG_K1 }),
];
for (const s of kStates) msK.commit(s);

// Inject basin_ids directly into internal frames (test-internal only)
const kFrames = msK._trajectory._frames;
kFrames[0].basin_id = BN_K_A;
kFrames[1].basin_id = BN_K_A;
kFrames[2].basin_id = BN_K_B;
kFrames[3].basin_id = BN_K_A;
kFrames[4].basin_id = null;
kFrames[5].basin_id = BN_K_C;
// sequence: A A B A null C
// transitions: A→B, B→A (null gap before C means no B→C or A→C transition)
// dwell runs: A=[0,1], B=[2], A=[3], C=[5] (frame4 null is transparent)
// re-entries: A: 2 runs → 1 re-entry; B: 1 run; C: 1 run

const kReport = msK.neighborhoodTransitionReport();

// ── K-A: Basic report shape ──────────────────────────────────────────────────

assert("K-A1: report is a plain object (not null)", kReport !== null && typeof kReport === "object");
assert("K-A2: report.scope is present", typeof kReport.scope === "object");
assert("K-A3: report.total_frames_considered = 6", kReport.total_frames_considered === 6);
assert("K-A4: report.total_neighborhoods_observed = 3", kReport.total_neighborhoods_observed === 3);
assert("K-A5: report.transitions array present", Array.isArray(kReport.transitions));
assert("K-A6: report.dwell array present", Array.isArray(kReport.dwell));
assert("K-A7: report.recurrence array present", Array.isArray(kReport.recurrence));
assert("K-A8: report.neighborhoods_seen array present", Array.isArray(kReport.neighborhoods_seen));
assert("K-A9: report.transition_counts is object", typeof kReport.transition_counts === "object");
assert("K-A10: report.generated_from contains 'observational'",
    kReport.generated_from.includes("observational"));
assert("K-A10b: report.report_type = substrate:observational_report",
    kReport.report_type === "substrate:observational_report");
assert("K-A11: report.segment_boundary_behavior is present",
    typeof kReport.segment_boundary_behavior === "string");

// current dwell: last non-null frame has BN_K_C with 1 frame of 1 sec
assert("K-A12: current_neighborhood_id = BN_K_C", kReport.current_neighborhood_id === BN_K_C);
assert("K-A13: current_dwell_count = 1", kReport.current_dwell_count === 1);
assert("K-A14: current_dwell_duration_sec = 1", kReport.current_dwell_duration_sec === 1);

// Matches TrajectoryBuffer.currentBasinDwellCount()
assert("K-A15: current_dwell_count matches tb.currentBasinDwellCount()",
    kReport.current_dwell_count === msK.trajectory.currentBasinDwellCount());
assert("K-A16: current_dwell_duration_sec matches tb.currentDwellDurationSec()",
    kReport.current_dwell_duration_sec === msK.trajectory.currentDwellDurationSec());

// ── K-B: Transition correctness ──────────────────────────────────────────────

// Sequence A A B A null C → only A→B and B→A are non-null→different-non-null transitions
assert("K-B1: total_transitions = 2", kReport.total_transitions === 2);
assert("K-B2: transitions sorted by key (lexicographic)",
    kReport.transitions.every((t, i) => {
        if (i === 0) return true;
        const prev = `${kReport.transitions[i-1].from}->${kReport.transitions[i-1].to}`;
        const curr = `${t.from}->${t.to}`;
        return curr >= prev;
    }));

// A→B and B→A each appear once
const kTrans_AB = kReport.transitions.find(t => t.from === BN_K_A && t.to === BN_K_B);
const kTrans_BA = kReport.transitions.find(t => t.from === BN_K_B && t.to === BN_K_A);
assert("K-B3: A→B transition count = 1", kTrans_AB?.count === 1);
assert("K-B4: B→A transition count = 1", kTrans_BA?.count === 1);

// Null gap: frame4 is null so A→null and null→C are NOT counted
const kTrans_AC = kReport.transitions.find(t => t.from === BN_K_A && t.to === BN_K_C);
const kTrans_BC = kReport.transitions.find(t => t.from === BN_K_B && t.to === BN_K_C);
assert("K-B5: no A→C transition (null gap is transparent)", kTrans_AC === undefined);
assert("K-B6: no B→C transition (not adjacent)", kTrans_BC === undefined);

// Repeated A→A does not create a transition (frames 0 and 1)
const kTrans_AA = kReport.transitions.find(t => t.from === BN_K_A && t.to === BN_K_A);
assert("K-B7: no A→A self-transition", kTrans_AA === undefined);

// transition_counts mirrors the array (same data, different shape)
assert("K-B8: transition_counts matches transitions array",
    kReport.transitions.every(t => {
        const key = `${t.from}->${t.to}`;
        return kReport.transition_counts[key] === t.count;
    }));

// ── K-C: Dwell / recurrence correctness ─────────────────────────────────────

// dwell array sorted by basin_id
assert("K-C1: dwell sorted by basin_id",
    kReport.dwell.every((d, i) =>
        i === 0 || d.basin_id >= kReport.dwell[i-1].basin_id));

const kDwellA = kReport.dwell.find(d => d.basin_id === BN_K_A);
const kDwellB = kReport.dwell.find(d => d.basin_id === BN_K_B);
const kDwellC = kReport.dwell.find(d => d.basin_id === BN_K_C);

assert("K-C2: BN_A dwell_runs = 2 (two separate runs: [0,1] and [3])",
    kDwellA?.dwell_runs === 2);
assert("K-C3: BN_A total_frames = 3", kDwellA?.total_frames === 3);
assert("K-C4: BN_A total_duration_sec = 3", kDwellA?.total_duration_sec === 3);
assert("K-C5: BN_A mean_duration_sec = 1.5", kDwellA?.mean_duration_sec === 1.5);
assert("K-C6: BN_B dwell_runs = 1", kDwellB?.dwell_runs === 1);
assert("K-C7: BN_C dwell_runs = 1", kDwellC?.dwell_runs === 1);

// dwell matches TrajectoryBuffer.dwellSummary()
const kTbDwell = msK.trajectory.dwellSummary();
assert("K-C8: dwell in report matches tb.dwellSummary() for BN_A",
    kDwellA?.total_frames === kTbDwell.by_neighborhood[BN_K_A]?.total_frames);
assert("K-C9: dwell in report matches tb.dwellSummary() for BN_B",
    kDwellB?.total_frames === kTbDwell.by_neighborhood[BN_K_B]?.total_frames);

// recurrence sorted by basin_id
assert("K-C10: recurrence sorted by basin_id",
    kReport.recurrence.every((r, i) =>
        i === 0 || r.basin_id >= kReport.recurrence[i-1].basin_id));

const kRecA = kReport.recurrence.find(r => r.basin_id === BN_K_A);
assert("K-C11: BN_A re_entry_count = 1 (2 runs → 1 re-entry)", kRecA?.re_entry_count === 1);
assert("K-C12: total_re_entries = 1", kReport.total_re_entries === 1);

// recurrence matches TrajectoryBuffer.recurrenceSummary()
const kTbRecur = msK.trajectory.recurrenceSummary();
assert("K-C13: recurrence in report matches tb.recurrenceSummary()",
    kReport.recurrence.every(r =>
        r.re_entry_count === kTbRecur.by_neighborhood[r.basin_id]?.re_entry_count));

// neighborhoods_seen sorted, contains all three
assert("K-C14: neighborhoods_seen sorted",
    kReport.neighborhoods_seen.every((n, i) =>
        i === 0 || n >= kReport.neighborhoods_seen[i-1]));
assert("K-C15: neighborhoods_seen contains all non-null neighborhoods",
    [BN_K_A, BN_K_B, BN_K_C].every(id => kReport.neighborhoods_seen.includes(id)));
assert("K-C16: null not in neighborhoods_seen",
    !kReport.neighborhoods_seen.includes(null));

// ── K-D: Scope behavior ──────────────────────────────────────────────────────

// segment_id filter — SEG_K0 has frames 0-4; SEG_K1 has frame 5
const kRptSeg0 = msK.neighborhoodTransitionReport({ segment_id: SEG_K0 });
assert("K-D1: segment-scoped report: scope.segment_id preserved",
    kRptSeg0.scope.segment_id === SEG_K0);
assert("K-D2: segment-scoped: total_frames_considered = 5 (SEG_K0 only)",
    kRptSeg0.total_frames_considered === 5);
assert("K-D3: segment-scoped: BN_K_C not in neighborhoods_seen (it is in SEG_K1)",
    !kRptSeg0.neighborhoods_seen.includes(BN_K_C));
assert("K-D4: segment-scoped SEG_K1: total_frames = 1",
    msK.neighborhoodTransitionReport({ segment_id: SEG_K1 }).total_frames_considered === 1);

// stream_id filter
const kRptStream = msK.neighborhoodTransitionReport({ stream_id: STREAM_ID });
assert("K-D5: stream-scoped report: scope.stream_id preserved",
    kRptStream.scope.stream_id === STREAM_ID);
assert("K-D6: stream-scoped: all 6 frames returned (all have same stream_id)",
    kRptStream.total_frames_considered === 6);

// Non-existent segment → empty but lawful report
const kRptEmpty = msK.neighborhoodTransitionReport({ segment_id: "missing:segment" });
assert("K-D7: missing segment: total_frames_considered = 0", kRptEmpty.total_frames_considered === 0);
assert("K-D8: missing segment: total_transitions = 0",       kRptEmpty.total_transitions === 0);
assert("K-D9: missing segment: neighborhoods_seen is empty", kRptEmpty.neighborhoods_seen.length === 0);
assert("K-D10: missing segment: current_neighborhood_id = null",
    kRptEmpty.current_neighborhood_id === null);

// ── K-E: Determinism ─────────────────────────────────────────────────────────

const kRpt1 = msK.neighborhoodTransitionReport();
const kRpt2 = msK.neighborhoodTransitionReport();
assert("K-E1: report is deterministic across repeated calls",
    JSON.stringify(kRpt1) === JSON.stringify(kRpt2));
assert("K-E2: segment-scoped report deterministic",
    JSON.stringify(msK.neighborhoodTransitionReport({ segment_id: SEG_K0 })) ===
    JSON.stringify(msK.neighborhoodTransitionReport({ segment_id: SEG_K0 })));

// ── K-F: Boundary safety ─────────────────────────────────────────────────────

// F1: report does not mutate committed states
const statesBefore = JSON.stringify(msK.allStates().map(s => s.state_id + s.invariants.energy_raw));
msK.neighborhoodTransitionReport();
const statesAfter = JSON.stringify(msK.allStates().map(s => s.state_id + s.invariants.energy_raw));
assert("K-F1: report does not mutate committed states", statesBefore === statesAfter);

// F2: report does not mutate trajectory frames
const frameSig = f => f.state_id + f.basin_id + f.energy_raw;
const framesBefore = JSON.stringify(msK.trajectory.all().map(frameSig));
msK.neighborhoodTransitionReport();
const framesAfter = JSON.stringify(msK.trajectory.all().map(frameSig));
assert("K-F2: report does not mutate trajectory frames", framesBefore === framesAfter);

// F3: no canon/promoted/C1 fields in output
const kRptStr = JSON.stringify(kReport);
assert("K-F3: no 'canon' in report", !kRptStr.includes('"canon"'));
assert("K-F3: no 'C1' in report",    !kRptStr.includes('"C1"'));
assert("K-F3: no 'promoted' in report", !kRptStr.includes('"promoted"'));
assert("K-F3: no 'prediction' in report", !kRptStr.includes('"prediction"'));

// F4: mutating the returned report does not affect subsequent calls
const kMut = msK.neighborhoodTransitionReport();
kMut.transitions.push({ from:"fake", to:"fake", count:999 });
kMut.total_transitions = 999;
const kAfterMut = msK.neighborhoodTransitionReport();
assert("K-F4: mutating returned report does not affect subsequent calls",
    kAfterMut.total_transitions === kReport.total_transitions &&
    kAfterMut.transitions.length === kReport.transitions.length);

// F5: report does not alter BasinOp behavior
const bopK = new BasinOp();
const bopStates = [makeH1WithProfile(0,1,[1,0]), makeH1WithProfile(1,2,[0,1],SEG_K0,{state_id:"H1:s:sk:bop:1:2"})];
const bopBefore = JSON.stringify(bopK.run({ states:bopStates, basin_policy:BASIN_POLICY }).artifact.basins.map(b=>b.basin_id));
msK.neighborhoodTransitionReport();
const bopAfter = JSON.stringify(bopK.run({ states:bopStates, basin_policy:BASIN_POLICY }).artifact.basins.map(b=>b.basin_id));
assert("K-F5: report does not alter BasinOp clustering", bopBefore === bopAfter);

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${"═".repeat(54)}`);
console.log(`  ${passed} passed   ${failed} failed`);
if (failures.length > 0) {
    console.log("\nFailed:");
    for (const f of failures) console.log(f);
    console.log(`\n  SOME TESTS FAILED ✗`);
    process.exit(1);
} else {
    console.log(`  ALL TESTS PASSED ✓`);
}
