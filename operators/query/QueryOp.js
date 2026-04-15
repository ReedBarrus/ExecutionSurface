// operators/query/QueryOp.js

/**
 * QueryOp
 *
 * Layer: Perception Space
 * Authority class: Tooling (read-side recognition only; Q carries artifact_class="Q")
 *
 * Purpose:
 * Read-side retrieval and recognition over committed HarmonicStates (H1) and
 * MergedStates (M1). Returns a QueryResult (Q) containing scored references
 * to existing artifacts — it does not create, modify, or promote them.
 *
 * Contract:
 * - accepts corpus (H1[]/M1[]) + QuerySpec + QueryPolicy
 * - emits Q QueryResult
 * - three query modes: IDENTITY (complex bin vectors), ENERGY (spectral energy),
 *   BAND_PROFILE (normalized distribution, scale-invariant)
 * - four query kinds: similarity, band_lookup, energy_trend, compare
 * - current truthful query-class support is narrow:
 *     * Q0 observation / descriptive for energy_trend
 *     * Q1 structural retrieval for similarity, band_lookup, compare
 *   stronger continuity, support, memory, identity, review, or consultation
 *   query classes remain deferred at this seam
 * - deterministic given identical corpus + query_spec + query_policy;
 *   tie-break: score desc, then ref lexicographic
 * - never mutates corpus objects
 * - scope/filtering (stream_id, segment_id, time_range, allow_cross_segment)
 *   is retrieval discipline, not ontological classification
 *
 * Non-responsibilities:
 * - does NOT assert truth or assign meaning to results
 * - does NOT promote canon or update memory
 * - does NOT perform symbolic interpretation
 * - Q artifact is a snapshot of recognition results, not an authoritative claim;
 *   query_policy_id lives inside receipts.query (not at top level) to make
 *   the non-authoritative status explicit in the artifact shape
 *
 * Artifact IO:
 *   Input:  H1[]/M1[] corpus + QuerySpec + QueryPolicy
 *   Output: Q QueryResult
 *
 * References:
 * - README_WorkflowContract.md
 * - README_MasterConstitution.md §3 (perception layer)
 * - OPERATOR_CONTRACTS.md §9
 */

/**
 * @typedef {"IDENTITY"|"ENERGY"|"BAND_PROFILE"} QueryMode
 */

/**
 * @typedef {"similarity"|"band_lookup"|"energy_trend"|"compare"} QueryKind
 */

/**
 * @typedef {Object} QueryScope
 * @property {string} [stream_id]
 * @property {string[]} [stream_group]
 * @property {{t_start:number, t_end:number}} [time_range]
 * @property {string[]} [allowed_segment_ids]
 * @property {boolean} [allow_cross_segment=false]
 * @property {boolean} [same_grid_only=true]
 */

/**
 * @typedef {Object} QueryPolicy
 * @property {string} policy_id
 * @property {"cosine"|"l2_complex"|"band_l1"|"energy_delta"} scoring
 * @property {"none"|"energy_total"|"band_profile_norm"} normalization
 * @property {boolean} [phase_used=false]
 * @property {boolean} [allow_lens_merge=false]
 * @property {number} [topK=10]
 */

/**
 * @typedef {Object} QuerySpec
 * @property {string} query_id
 * @property {QueryKind} kind
 * @property {QueryMode} mode
 * @property {QueryScope} scope
 * @property {Object} [query]
 * @property {Object} [query.waveform]
 * @property {number[]} [query.waveform.values]
 * @property {number} [query.waveform.Fs_target]
 * @property {Object} [query.state]
 * @property {string} [query.band_spec]
 * @property {string} [query.baseline_ref]
 * @property {string} [query.current_ref]
 */

/**
 * @typedef {Object} HarmonicLike
 * @property {"H1"|"M1"} artifact_class
 * @property {string} state_id
 * @property {string} stream_id
 * @property {string} segment_id
 * @property {Object} window_span
 * @property {number} window_span.t_start
 * @property {number} window_span.t_end
 * @property {Object} grid
 * @property {number} grid.Fs_target
 * @property {number} grid.N
 * @property {number} grid.df
 * @property {Array<{k:number,freq_hz:number,re:number,im:number,magnitude:number,phase:number}>} kept_bins
 * @property {Object} invariants
 * @property {{band_edges:number[], band_energy:number[]}} invariants.band_profile_norm
 */

