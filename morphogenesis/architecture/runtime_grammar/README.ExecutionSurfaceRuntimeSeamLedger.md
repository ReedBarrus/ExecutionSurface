# ExecutionSurface Runtime Seam Ledger

## Status

This document defines the compact runtime seam ledger for the active
`ExecutionSurface` development front.

It is an operational companion surface within the runtime grammar corpus.

It exists to record one bounded row per active runtime seam so tightening work
can proceed without losing object-class and authority discipline.

## Classification Vocabulary

### Object Family

Allowed values:

- `Structural object`
- `Support object`
- `Receipt summary`
- `Read-side projection`
- `Semantic overlay`

### Authority Posture

Allowed values:

- `Runtime transformation authority`
- `Runtime support authority`
- `Subordinate audit only`
- `Read-side only`

### Mechanism Stratum

Allowed values:

- `Operator seam`
- `Pipeline coordination function`
- `Substrate boundary / surface`
- `Read-side function`
- `Transitional bridge`

### Seam Condition

Allowed values:

- `Sound`
- `Mixed but recoverable`
- `Structurally unsound`

### Forward Posture

Allowed values:

- `Keep`
- `Tighten`
- `Re-derive`
- `Remove`
- `Quarantine`

## Reading Rule

The ledger should be read in three passes:

1. operator and substrate seams
2. assembled read-side seams
3. transitional or removable seams

That order makes it easier to see where the runtime is already lawful versus
where packaging drift begins.

## Ledger Table

