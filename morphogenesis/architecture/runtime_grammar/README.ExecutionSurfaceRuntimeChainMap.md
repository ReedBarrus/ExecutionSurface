# ExecutionSurface Runtime Chain Map

## Status

This document defines the compact active runtime chain map for
`ExecutionSurface`.

It is an operational companion surface within the runtime grammar corpus.

It does not replace executable repo reality.
It does not replace the seam ledger.

## Purpose

This map exists to expose the smallest readable end-to-end runtime path
currently active in repo reality so later tightening passes know where to enter
and where mixed seams first appear.

## Stratum Vocabulary

This map distinguishes four different kinds of runtime mechanism.

### Operator Seam

A seam whose primary transformation is performed by a declared operator class.

Examples:

- `IngestOp`
- `ClockAlignOp`
- `WindowOp`
- `TransformOp`
- `CompressOp`
- `AnomalyOp`
- `MergeOp`

### Pipeline Coordination Function

A seam whose role is to orchestrate, route, stage, assemble, or sequence lawful
upstream objects rather than to perform the core object transform itself.

Examples:

- `DoorOneExecutiveLane`
- `DoorOneOrchestrator`
- `CrossRunSession`
- `DoorOneWorkbench`

### Substrate Boundary / Surface

A seam whose role is to admit, store, index, relate, or expose committed
support objects inside the substrate domain.

Examples:

- `MemorySubstrate.commit(...)`
- trajectory storage
- basin formation over committed state

### Read-Side Function

A seam whose role is to retrieve, compare, replay, stage, validate, or render
lawful upstream objects without becoming runtime transformation authority.

Examples:

- query
- reconstruction support staging
- LM wrapper extraction
- cross-run comparison report

## Declared Path

`raw ingest input -> DoorOneExecutiveLane -> IngestOp -> ClockAlignOp -> WindowOp -> TransformOp -> CompressOp -> AnomalyOp / SegmentTracker -> MemorySubstrate.commit(...) -> BasinOp / QueryOp / MergeOp / ReconstructOp -> DoorOneOrchestrator result assembly -> CrossRun surfaces -> DoorOneWorkbench -> LM wrapper and reconstruction support staging`

## End-To-End Chain Map

