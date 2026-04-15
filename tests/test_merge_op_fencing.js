import { MergeOp } from "../operators/merge/MergeOp.js";

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

function makePolicies(overrides = {}) {
    return {
        clock_policy_id: "clock.v1",
        grid_policy_id: "grid.v1",
        window_policy_id: "window.v1",
        transform_policy_id: "transform.v1",
        compression_policy_id: "compress.v1",
        ...overrides,
    };
}

function makeH1({
    stateId,
    tStart,
    tEnd,
    durationSec = tEnd - tStart,
    streamId = "stream.merge.001",
    segmentId = "seg.merge.001",
    keptBins = [
        { k: 1, freq_hz: 1, re: 1, im: 0, magnitude: 1, phase: 0 },
        { k: 2, freq_hz: 2, re: 0.5, im: 0, magnitude: 0.5, phase: 0 },
    ],
    bandEnergy = [0.7, 0.3],
    policies = makePolicies(),
    blockedReason = "none",
    confidence = 1,
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
        grid: {
            Fs_target: 8,
            N: 8,
            df: 1,
            bin_count_full: 4,
            bin_count_kept: keptBins.length,
        },
        kept_bins: keptBins,
        invariants: {
            energy_raw: keptBins.reduce((sum, b) => sum + (b.re * b.re + b.im * b.im), 0),
            energy_norm: 1,
            band_profile_norm: {
                band_edges: [0, 4, 8],
                band_energy: bandEnergy,
            },
        },
        uncertainty: {
            time: {},
            phase_by_band: {},
            replay: {},
            distortion: {},
        },
        confidence: {
            by_invariant: { identity: confidence, energy: confidence, band_profile: confidence },
            overall: confidence,
            method: "test",
        },
        gates: {
            blocked_reason: blockedReason,
        },
        receipts: {},
        policies,
        provenance: {
            input_refs: [`W1:${stateId}`],
            operator_id: "CompressOp",
            operator_version: "0.1.0",
        },
    };
}

const MERGE_POLICY = {
    policy_id: "merge.v1",
    adjacency_rule: "time_touching",
    phase_alignment_mode: "clock_delta_rotation",
    weights_mode: "duration",
    novelty_gate: "off",
    merge_mode: "authoritative",
    grid_tolerance: 0,
};

const POST_MERGE_COMPRESS = {
    policy_id: "mergecomp.v1",
    selection_method: "topK",
    budget_K: 2,
    maxK: 2,
    include_dc: true,
    invariance_lens: "identity",
    thresholds: {
        max_recon_rmse: 999,
        max_energy_residual: 0.05,
        max_band_divergence: 0.05,
    },
    band_edges: [0, 4, 8],
};

section("A. Authoritative merge stays structural consolidation only");
{
    const h1a = makeH1({ stateId: "H1:A", tStart: 0, tEnd: 1 });
    const h1b = makeH1({ stateId: "H1:B", tStart: 1, tEnd: 2 });
    const result = new MergeOp().run({
        states: [h1a, h1b],
        merge_policy: MERGE_POLICY,
        post_merge_compression_policy: POST_MERGE_COMPRESS,
    });

    ok(result.ok, "A1: authoritative merge succeeds");
    eq(result.artifact.evidence_posture, "structural_consolidation_evidence", "A2: evidence posture stays structural");
    includes(result.artifact.merge_basis_posture, "same-object closure", "A3: merge basis blocks same-object inflation");
    eq(result.artifact.receipts.merge.input_scope_posture, "same_stream_same_segment_same_policy_scope", "A4: scope posture stays local and bounded");
    includes(result.artifact.receipts.merge.adjacency_posture, "local contiguous consolidation", "A5: adjacency posture stays structural");
    ok(result.artifact.explicit_non_claims.includes("not a same-object verdict"), "A6: non-claims block same-object verdict");
}

section("B. Lens merge names cross-boundary consolidation without authority uplift");
{
    const h1a = makeH1({ stateId: "H1:L1", tStart: 0, tEnd: 1, segmentId: "seg.alpha" });
    const h1b = makeH1({
        stateId: "H1:L2",
        tStart: 1,
        tEnd: 2,
        segmentId: "seg.beta",
        policies: makePolicies({ compression_policy_id: "compress.alt" }),
    });
    const result = new MergeOp().run({
        states: [h1a, h1b],
        merge_policy: { ...MERGE_POLICY, merge_mode: "lens" },
        post_merge_compression_policy: POST_MERGE_COMPRESS,
    });

    ok(result.ok, "B1: lens merge succeeds across boundary changes");
    eq(result.artifact.gates.eligible_for_authoritative_merge, false, "B2: lens merge stays non-authoritative");
    eq(result.artifact.receipts.merge.input_scope_posture, "cross_boundary_lens_scope", "B3: scope posture names cross-boundary basis");
    includes(result.artifact.merge_basis_posture, "cross-boundary structural consolidation only", "B4: lens basis remains consolidation-only");
    ok(result.artifact.explicit_non_claims.includes("not an identity claim"), "B5: non-claims block identity inflation");
}

section("C. Narrowed merge basis is explicit under invariant stress");
{
    const h1a = makeH1({
        stateId: "H1:N1",
        tStart: 0,
        tEnd: 1,
        keptBins: [{ k: 1, freq_hz: 1, re: 1, im: 0, magnitude: 1, phase: 0 }],
        bandEnergy: [1, 0],
    });
    const h1b = makeH1({
        stateId: "H1:N2",
        tStart: 1,
        tEnd: 2,
        keptBins: [{ k: 1, freq_hz: 1, re: -1, im: 0, magnitude: 1, phase: Math.PI }],
        bandEnergy: [1, 0],
    });
    const result = new MergeOp().run({
        states: [h1a, h1b],
        merge_policy: MERGE_POLICY,
        post_merge_compression_policy: { ...POST_MERGE_COMPRESS, budget_K: 1, include_dc: false },
    });

    ok(result.ok, "C1: stressed authoritative merge still emits bounded artifact");
    ok(result.artifact.gates.blocked_reason !== "none", "C2: stressed merge records invariant pressure");
    includes(result.artifact.merge_basis_posture, "authoritative_basis_narrowed", "C3: narrowed posture is explicit");
    includes(result.artifact.merge_basis_posture, "same-object closure deferred", "C4: narrowed merge still blocks same-object closure");
    includes(result.artifact.receipts.merge.consolidation_support_subset, "same-object, memory, identity, and review meaning deferred", "C5: support subset stays explicit");
}

finish();
