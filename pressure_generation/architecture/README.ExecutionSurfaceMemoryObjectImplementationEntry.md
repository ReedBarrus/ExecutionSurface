# ExecutionSurface MemoryObject Implementation Entry

## Status

This document is the bounded implementation-entry note for the first
`MemoryObject` runtime slice.

It is not a replacement for:

- `pressure_generation/architecture/README.ExecutionSurfaceArchitectureSeed.md`
- `pressure_generation/architecture/README.ExecutionSurfaceImplementationLadder.md`
- `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceMemoryObjectEnvelope.md`

Its job is simpler:

pin the live repo seam, the smallest lawful first cut, and the exact proof
targets for beginning `MemoryObject` admission work without widening into LM,
comparison, or broader projection churn.

## Active seam

`analog_signal` admission boundary at the substrate commit seam.

Current live path:

`CompressOp -> H1`
`MergeOp -> M1`
`DoorOneOrchestrator -> MemorySubstrate.commit(H1/M1)`

The first implementation pass should rebase that seam toward:

`CompressOp / MergeOp -> analog_signal admission adapter -> MemoryObject -> MemorySubstrate.commit(MemoryObject)`

while preserving direct access to the carried `H1` / `M1` payloads.

## Current repo-grounded runtime reality

The current code path is narrower and more concrete than the earlier
architecture projection implied.

### Confirmed commit boundary

- `operators/substrate/MemorySubstrate.js`
  - `commit(state, opts)` currently accepts only raw `H1` or `M1`
  - legitimacy checks are written directly against `state.*`
  - stored corpus is keyed by `state.state_id`
  - trajectory frames also carry the raw state object

### Confirmed commit callers

- `runtime/DoorOneOrchestrator.js`
  - commits `h1` in `processWindow()`
  - commits merged `m1` in `finalise()`

- `scripts/run_pipeline_substrate.js`
  - mirrors the same raw `H1` / `M1` commit path in script form

### Confirmed downstream assumption

Large parts of the runtime still assume committed substrate entries are direct
support objects with fields such as:

- `artifact_class`
- `state_id`
- `stream_id`
- `segment_id`
- `window_span`
- `kept_bins`
- `invariants`

This assumption appears in:

- substrate retrieval and summary paths
- query and reconstruction seams
- basin and trajectory logic
- substrate contract tests

So the first pass must preserve truthful support access instead of forcing an
immediate full runtime rewrite around envelope-only reads.

## First bounded implementation slice

The smallest lawful first slice is:

### 1. Introduce a local `MemoryObject` contract surface for `analog_signal`

Minimum implementation target:

- `memory_object_id`
- `source_family`
- `payload_kind`
- `payload_ref`
- `support_refs`
- `admission_extent`
- `provenance_edges`
- `policy_refs`
- `continuity_constraints`
- `relation_slots`
- `explicit_non_claims`

For the first slice, `payload_ref` may remain a direct in-memory carried payload
reference rather than a detached storage layer.

### 2. Add an `analog_signal` admission adapter

The adapter should wrap a lawful `H1` or `M1` payload into a `MemoryObject`
without flattening:

- `H1` becomes `payload_kind: "h1_support"`
- `M1` becomes `payload_kind: "m1_support"`

The adapter should preserve:

- original payload
- `artifact_class`
- `state_id`
- stream and segment placement
- temporal span
- provenance anchors
- policy anchors
- explicit non-claims

### 3. Rebase `MemorySubstrate.commit()` to accept `MemoryObject`

The substrate should validate the envelope and then validate the carried support
payload required for basin, query, replay, and trajectory functions.

The key move is:

- envelope becomes the admitted object
- carried support payload remains directly available for runtime operations

### 4. Keep retrieval truthful during the transition

The first pass should not force all consumers to read envelope-only structures.

Instead, the transition should preserve one of these lawful postures:

1. substrate stores `MemoryObject` internally but exposes carried support
   payloads through existing support-object reads, or
2. substrate exposes both admitted object and carried support through clearly
   separated accessors

The second posture is architecturally cleaner, but the first may be the
smallest safe cut if tests show high coupling.

## Preferred file order

### Primary code files

- `operators/substrate/MemorySubstrate.js`
- `runtime/DoorOneOrchestrator.js`
- `scripts/run_pipeline_substrate.js`

### Likely new helper

- a small helper under `runtime/` or `operators/substrate/`
  dedicated to `analog_signal -> MemoryObject` admission

### Tests to update or extend

- `tests/test_substrate_contracts.js`
- `tests/test_door_one_orchestrator.js`

### Docs that will need truth-sync after code lands

- `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceRuntimeChainMap.md`
- `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceRuntimeSeamLedger.md`
- `README.md`

## Proof targets for the first code pass

At minimum, the first pass should prove:

1. `H1` admission yields one lawful `MemoryObject`.
2. `M1` admission yields one lawful `MemoryObject`.
3. substrate commit rejects malformed envelopes cleanly.
4. substrate commit still preserves replay-critical support fields.
5. existing basin, query, and trajectory behavior remains lawful.
6. duplicate commit remains idempotent at the admitted-object identity level.
7. direct support-object exposure remains available somewhere truthful during
   transition.

## Failure conditions

Stop and regroup if the first pass requires all of the following at once:

- workbench restructuring
- LM packet redesign
- cross-run redesign
- reconstruction redesign
- full query contract rewrite

If that happens, the seam is too wide and the admission slice should be reduced
further.

## Explicitly out of scope for the first slice

- `json` family admission implementation
- LM packet widening
- workbench transport redesign
- cross-run evidence redesign
- reconstruction-lens redesign
- corpus/index redesign
- neighborhood-complex redesign
- generalized source-family admission framework

Those can follow only after the analog-signal admission seam is stable.

## Auxiliary tightening list

These are not first-pass blockers, but they are real follow-up items:

- update any remaining docs that still describe commit as `MemorySubstrate.commit(H1/M1)`
- decide whether retrieval should become dual-surface:
  admitted object access plus carried support access
- tighten LM staging later so it can consume bounded object refs or object cards
  rather than receipt counts alone
- harden script mirrors so CLI paths do not lag behind runtime commit law

## One-line summary

The first implementation cut should wrap current `H1` / `M1` payloads into
lawful `analog_signal` `MemoryObject` envelopes at the substrate commit seam,
while preserving direct support-object access until the wider runtime is ready
for deeper admission-surface rebasing.
