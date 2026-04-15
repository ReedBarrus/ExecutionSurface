import { AnomalyOp } from "../operators/anomaly/AnomalyOp.js";

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
    ok(
        Object.is(actual, expected),
        `${label}${Object.is(actual, expected) ? "" : ` (expected ${expected}, got ${actual})`}`
    );
}

function includes(text, pattern, label) {
    ok(String(text).includes(pattern), label);
}

function finish() {
    console.log(`\n${PASS} passed   ${FAIL} failed`);
    if (FAIL > 0) process.exit(1);
}

function makeH1({
    stateId,
    tStart,
    tEnd,
    durationSec = tEnd - tStart,
    streamId = "stream.anom.001",
    segmentId = "seg.anom.001",
    bandEnergy = [0.7, 0.3],
    keptBins = [
        { k: 1, freq_hz: 1, re: 0.7, im: 0, magnitude: 0.7, phase: 0 },
        { k: 2, freq_hz: 2, re: 0.3, im: 0, magnitude: 0.3, phase: 0 },
    ],
} = {}) {
    return {
        artifact_type: "HarmonicState",
        artifact_class: "H1",
        state_id: stateId,
        stream_id: streamId,
        segment_id: segmentId,
        window_span: {
            t_start: tStart,
            t_end: tEnd,
            duration_sec: durationSec,
            window_count: 1,
        },
        grid: { Fs_target: 8, N: 8, df: 1, bin_count_full: 4, bin_count_kept: keptBins.length },
        kept_bins: keptBins,
        invariants: {
            energy_raw: 1,
            energy_norm: 1,
            band_profile_norm: {
                band_edges: [0, 4, 8],
                band_energy: bandEnergy,
            },
        },
        policies: {
            clock_policy_id: "clock.v1",
            grid_policy_id: "grid.v1",
            window_policy_id: "window.v1",
            transform_policy_id: "transform.v1",
            compression_policy_id: "compress.v1",
        },
        provenance: {
            input_refs: [`W1:${stateId}`],
            operator_id: "CompressOp",
            operator_version: "0.1.0",
        },
    };
}

const aop = new AnomalyOp();
const BASE_POLICY = {
    policy_id: "anom.band",
    invariance_mode: "band_profile",
    divergence_metric: "band_l1",
    threshold_value: 0.2,
    frequency_tolerance_hz: 0,
    phase_sensitivity_mode: "off",
    novelty_min_duration: 1,
    segmentation_mode: "strict",
    dominant_bin_threshold: 0.1,
    new_frequency_threshold: 0.1,
    vanished_frequency_threshold: 0.1,
    energy_shift_threshold: 0.1,
};

section("A. Neutral anomaly output stays evidence-first");
{
    const current = makeH1({ stateId: "H1:cur:neutral", tStart: 0, tEnd: 1 });
    const baseline = makeH1({ stateId: "H1:base:neutral", tStart: 0, tEnd: 1 });
    const result = aop.run({ h_current: current, h_base: baseline, anomaly_policy: BASE_POLICY });

    ok(result.ok, "A1: identical-state anomaly run succeeds");
    eq(result.artifact.evidence_posture, "structural_deviation_evidence", "A2: evidence posture stays structural");
    eq(result.artifact.anomaly_receipt.threshold_relation, "below_or_equal_threshold", "A3: neutral case stays below threshold");
    includes(result.artifact.threshold_posture, "no material deviation closure", "A4: neutral threshold posture stays downgraded");
    eq(result.artifact.anomaly_receipt.event_label_posture, "bounded_evidence_labels_only", "A5: event labels stay fenced");
    ok(result.artifact.explicit_non_claims.includes("not a continuity verdict"), "A6: non-claims block continuity verdict");
    includes(result.artifact.anomaly_receipt.evidence_support_subset, "meaning deferred at this seam", "A7: support subset stays explicit");
}

section("B. Triggered anomaly stays boundary pressure, not semantic verdict");
{
    const current = makeH1({
        stateId: "H1:cur:novel",
        tStart: 0,
        tEnd: 2,
        durationSec: 2,
        bandEnergy: [0.0, 1.0],
        keptBins: [
            { k: 3, freq_hz: 3, re: 1, im: 0, magnitude: 1, phase: 0 },
        ],
    });
    const baseline = makeH1({
        stateId: "H1:base:novel",
        tStart: 0,
        tEnd: 2,
        durationSec: 2,
        bandEnergy: [1.0, 0.0],
        keptBins: [
            { k: 1, freq_hz: 1, re: 1, im: 0, magnitude: 1, phase: 0 },
        ],
    });
    const result = aop.run({
        h_current: current,
        h_base: baseline,
        anomaly_policy: { ...BASE_POLICY, threshold_value: 0.01, novelty_min_duration: 1 },
    });

    ok(result.ok, "B1: divergent anomaly run succeeds");
    eq(result.artifact.novelty_gate_triggered, true, "B2: novelty gate triggers when support is sufficient");
    eq(result.artifact.anomaly_receipt.threshold_relation, "above_threshold", "B3: threshold relation is explicit");
    includes(result.artifact.threshold_posture, "segmentation pressure registered", "B4: threshold posture names boundary pressure only");
    ok(result.artifact.explicit_non_claims.includes("not an identity claim"), "B5: non-claims block identity inflation");
}

section("C. Above-threshold but short duration downgrades explicitly");
{
    const current = makeH1({
        stateId: "H1:cur:short",
        tStart: 0,
        tEnd: 0.25,
        durationSec: 0.25,
        bandEnergy: [0.0, 1.0],
        keptBins: [
            { k: 3, freq_hz: 3, re: 1, im: 0, magnitude: 1, phase: 0 },
        ],
    });
    const baseline = makeH1({
        stateId: "H1:base:short",
        tStart: 0,
        tEnd: 0.25,
        durationSec: 0.25,
        bandEnergy: [1.0, 0.0],
        keptBins: [
            { k: 1, freq_hz: 1, re: 1, im: 0, magnitude: 1, phase: 0 },
        ],
    });
    const result = aop.run({
        h_current: current,
        h_base: baseline,
        anomaly_policy: { ...BASE_POLICY, threshold_value: 0.01, novelty_min_duration: 1.0 },
    });

    ok(result.ok, "C1: short-duration anomaly run succeeds");
    eq(result.artifact.anomaly_receipt.threshold_relation, "above_threshold", "C2: divergence can still be above threshold");
    eq(result.artifact.novelty_gate_triggered, false, "C3: novelty gate stays off when duration is insufficient");
    includes(result.artifact.threshold_posture, "duration_insufficient_for_novelty_gate", "C4: downgrade posture is explicit");
    eq(result.artifact.segmentation_recommendation, "continue_segment", "C5: segmentation stays non-escalatory");
}

finish();