/**
 * @typedef {Object} QueryResultItem
 * @property {string} ref
 * @property {number} score
 * @property {number} rank
 * @property {string} artifact_class
 * @property {string} stream_id
 * @property {string} segment_id
 * @property {{t_start:number, t_end:number}} window_span
 * @property {Object} [explain]
 */

/**
 * @typedef {Object} QueryReceipt
 * @property {string} query_policy_id
 * @property {string} scoring
 * @property {string} normalization
 * @property {boolean} phase_used
 * @property {string[]} filters
 * @property {string[]} consulted_refs
 * @property {boolean} lens_artifact_used
 * @property {string} query_support_subset
 */

/**
 * @typedef {Object} QueryResult
 * @property {string} artifact_type
 * @property {"Q"} artifact_class
 * @property {string} query_id
 * @property {QueryKind} kind
 * @property {QueryMode} mode
 * @property {string} query_class
 * @property {string} claim_ceiling
 * @property {string} answer_posture
 * @property {string} downgrade_posture
 * @property {string[]} explicit_non_claims
 * @property {QueryScope} scope
 * @property {QueryResultItem[]} results
 * @property {Object} receipts
 * @property {QueryReceipt} receipts.query
 * @property {string} receipts.query.query_policy_id
 * @property {Object} provenance
 * @property {string[]} provenance.input_refs
 * @property {string} provenance.operator_id
 * @property {string} provenance.operator_version
 */

/**
 * @typedef {Object} QueryOpSuccess
 * @property {true} ok
 * @property {QueryResult} artifact
 *
 * @typedef {Object} QueryOpError
 * @property {false} ok
 * @property {string} error
 * @property {string[]} reasons
 *
 * @typedef {QueryOpSuccess | QueryOpError} QueryOutcome
 */

export class QueryOp {
    /**
     * @param {Object} cfg
     * @param {string} [cfg.operator_id="QueryOp"]
     * @param {string} [cfg.operator_version="0.1.0"]
     */
    constructor(cfg = {}) {
        this.operator_id = cfg.operator_id ?? "QueryOp";
        this.operator_version = cfg.operator_version ?? "0.1.0";
    }