| Order | Seam | Mechanism Stratum | Files / Regions | Emitted / Passed Surface | Surface Class Touch | Current Marker |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `Input boundary seam` | `Pipeline coordination function` | `runtime/DoorOneExecutiveLane.js`; `operators/sampler/` | lawful raw ingest input shape | structural admission only | `load-bearing` |
| 2 | `Executive handoff seam` | `Pipeline coordination function` | `runtime/DoorOneExecutiveLane.js` | validated raw input to one orchestration call | structural admission only | `load-bearing` |
| 3a | `Ingest seam` | `Operator seam` | `operators/ingest/IngestOp.js`; `runtime/DoorOneOrchestrator.js` | `A1` | structural only | `load-bearing` |
| 3b | `Clock alignment seam` | `Operator seam` | `operators/clock/ClockAlignOp.js`; `runtime/DoorOneOrchestrator.js` | `A2` | structural only | `load-bearing` |
| 3c | `Windowing seam` | `Operator seam` | `operators/window/WindowOp.js`; `runtime/DoorOneOrchestrator.js` | `W1[]` | structural only | `load-bearing` |
| 3d | `Transform seam` | `Operator seam` | `operators/transform/TransformOp.js`; `runtime/DoorOneOrchestrator.js` | `S1` | structural only | `load-bearing` |
| 4a | `Support recruitment seam` | `Operator seam` | `operators/compress/CompressOp.js`; `runtime/DoorOneOrchestrator.js` | `H1` plus subordinate compression receipts | support begins here | `load-bearing`; `first support seam` |
| 4b | `Novelty evidence seam` | `Operator seam` | `operators/anomaly/AnomalyOp.js`; `runtime/DoorOneOrchestrator.js` | `An` | support only | `load-bearing` |
| 4c | `Segmentation bookkeeping seam` | `Pipeline coordination function` | `operators/trajectory/SegmentTracker.js`; `runtime/DoorOneOrchestrator.js` | optional `SegmentTransition` | support only | `load-bearing` |
| 5 | `Substrate commit boundary` | `Substrate boundary / surface` | `operators/substrate/MemorySubstrate.js` | immutable `H1` / `M1` commit into substrate continuity | support host | `load-bearing` |
| 6a | `Trajectory surface seam` | `Substrate boundary / surface` | `operators/trajectory/TrajectoryBuffer.js`; `operators/substrate/MemorySubstrate.js` | trajectory frames and relation summaries | support only | `load-bearing` |
| 6b | `Basin formation seam` | `Substrate boundary / surface` | `operators/basin/BasinOp.js`; `operators/substrate/MemorySubstrate.js` | `BN` | support only | `load-bearing` |
| 6c | `Query seam` | `Read-side function` | `operators/query/QueryOp.js`; `operators/substrate/MemorySubstrate.js` | `Q` | support only | `load-bearing` |
| 6d | `Merge seam` | `Operator seam` | `operators/merge/MergeOp.js`; `runtime/DoorOneOrchestrator.js` | `M1[]` | support only | `load-bearing` |
| 6e | `Replay seam` | `Read-side function` | `operators/reconstruct/ReconstructOp.js`; `runtime/DoorOneOrchestrator.js` | `A3` | support only | `load-bearing` |
| 7 | `Result assembly seam` | `Pipeline coordination function` | `runtime/DoorOneOrchestrator.js` | assembled runtime result | structural + support + current semantic overlay | `first mixed seam` |
| 8a | `Cross-run session seam` | `Pipeline coordination function` | `runtime/CrossRunSession.js` | run accumulation and admission state | support-led, currently semantically dependent | `mixed-risk` |
| 8b | `Cross-run comparison seam` | `Read-side function` | `runtime/CrossRunDynamicsReport.js` | comparative support report over stored runs | support-led, currently semantically dependent | `mixed-risk` |
| 9 | `Workbench integration seam` | `Pipeline coordination function` | `runtime/DoorOneWorkbench.js` | integration object for runtime exposure | support integration, currently mixed with semantic duplication | `mixed-risk` |
| 10 | `LM staging seam` | `Read-side function` | `runtime/lm/WorkbenchLmWrapper.js`; `scripts/stage_workbench_lm_invocation.js` | bounded LM-facing input/output contracts | read-side projection only | `load-bearing`; `currently cleaner than workbench` |
| 11 | `Reconstruction support staging seam` | `Read-side function` | `runtime/reconstruction/` | provenance reconstruction support surfaces | support staging, currently partly interpretive | `mixed-risk` |

## Touchpoint Markers

- first structure-to-support transition: `3b`, `CompressOp -> H1`
- first support host seam: `3d`, `MemorySubstrate.commit(...)`
- first mixed seam: `5`, `DoorOneOrchestrator` result assembly
- first semantically duplicated integration seam: `7`, `DoorOneWorkbench`

## Current Best-Known Intact / Mixed Markers

- current best-known intact corridor: seams `1` through `4a`
- current best-known suspected mixed corridor: seams `5` through `9`

## Current Runtime Law Visible From This Map

- structure remains primary through `S1`
- support recruitment begins at `H1`
- operator seams should be distinguished from pipeline coordination, substrate
  boundary, and read-side function seams
- runtime core already works over richer support objects than the read-side
  receipts suggest
- flattening and semantic pressure arise mostly in assembled read-side surfaces

## Corrigibility Note

This map is intentionally revisable.

If implementation or audit shows that a seam has been mis-stratified, the map
should be updated explicitly rather than leaving a vague category in place.

## One-Line Summary

The active ExecutionSurface chain map fixes the smallest readable load-bearing
runtime path, distinguishes operators from coordination, substrate, and
read-side seams, marks the first support-recruitment seam at `H1`, and
identifies orchestrator/workbench assembly as the first mixed-risk region.
