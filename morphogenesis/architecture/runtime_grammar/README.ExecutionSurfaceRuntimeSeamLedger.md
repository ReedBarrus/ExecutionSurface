# ExecutionSurface Runtime Seam Ledger

## Status

This ledger records one bounded row per active runtime seam so tightening work
can proceed without losing object-class and authority discipline.

It reflects current runtime reality after removal of default interpretation
surfaces.

## Classification vocabulary

### Object family

- `Structural object`
- `Support object`
- `Typed ref`
- `Read-side projection`
- `Receipt summary`

### Authority posture

- `Runtime transformation authority`
- `Runtime support authority`
- `Read-side only`
- `Subordinate audit only`

### Mechanism stratum

- `Operator seam`
- `Pipeline coordination function`
- `Substrate boundary / surface`
- `Read-side function`

### Seam condition

- `Sound`
- `Compression seam`
- `Needs tightening`

## Ledger table

| Seam | Mechanism stratum | Files in scope | Default emitted surface | Object family | Authority posture | Seam condition | Forward posture | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Input boundary seam` | `Pipeline coordination function` | `runtime/DoorOneExecutiveLane.js` | lawful ingest input | `Structural object` | `Runtime transformation authority` | `Sound` | `Keep` | narrow admission only |
| `Executive handoff seam` | `Pipeline coordination function` | `runtime/DoorOneExecutiveLane.js` | validated run call | `Structural object` | `Runtime transformation authority` | `Sound` | `Keep` | no support or semantic payload |
| `Ingest seam` | `Operator seam` | `operators/ingest/IngestOp.js`, `runtime/DoorOneOrchestrator.js` | `A1` | `Structural object` | `Runtime transformation authority` | `Sound` | `Keep` | provenance root |
| `Clock alignment seam` | `Operator seam` | `operators/clock/ClockAlignOp.js`, `runtime/DoorOneOrchestrator.js` | `A2` | `Structural object` | `Runtime transformation authority` | `Sound` | `Keep` | alignment only |
| `Windowing seam` | `Operator seam` | `operators/window/WindowOp.js`, `runtime/DoorOneOrchestrator.js` | `W1[]` | `Structural object` | `Runtime transformation authority` | `Sound` | `Keep` | replayable slices |
| `Transform seam` | `Operator seam` | `operators/transform/TransformOp.js`, `runtime/DoorOneOrchestrator.js` | `S1` | `Structural object` | `Runtime transformation authority` | `Sound` | `Keep` | full structural geometry preserved |
| `Support recruitment seam` | `Operator seam` | `operators/compress/CompressOp.js` | `H1` | `Support object` | `Runtime support authority` | `Sound` | `Keep` | first support recruitment |
| `Novelty evidence seam` | `Operator seam` | `operators/anomaly/AnomalyOp.js` | `An` | `Support object` | `Runtime support authority` | `Sound` | `Keep` | support evidence only |
| `Segmentation bookkeeping seam` | `Pipeline coordination function` | `operators/trajectory/SegmentTracker.js` | `SegmentTransition` | `Support object` | `Runtime support authority` | `Sound` | `Keep` | support-boundary bookkeeping |
| `Merge seam` | `Operator seam` | `operators/merge/MergeOp.js`, `runtime/DoorOneOrchestrator.js` | `M1[]` | `Support object` | `Runtime support authority` | `Sound` | `Keep` | support compaction only |
| `Replay seam` | `Read-side function` | `operators/reconstruct/ReconstructOp.js`, `runtime/DoorOneOrchestrator.js` | `A3` | `Support object` | `Runtime support authority` | `Sound` | `Keep` | replay support only |
| `Query seam` | `Read-side function` | `operators/query/QueryOp.js`, `operators/substrate/MemorySubstrate.js` | `Q` | `Support object` | `Runtime support authority` | `Sound` | `Keep` | support retrieval only |
| `Substrate commit seam` | `Substrate boundary / surface` | `operators/substrate/MemorySubstrate.js` | committed `H1` / `M1`, trajectory frames, basin rebuild inputs | `Support object` | `Runtime support authority` | `Sound` | `Keep` | object-bearing host, not receipt-led |
| `Substrate retrieval seam` | `Substrate boundary / surface` | `operators/substrate/MemorySubstrate.js` | safe copies via `allStates()`, `statesForSegment()`, `getTrajectory()`, `queryStates()` | `Support object` | `Runtime support authority` | `Sound` | `Keep` | already object-first |
| `Orchestrator result seam` | `Pipeline coordination function` | `runtime/DoorOneOrchestrator.js` | `artifacts`, `substrate`, `summaries`, `audit`, subordinate `runtime_receipt` | `Read-side projection` | `Read-side only` | `Sound` | `Keep` | class-distinct direct sections already live |
| `Workbench integration seam` | `Pipeline coordination function` | `runtime/DoorOneWorkbench.js` | runtime operator/function/substrate sections, subordinate `workbench_receipt` | `Read-side projection` | `Read-side only` | `Sound` | `Keep tightening` | direct sections are live; receipt stays subordinate |
| `Cross-run session admission seam` | `Pipeline coordination function` | `runtime/CrossRunSession.js` | admission on structural/support basis | `Read-side projection` | `Read-side only` | `Sound` | `Keep` | no interpretation dependency |
| `Cross-run report seam` | `Read-side function` | `runtime/CrossRunDynamicsReport.js` | bounded comparison report derived from direct objects | `Read-side projection` | `Read-side only` | `Compression seam` | `Tighten` | lawful comparison seam; keep explicitly derived |
| `LM wrapper extraction seam` | `Read-side function` | `runtime/lm/WorkbenchLmWrapper.js` | bounded LM transport packet | `Read-side projection` | `Read-side only` | `Needs tightening` | `Retune` | still too receipt-heavy |
| `LM output validation seam` | `Read-side function` | `runtime/lm/WorkbenchLmWrapper.js`, `runtime/schema/WorkbenchLmContractValidators.js` | typed LM output plus validation result | `Read-side projection` | `Read-side only` | `Sound` | `Keep` | bounded by non-authority contract |
| `Reconstruction support collection seam` | `Read-side function` | `runtime/reconstruction/ProvenanceReconstructionPipeline.js` | structural/support collection over runtime outputs | `Read-side projection` | `Read-side only` | `Compression seam` | `Tighten` | keep direct sourcing explicit |
| `Live provenance seam` | `Read-side function` | `scripts/run_door_one_live.js` | compact structural marker receipt | `Receipt summary` | `Subordinate audit only` | `Compression seam` | `Keep subordinate` | durable audit only |
| `Provenance digest seam` | `Read-side function` | `scripts/run_door_one_provenance_digest.js` | compact historical digest | `Receipt summary` | `Subordinate audit only` | `Compression seam` | `Keep subordinate` | historical audit only |
| `Probe receipt seam` | `Read-side function` | `runtime/probe/`, `schemas/`, `tests/` | advisory probe receipts | `Receipt summary` | `Subordinate audit only` | `Sound` | `Keep bounded` | must not harden semantic drift |

## Current reading

The ledger now says:

- operator and substrate seams are already object-first
- orchestrator and workbench are no longer the main semantic problem seams
- the remaining risk sits in lawful compression seams, not runtime transformation seams
- LM staging is the main place where object truth is still being flattened too early
- provenance and digest receipts are acceptable only as explicitly subordinate audit surfaces

## Immediate tightening targets

1. `LM wrapper extraction seam`
2. `Cross-run report seam`
3. `Reconstruction support collection seam`
4. `Live provenance seam`
5. `Provenance digest seam`

## One-line summary

The active runtime seam ledger now treats the runtime spine and substrate as
object-first, while locating the remaining cleanup work in bounded read-side
compression seams rather than in the core execution chain.