    /**
     * @param {Object} input
     * @param {QuerySpec} input.query_spec
     * @param {QueryPolicy} input.query_policy
     * @param {HarmonicLike[]} input.corpus
     * @returns {QueryOutcome}
     */
    run(input) {
        const { query_spec, query_policy, corpus } = input ?? {};
        const reasons = [];

        if (!query_spec) reasons.push("query_spec is required");
        if (!query_policy) reasons.push("query_policy is required");
        if (!Array.isArray(corpus)) reasons.push("corpus must be an array");

        if (reasons.length > 0) {
            return { ok: false, error: "INVALID_SCHEMA", reasons };
        }

        const scoped = applyScope(corpus, query_spec.scope ?? {});
        if (!query_spec.scope?.allow_cross_segment) {
            enforceSegmentScope(query_spec, scoped, reasons);
        }
        if (reasons.length > 0) {
            return { ok: false, error: "INVALID_SCOPE", reasons };
        }
        for (const s of corpus) {
            if (!s || typeof s !== "object") {
                return {
                    ok: false,
                    error: "INVALID_CORPUS",
                    reasons: ["corpus entries must be objects"],
                };
            }
            if (!s.state_id || typeof s.state_id !== "string") {
                return {
                    ok: false,
                    error: "INVALID_CORPUS",
                    reasons: ["all corpus entries must have valid state_id"],
                };
            }
            if (!s.stream_id || typeof s.stream_id !== "string") {
                return {
                    ok: false,
                    error: "INVALID_CORPUS",
                    reasons: ["all corpus entries must have valid stream_id"],
                };
            }
            if (!s.segment_id || typeof s.segment_id !== "string") {
                return {
                    ok: false,
                    error: "INVALID_CORPUS",
                    reasons: ["all corpus entries must have valid segment_id"],
                };
            }
            if (!s.window_span || !Number.isFinite(s.window_span.t_start) || !Number.isFinite(s.window_span.t_end)) {
                return {
                    ok: false,
                    error: "INVALID_CORPUS",
                    reasons: ["all corpus entries must have valid window_span"],
                };
            }
            if (!s.grid || !Number.isFinite(s.grid.Fs_target) || !Number.isFinite(s.grid.N)) {
                return {
                    ok: false,
                    error: "INVALID_CORPUS",
                    reasons: ["all corpus entries must have valid grid"],
                };
            }
            if (!Array.isArray(s.kept_bins)) {
                return {
                    ok: false,
                    error: "INVALID_CORPUS",
                    reasons: ["all corpus entries must have kept_bins[]"],
                };
            }
        }
        const filters = buildFilterList(query_spec.scope ?? {});
        const mode = query_spec.mode;
        const kind = query_spec.kind;
        const topK = query_policy.topK ?? 10;
        const queryClass = deriveQueryClass(kind);
        const claimCeiling = deriveClaimCeiling(queryClass);

        let results = [];
        let consultedRefs = scoped.map(makeInputRef);
        let lensArtifactUsed = false;

        if (kind === "similarity") {
            const queryState = buildQueryState(query_spec, reasons);
            if (reasons.length > 0) {
                return { ok: false, error: "INVALID_QUERY", reasons };
            }

            const comparable = filterComparable(scoped, queryState, query_spec.scope ?? {});
            results = comparable.map((state) => {
                const score = scorePair(queryState, state, mode, query_policy);
                return {
                    ref: makeInputRef(state),
                    score,
                    rank: 0,
                    artifact_class: state.artifact_class,
                    stream_id: state.stream_id,
                    segment_id: state.segment_id,
                    window_span: {
                        t_start: state.window_span.t_start,
                        t_end: state.window_span.t_end,
                    },
                    explain: buildExplanation(queryState, state, mode, query_policy),
                };
            });

            results.sort((a, b) => b.score - a.score || a.ref.localeCompare(b.ref));
            results = assignRanks(results.slice(0, topK));
        }

        else if (kind === "band_lookup") {
            const bandSpec = query_spec.query?.band_spec;
            if (!bandSpec) {
                return {
                    ok: false,
                    error: "INVALID_QUERY",
                    reasons: ["band_lookup requires query.band_spec"],
                };
            }

            const parsedBand = parseBandSpec(bandSpec);
            if (!parsedBand) {
                return {
                    ok: false,
                    error: "INVALID_BAND_SPEC",
                    reasons: ["band_spec must look like 'f0:f1' in Hz"],
                };
            }

            results = scoped.map((state) => {
                const bandEnergy = bandEnergyForRange(state, parsedBand.f0, parsedBand.f1);
                return {
                    ref: makeInputRef(state),
                    score: bandEnergy,
                    rank: 0,
                    artifact_class: state.artifact_class,
                    stream_id: state.stream_id,
                    segment_id: state.segment_id,
                    window_span: {
                        t_start: state.window_span.t_start,
                        t_end: state.window_span.t_end,
                    },
                    explain: {
                        band_hz: [parsedBand.f0, parsedBand.f1],
                        band_energy: bandEnergy,
                    },
                };
            });

            results.sort((a, b) => b.score - a.score || a.ref.localeCompare(b.ref));
            results = assignRanks(results.slice(0, topK));
        }

        else if (kind === "energy_trend") {
            results = scoped
                .map((state) => ({
                    ref: makeInputRef(state),
                    score: state.invariants?.energy_raw ?? sumEnergy(state.kept_bins),
                    rank: 0,
                    artifact_class: state.artifact_class,
                    stream_id: state.stream_id,
                    segment_id: state.segment_id,
                    window_span: {
                        t_start: state.window_span.t_start,
                        t_end: state.window_span.t_end,
                    },
                    explain: {
                        energy_raw: state.invariants?.energy_raw ?? sumEnergy(state.kept_bins),
                    },
                }))
                .sort((a, b) => a.window_span.t_start - b.window_span.t_start || a.ref.localeCompare(b.ref));

            results = assignRanks(results);
        }

        else if (kind === "compare") {
            const baselineRef = query_spec.query?.baseline_ref;
            const currentRef = query_spec.query?.current_ref;

            if (!baselineRef || !currentRef) {
                return {
                    ok: false,
                    error: "INVALID_QUERY",
                    reasons: ["compare requires query.baseline_ref and query.current_ref"],
                };
            }

            const baseline = scoped.find((s) => makeInputRef(s) === baselineRef);
            const current = scoped.find((s) => makeInputRef(s) === currentRef);

            if (!baseline || !current) {
                return {
                    ok: false,
                    error: "REF_NOT_FOUND",
                    reasons: ["baseline_ref/current_ref not found in scoped corpus"],
                };
            }

            const score = scorePair(baseline, current, mode, query_policy);
            results = assignRanks([{
                ref: makeInputRef(current),
                score,
                rank: 0,
                artifact_class: current.artifact_class,
                stream_id: current.stream_id,
                segment_id: current.segment_id,
                window_span: {
                    t_start: current.window_span.t_start,
                    t_end: current.window_span.t_end,
                },
                explain: buildExplanation(baseline, current, mode, query_policy),
            }]);

            consultedRefs = [makeInputRef(baseline), makeInputRef(current)];
        }

        else {
            return {
                ok: false,
                error: "UNSUPPORTED_QUERY_KIND",
                reasons: [`Unsupported query kind: ${kind}`],
            };
        }

        /** @type {QueryResult} */
        const artifact = {
            artifact_type: "QueryResult",
            artifact_class: "Q",
            query_id: query_spec.query_id,
            kind,
            mode,
            query_class: queryClass,
            claim_ceiling: claimCeiling,
            answer_posture: deriveAnswerPosture({ queryClass, results }),
            downgrade_posture: deriveDowngradePosture({ queryClass, results }),
            explicit_non_claims: explicitNonClaimsForQueryClass(queryClass),
            scope: query_spec.scope,
            results,
            receipts: {
                query: {
                    query_policy_id: makeQueryPolicyId(query_policy),
                    scoring: query_policy.scoring,
                    normalization: query_policy.normalization,
                    phase_used: query_policy.phase_used ?? false,
                    filters,
                    consulted_refs: consultedRefs,
                    lens_artifact_used: lensArtifactUsed,
                    query_support_subset: "Q0 observation and Q1 structural retrieval only; Q2+ deferred at this seam",
                },
            },
            provenance: {
                input_refs: consultedRefs,
                operator_id: this.operator_id,
                operator_version: this.operator_version,
            },
        };

        return { ok: true, artifact };
    }
}

