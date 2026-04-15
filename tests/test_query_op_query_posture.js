import { QueryOp } from "../operators/query/QueryOp.js";

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

function makeState({
    stateId,
    tStart,
    tEnd,
    streamId = "stream.qop.001",
    segmentId = "seg.001",
    energy = 4,
    bandEnergy = [0.5, 0.3, 0.2],
    keptBins = [
        { k: 0, freq_hz: 0, re: 1, im: 0, magnitude: 1, phase: 0 },
        { k: 1, freq_hz: 1, re: 0.5, im: 0.25, magnitude: 0.559, phase: 0.46 },
    ],
} = {}) {
    return {
        artifact_class: "H1",
        state_id: stateId,
        stream_id: streamId,
        segment_id: segmentId,
        window_span: { t_start: tStart, t_end: tEnd },
        grid: { Fs_target: 8, N: 8, df: 1 },
        kept_bins: keptBins,
        invariants: {
            energy_raw: energy,
            band_profile_norm: {
                band_edges: [0, 1, 2, 3],
                band_energy: bandEnergy,
            },
        },
    };
}

const CORPUS = [
    makeState({ stateId: "H1:0", tStart: 0, tEnd: 1, energy: 2, bandEnergy: [0.6, 0.2, 0.2] }),
    makeState({ stateId: "H1:1", tStart: 1, tEnd: 2, energy: 4, bandEnergy: [0.2, 0.6, 0.2] }),
    makeState({ stateId: "H1:2", tStart: 2, tEnd: 3, energy: 6, bandEnergy: [0.2, 0.2, 0.6] }),
];

const qop = new QueryOp();

section("A. Q0 observation posture remains explicit");
{
    const result = qop.run({
        query_spec: {
            query_id: "q.energy",
            kind: "energy_trend",
            mode: "ENERGY",
            scope: { stream_id: "stream.qop.001", allow_cross_segment: true },
        },
        query_policy: {
            policy_id: "qp.energy",
            scoring: "energy_delta",
            normalization: "none",
            topK: 5,
        },
        corpus: CORPUS,
    });

    ok(result.ok, "A1: energy_trend query succeeds");
    eq(result.artifact.query_class, "Q0_observation", "A2: energy_trend stays Q0 observation");
    eq(result.artifact.claim_ceiling, "L0_descriptive_only", "A3: Q0 claim ceiling stays descriptive only");
    eq(result.artifact.answer_posture, "descriptive_match_set", "A4: Q0 answer posture stays descriptive");
    includes(result.artifact.downgrade_posture, "observation-only", "A5: Q0 downgrade posture stays fenced");
    ok(result.artifact.explicit_non_claims.includes("not a structural continuity verdict"), "A6: Q0 non-claim blocks continuity inflation");
    includes(result.artifact.receipts.query.query_support_subset, "Q0 observation and Q1 structural", "A7: supported subset stays explicit");
}

section("B. Q1 structural retrieval stays below stronger closure");
{
    const result = qop.run({
        query_spec: {
            query_id: "q.sim",
            kind: "similarity",
            mode: "IDENTITY",
            scope: { stream_id: "stream.qop.001", allow_cross_segment: true },
            query: { state: CORPUS[0] },
        },
        query_policy: {
            policy_id: "qp.sim",
            scoring: "cosine",
            normalization: "none",
            topK: 3,
        },
        corpus: CORPUS,
    });

    ok(result.ok, "B1: similarity query succeeds");
    eq(result.artifact.query_class, "Q1_structural", "B2: similarity stays Q1 structural");
    eq(result.artifact.claim_ceiling, "L0_descriptive_or_structural_support_only", "B3: Q1 claim ceiling stays narrow");
    eq(result.artifact.answer_posture, "structural_match_set", "B4: Q1 answer posture stays structural");
    includes(result.artifact.downgrade_posture, "does not become support, memory, continuity, or identity", "B5: Q1 downgrade posture blocks inflation");
    ok(result.artifact.explicit_non_claims.includes("not an identity claim"), "B6: Q1 non-claims block identity inflation");
}

section("C. Thin result sets do not inherit stronger closure");
{
    const result = qop.run({
        query_spec: {
            query_id: "q.empty",
            kind: "band_lookup",
            mode: "BAND_PROFILE",
            scope: { stream_id: "stream.missing", allow_cross_segment: true },
            query: { band_spec: "0:2" },
        },
        query_policy: {
            policy_id: "qp.empty",
            scoring: "band_l1",
            normalization: "band_profile_norm",
            topK: 5,
        },
        corpus: CORPUS,
    });

    ok(result.ok, "C1: empty-scope query returns lawful empty result");
    eq(result.artifact.query_class, "Q1_structural", "C2: empty-scope query class remains explicit");
    eq(result.artifact.results.length, 0, "C3: empty-scope query returns zero results");
    eq(result.artifact.answer_posture, "structural_no_match", "C4: empty-scope answer posture downgrades explicitly");
    includes(result.artifact.downgrade_posture, "no stronger closure is justified", "C5: empty-scope downgrade posture blocks silent inflation");
}

finish();