| Seam | Mechanism Stratum | Files In Scope | Emitted Objects / Surfaces | Object Family | Authority Posture | Seam Condition | Forward Posture | Notes / Non-Claims |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Input boundary seam` | `Pipeline coordination function` | `runtime/DoorOneExecutiveLane.js` | lawful raw ingest input shape | `Structural object` | `Runtime transformation authority` | `Sound` | `Keep` | narrow admission seam only |
| `Executive handoff seam` | `Pipeline coordination function` | `runtime/DoorOneExecutiveLane.js` | validated raw input into one run call | `Structural object` | `Runtime transformation authority` | `Sound` | `Keep` | no support or interpretation attached |
| `Ingest seam` | `Operator seam` | `operators/ingest/IngestOp.js`; `runtime/DoorOneOrchestrator.js` | `A1` | `Structural object` | `Runtime transformation authority` | `Sound` | `Keep` | provenance root; receipts stay subordinate |
| `Clock alignment seam` | `Operator seam` | `operators/clock/ClockAlignOp.js`; `runtime/DoorOneOrchestrator.js` | `A2` | `Structural object` | `Runtime transformation authority` | `Sound` | `Keep` | coordinate alignment only |
| `Windowing seam` | `Operator seam` | `operators/window/WindowOp.js`; `runtime/DoorOneOrchestrator.js` | `W1[]` | `Structural object` | `Runtime transformation authority` | `Sound` | `Keep` | bounded replayable slices only |
| `Transform seam` | `Operator seam` | `operators/transform/TransformOp.js`; `runtime/DoorOneOrchestrator.js` | `S1` | `Structural object` | `Runtime transformation authority` | `Sound` | `Keep` | full spectral geometry preserved through `S1` |
| `Support recruitment seam` | `Operator seam` | `operators/compress/CompressOp.js` | `H1` | `Support object` | `Runtime support authority` | `Sound` | `Keep` | first support recruitment seam; should be named as support recruitment, not interpretation |
| `Compression receipt seam` | `Operator seam` | `operators/compress/CompressOp.js` | compression receipts and gates | `Receipt summary` | `Subordinate audit only` | `Sound` | `Keep` | lawful only while subordinate to `H1` |
| `Novelty evidence seam` | `Operator seam` | `operators/anomaly/AnomalyOp.js` | `An` | `Support object` | `Runtime support authority` | `Sound` | `Keep` | bounded structural-support evidence only |
| `Segmentation bookkeeping seam` | `Pipeline coordination function` | `operators/trajectory/SegmentTracker.js` | `SegmentTransition` | `Support object` | `Runtime support authority` | `Sound` | `Keep` | support-boundary bookkeeping only |
| `Substrate commit seam` | `Substrate boundary / surface` | `operators/substrate/MemorySubstrate.js` | committed `H1` / `M1`, trajectory frame push | `Support object` | `Runtime support authority` | `Sound` | `Keep` | immutable store/index host, not receipt-only |
| `Trajectory frame seam` | `Substrate boundary / surface` | `operators/trajectory/TrajectoryBuffer.js`; `operators/substrate/MemorySubstrate.js` | `TrajectoryFrame[]`, trajectory summaries | `Support object` | `Runtime support authority` | `Sound` | `Keep` | should later surface trajectory support descriptors directly |
| `Basin formation seam` | `Substrate boundary / surface` | `operators/basin/BasinOp.js`; `operators/substrate/MemorySubstrate.js` | `BN` | `Support object` | `Runtime support authority` | `Sound` | `Keep` | basin geometry already richer than count summaries imply |
| `Query seam` | `Read-side function` | `operators/query/QueryOp.js`; `operators/substrate/MemorySubstrate.js` | `Q` | `Support object` | `Runtime support authority` | `Sound` | `Keep` | support retrieval only; should expose query support descriptor later |
| `Merge seam` | `Operator seam` | `operators/merge/MergeOp.js`; `runtime/DoorOneOrchestrator.js` | `M1[]` | `Support object` | `Runtime support authority` | `Sound` | `Keep` | support compaction only; should gain clearer descriptor exposure |
| `Replay seam` | `Read-side function` | `operators/reconstruct/ReconstructOp.js`; `runtime/DoorOneOrchestrator.js` | `A3` | `Support object` | `Runtime support authority` | `Sound` | `Keep` | replay/audit support only, not source restoration |
| `Orchestrator runtime receipt seam` | `Pipeline coordination function` | `runtime/DoorOneOrchestrator.js` | `runtime_receipt` | `Receipt summary` | `Subordinate audit only` | `Mixed but recoverable` | `Tighten` | may remain, but must not determine runtime shape |
| `Orchestrator result assembly seam` | `Pipeline coordination function` | `runtime/DoorOneOrchestrator.js` | assembled result with `artifacts`, `substrate`, `summaries`, `semantic_overlay`, `interpretation`, `audit` | `Read-side projection` | `Read-side only` | `Mixed but recoverable` | `Re-derive` | first mixed seam; should be rebuilt around structural-support descriptors |
| `Trajectory interpretation seam` | `Read-side function` | `runtime/TrajectoryInterpretationReport.js` | trajectory interpretation overlay | `Semantic overlay` | `Read-side only` | `Mixed but recoverable` | `Remove` | optional downstream overlay only, not default dependency |
| `Attention/memory interpretation seam` | `Read-side function` | `runtime/AttentionMemoryReport.js` | attention/memory interpretation overlay | `Semantic overlay` | `Read-side only` | `Mixed but recoverable` | `Remove` | optional downstream overlay only, not default dependency |
| `Cross-run session admission seam` | `Pipeline coordination function` | `runtime/CrossRunSession.js` | run admission into comparative session state | `Read-side projection` | `Read-side only` | `Mixed but recoverable` | `Re-derive` | should not require interpretive overlays for admission |
| `Cross-run report seam` | `Read-side function` | `runtime/CrossRunDynamicsReport.js` | cross-run comparison report | `Read-side projection` | `Read-side only` | `Mixed but recoverable` | `Re-derive` | should compare structural-support descriptors, not interpretive labels |
| `Workbench runtime section seam` | `Pipeline coordination function` | `runtime/DoorOneWorkbench.js` | copied runtime sections and runtime receipt | `Read-side projection` | `Read-side only` | `Mixed but recoverable` | `Tighten` | should become structural-support integration view rather than receipt-heavy convenience packet |
| `Workbench receipt seam` | `Pipeline coordination function` | `runtime/DoorOneWorkbench.js` | `workbench_receipt` | `Receipt summary` | `Subordinate audit only` | `Mixed but recoverable` | `Tighten` | lawful only while subordinate to richer workbench support views |
| `Workbench semantic overlay seam` | `Pipeline coordination function` | `runtime/DoorOneWorkbench.js` | copied semantic overlay | `Semantic overlay` | `Read-side only` | `Mixed but recoverable` | `Remove` | should not remain part of default workbench posture |
| `Workbench compatibility alias seam` | `Transitional bridge` | `runtime/DoorOneWorkbench.js` | `compatibility_aliases`, top-level `interpretation` mirror | `Semantic overlay` | `Read-side only` | `Structurally unsound` | `Remove` | transitional duplication seam; weakens provenance legibility |
| `LM wrapper extraction seam` | `Read-side function` | `runtime/lm/WorkbenchLmWrapper.js` | bounded LM input view | `Read-side projection` | `Read-side only` | `Sound` | `Tighten` | cleaner than workbench; should later ingest support descriptors instead of mostly counts |
| `LM output validation seam` | `Read-side function` | `runtime/lm/WorkbenchLmWrapper.js`; `runtime/schema/WorkbenchLmContractValidators.js` | typed LM output plus validation result | `Read-side projection` | `Read-side only` | `Sound` | `Keep` | already bounded by non-authority contract |
| `Reconstruction runtime support collection seam` | `Read-side function` | `runtime/reconstruction/ProvenanceReconstructionPipeline.js` | runtime support collection summary | `Read-side projection` | `Read-side only` | `Sound` | `Keep` | lawful when sourced from runtime objects and receipts only |
| `Reconstruction interpretive support seam` | `Read-side function` | `runtime/reconstruction/ProvenanceReconstructionPipeline.js` | interpretive support collection summary | `Semantic overlay` | `Read-side only` | `Mixed but recoverable` | `Remove` | should not remain a default support basis |
| `Probe receipt seam` | `Read-side function` | `runtime/probe/`; `schemas/`; `tests/` | probe report receipts | `Receipt summary` | `Subordinate audit only` | `Sound` | `Keep` | advisory/read-side only; should stay out of runtime authority |

## Current Ledger Reading

The ledger currently says:

- seams through replay and substrate relation are mostly sound
- operators, pipeline coordination functions, substrate boundaries, and
  read-side functions should not be collapsed into one vocabulary family
- the runtime already possesses richer support carriers than the current
  read-side packets expose
- the main correction target is not core operator math but assembled read-side
  packaging
- semantic overlay and compatibility aliasing are the clearest removable seams
- receipts are lawful only when visibly subordinate to structural or support
  carriers

## Immediate Tightening Targets

The highest-priority rows for active tightening are:

1. `Orchestrator result assembly seam`
2. `Workbench runtime section seam`
3. `Workbench compatibility alias seam`
4. `Cross-run session admission seam`
5. `Cross-run report seam`
6. `Reconstruction interpretive support seam`

These rows should be treated as the main Phase 2 correction corridor.

## Corrigibility Note

This ledger should remain open to revision.

If a seam is mis-stratified, over-grouped, or under-specified, the correct move
is to split or rename the row rather than forcing one vague row to carry too
many different mechanism kinds.

## One-Line Summary

The runtime seam ledger records which active seams are structurally sound, which
read-side bundles are mixed or unsound, and where the next tightening or
re-derivation work must occur.