function deriveQueryClass(kind) {
    if (kind === "energy_trend") return "Q0_observation";
    if (["similarity", "band_lookup", "compare"].includes(kind)) return "Q1_structural";
    return "Q_unknown";
}

function deriveClaimCeiling(queryClass) {
    if (queryClass === "Q0_observation") return "L0_descriptive_only";
    if (queryClass === "Q1_structural") return "L0_descriptive_or_structural_support_only";
    return "deferred";
}

function deriveAnswerPosture({ queryClass, results }) {
    const count = Array.isArray(results) ? results.length : 0;
    if (count === 0) {
        return queryClass === "Q0_observation"
            ? "descriptive_no_match"
            : "structural_no_match";
    }
    if (queryClass === "Q0_observation") return "descriptive_match_set";
    if (queryClass === "Q1_structural") return "structural_match_set";
    return "deferred";
}

function deriveDowngradePosture({ queryClass, results }) {
    const count = Array.isArray(results) ? results.length : 0;
    if (count === 0) {
        return "empty result set | no stronger closure is justified from this query at the current seam";
    }
    if (queryClass === "Q0_observation") {
        return "observation-only | returned matches do not become structural continuity, memory, or identity claims";
    }
    if (queryClass === "Q1_structural") {
        return "structural-only | retrieval similarity does not become support, memory, continuity, or identity closure";
    }
    return "deferred | stronger query posture remains unsupported at this seam";
}

function explicitNonClaimsForQueryClass(queryClass) {
    const base = ["not truth", "not canon", "not a memory claim", "not an identity claim"];
    if (queryClass === "Q0_observation") {
        return [...base, "not a structural continuity verdict"];
    }
    return [...base, "not a continuity verdict"];
}

/**
 * @param {HarmonicLike[]} corpus
 * @param {QueryScope} scope
 */
function applyScope(corpus, scope) {
    return corpus.filter((s) => {
        if (scope.stream_id && s.stream_id !== scope.stream_id) return false;
        if (scope.stream_group && !scope.stream_group.includes(s.stream_id)) return false;

        if (scope.time_range) {
            const overlaps =
                s.window_span.t_end > scope.time_range.t_start &&
                s.window_span.t_start < scope.time_range.t_end;
            if (!overlaps) return false;
        }

        if (scope.allowed_segment_ids && !scope.allowed_segment_ids.includes(s.segment_id)) {
            return false;
        }

        return true;
    });
}

function enforceSegmentScope(querySpec, scoped, reasons) {
    if (scoped.length <= 1) return;
    const segs = new Set(scoped.map((s) => s.segment_id));
    if (segs.size > 1) {
        reasons.push("query crosses segment boundaries but allow_cross_segment=false");
    }
}

/**
 * @param {HarmonicLike[]} scoped
 * @param {HarmonicLike} queryState
 * @param {QueryScope} scope
 */
function filterComparable(scoped, queryState, scope) {
    return scoped.filter((s) => {
        if (scope.same_grid_only ?? true) {
            if (s.grid.Fs_target !== queryState.grid.Fs_target) return false;
            if (s.grid.N !== queryState.grid.N) return false;
            if (s.grid.df !== queryState.grid.df) return false;
        }
        return true;
    });
}

function buildFilterList(scope) {
    const out = [];
    if (scope.same_grid_only ?? true) out.push("same_grid");
    if (!(scope.allow_cross_segment ?? false)) out.push("same_era");
    if (scope.stream_id) out.push("stream_id");
    if (scope.time_range) out.push("time_range");
    return out;
}

/**
 * Door One query-state builder:
 * - if query.state supplied, use it directly
 * - waveform path declared but not implemented here
 */
function buildQueryState(querySpec, reasons) {
    if (querySpec.query?.state) return querySpec.query.state;

    if (querySpec.query?.waveform) {
        reasons.push("waveform query path declared but not implemented in QueryOp stub; transform upstream first");
        return null;
    }

    reasons.push("similarity query requires query.state or query.waveform");
    return null;
}

/**
 * @param {HarmonicLike} a
 * @param {HarmonicLike} b
 * @param {QueryMode} mode
 * @param {QueryPolicy} policy
 */
function scorePair(a, b, mode, policy) {
    if (mode === "IDENTITY") {
        if (policy.scoring === "l2_complex") {
            return 1 / (1 + l2ComplexDistance(a.kept_bins, b.kept_bins));
        }
        return cosine(
            complexVector(a.kept_bins, a.grid.N),
            complexVector(b.kept_bins, b.grid.N)
        );
    }

    if (mode === "ENERGY") {
        if (policy.scoring === "energy_delta") {
            const ea = a.invariants?.energy_raw ?? sumEnergy(a.kept_bins);
            const eb = b.invariants?.energy_raw ?? sumEnergy(b.kept_bins);
            return 1 - Math.min(1, Math.abs(ea - eb) / Math.max(Math.abs(ea), Math.abs(eb), 1e-12));
        }
        return cosine(
            bandVectorEnergy(a),
            bandVectorEnergy(b)
        );
    }

    // BAND_PROFILE
    if (policy.scoring === "band_l1") {
        const pa = a.invariants?.band_profile_norm?.band_energy ?? [];
        const pb = b.invariants?.band_profile_norm?.band_energy ?? [];
        return 1 / (1 + l1(pa, pb));
    }

    return cosine(
        a.invariants?.band_profile_norm?.band_energy ?? [],
        b.invariants?.band_profile_norm?.band_energy ?? []
    );
}

/**
 * @param {HarmonicLike} a
 * @param {HarmonicLike} b
 * @param {QueryMode} mode
 * @param {QueryPolicy} policy
 */
function buildExplanation(a, b, mode, policy) {
    if (mode === "IDENTITY") {
        return {
            metric: policy.scoring,
            phase_used: policy.phase_used ?? false,
            complex_distance: l2ComplexDistance(a.kept_bins, b.kept_bins),
        };
    }

    if (mode === "ENERGY") {
        const ea = a.invariants?.energy_raw ?? sumEnergy(a.kept_bins);
        const eb = b.invariants?.energy_raw ?? sumEnergy(b.kept_bins);
        return {
            metric: policy.scoring,
            energy_a: ea,
            energy_b: eb,
            energy_delta_rel: Math.abs(ea - eb) / Math.max(Math.abs(ea), Math.abs(eb), 1e-12),
        };
    }

    const pa = a.invariants?.band_profile_norm?.band_energy ?? [];
    const pb = b.invariants?.band_profile_norm?.band_energy ?? [];
    return {
        metric: policy.scoring,
        band_profile_l1: l1(pa, pb),
    };
}

function assignRanks(results) {
    return results.map((r, i) => ({ ...r, rank: i + 1 }));
}

function parseBandSpec(spec) {
    const parts = String(spec).split(":").map(Number);
    if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
    return { f0: Math.min(parts[0], parts[1]), f1: Math.max(parts[0], parts[1]) };
}

function bandEnergyForRange(state, f0, f1) {
    let e = 0;
    for (const b of state.kept_bins ?? []) {
        if (b.freq_hz >= f0 && b.freq_hz < f1) {
            e += b.re * b.re + b.im * b.im;
        }
    }
    return e;
}

function complexVector(bins, N) {
    const out = new Array(2 * (Math.floor(N / 2) + 1)).fill(0);
    for (const b of bins ?? []) {
        const idx = 2 * b.k;
        if (idx + 1 < out.length) {
            out[idx] = b.re;
            out[idx + 1] = b.im;
        }
    }
    return out;
}

function bandVectorEnergy(state) {
    return state.invariants?.band_profile_norm?.band_energy ?? [];
}

function l2ComplexDistance(aBins, bBins) {
    const a = new Map((aBins ?? []).map((b) => [b.k, b]));
    const b = new Map((bBins ?? []).map((b) => [b.k, b]));
    const keys = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => x - y);
    let s = 0;
    for (const k of keys) {
        const av = a.get(k) ?? { re: 0, im: 0 };
        const bv = b.get(k) ?? { re: 0, im: 0 };
        const dre = av.re - bv.re;
        const dim = av.im - bv.im;
        s += dre * dre + dim * dim;
    }
    return Math.sqrt(s);
}

function cosine(a, b) {
    const n = Math.max(a.length, b.length);
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < n; i++) {
        const av = a[i] ?? 0;
        const bv = b[i] ?? 0;
        dot += av * bv;
        na += av * av;
        nb += bv * bv;
    }
    if (na === 0 || nb === 0) return 0;
    return dot / Math.sqrt(na * nb);
}

function makeQueryPolicyId(policy) {
    return [
        "QUERY",
        `pid=${policy.policy_id ?? "unspecified"}`,
        `score=${policy.scoring ?? "unspecified"}`,
        `norm=${policy.normalization ?? "none"}`,
        `phase=${policy.phase_used ?? false}`,
        `lens=${policy.allow_lens_merge ?? false}`,
        `topK=${policy.topK ?? 10}`,
    ].join(":");
}

function l1(a, b) {
    const n = Math.max(a.length, b.length);
    let s = 0;
    for (let i = 0; i < n; i++) {
        s += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    }
    return s;
}

function sumEnergy(bins) {
    let e = 0;
    for (const b of bins ?? []) e += b.re * b.re + b.im * b.im;
    return e;
}

function makeInputRef(s) {
    return s.state_id;
}
