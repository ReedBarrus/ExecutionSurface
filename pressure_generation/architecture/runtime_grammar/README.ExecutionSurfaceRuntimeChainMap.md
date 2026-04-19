# ExecutionSurface Runtime Chain Map

## Status

This document exposes the smallest readable end-to-end runtime path currently
active in repo reality.

It is an operational companion surface within the runtime grammar corpus.

## Purpose

The chain map exists to show:

- where structure becomes support
- where the commit boundary is crossed
- where read-side packaging begins
- where compression seams still need tightening

## Declared path

`raw input -> DoorOneExecutiveLane -> IngestOp -> ClockAlignOp -> WindowOp -> TransformOp -> CompressOp -> AnomalyOp / SegmentTracker -> MemorySubstrate.commit(H1/M1) -> Trajectory / Basin / Query / Replay -> DoorOneOrchestrator -> CrossRun -> DoorOneWorkbench -> LM and provenance staging`

## End-to-end chain map

| Order | Seam | Mechanism stratum | Files / regions | Emitted / passed surface | Runtime role | Current marker |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `Input boundary seam` | `Pipeline coordination function` | `runtime/DoorOneExecutiveLane.js`, `operators/sampler/` | lawful raw ingest input | structural admission | `load-bearing` |
| 2 | `Executive handoff seam` | `Pipeline coordination function` | `runtime/DoorOneExecutiveLane.js` | one validated orchestration call | structural admission | `load-bearing` |
| 3a | `Ingest seam` | `Operator seam` | `operators/ingest/IngestOp.js` | `A1` | provenance root | `load-bearing` |
| 3b | `Clock alignment seam` | `Operator seam` | `operators/clock/ClockAlignOp.js` | `A2` | structural alignment | `load-bearing` |
| 3c | `Windowing seam` | `Operator seam` | `operators/window/WindowOp.js` | `W1[]` | bounded time slices | `load-bearing` |
| 3d | `Transform seam` | `Operator seam` | `operators/transform/TransformOp.js` | `S1` | full spectral geometry | `load-bearing` |
| 4a | `Support recruitment seam` | `Operator seam` | `operators/compress/CompressOp.js` | `H1` | first support recruitment | `load-bearing` |
| 4b | `Novelty evidence seam` | `Operator seam` | `operators/anomaly/AnomalyOp.js` | `An` | support comparison/evidence | `load-bearing` |
| 4c | `Segmentation bookkeeping seam` | `Pipeline coordination function` | `operators/trajectory/SegmentTracker.js` | `SegmentTransition` | support-era bookkeeping | `load-bearing` |
| 4d | `Merge seam` | `Operator seam` | `operators/merge/MergeOp.js` | `M1[]` | support compaction | `load-bearing` |
| 5 | `Substrate commit boundary` | `Substrate boundary / surface` | `operators/substrate/MemorySubstrate.js` | committed `H1` / `M1` | append-only support admission | `load-bearing` |
| 6a | `Trajectory surface seam` | `Substrate boundary / surface` | `operators/trajectory/TrajectoryBuffer.js`, `operators/substrate/MemorySubstrate.js` | `TrajectoryFrame[]` and observational dynamics | temporal support topology | `load-bearing` |
| 6b | `Basin formation seam` | `Substrate boundary / surface` | `operators/basin/BasinOp.js`, `operators/substrate/MemorySubstrate.js` | `BN` | neighborhood topology | `load-bearing` |
| 6c | `Query seam` | `Read-side function` | `operators/query/QueryOp.js`, `operators/substrate/MemorySubstrate.js` | `Q` | support retrieval | `load-bearing` |
| 6d | `Replay seam` | `Read-side function` | `operators/reconstruct/ReconstructOp.js` | `A3` | support replay | `load-bearing` |
| 7 | `Orchestrator result seam` | `Pipeline coordination function` | `runtime/DoorOneOrchestrator.js` | class-distinct runtime object assembly | bounded direct exposure | `load-bearing` |
| 8a | `Cross-run session seam` | `Pipeline coordination function` | `runtime/CrossRunSession.js` | run accumulation and admission | comparative staging | `load-bearing` |
| 8b | `Cross-run comparison seam` | `Read-side function` | `runtime/CrossRunDynamicsReport.js` | derived comparison projection | lawful compression seam | `tighten` |
| 9 | `Workbench integration seam` | `Pipeline coordination function` | `runtime/DoorOneWorkbench.js` | integrated runtime object view | bounded direct exposure | `load-bearing` |
| 10 | `LM staging seam` | `Read-side function` | `runtime/lm/WorkbenchLmWrapper.js` | bounded transport packet | lawful but too compressed | `tighten` |
| 11a | `Live provenance seam` | `Read-side function` | `scripts/run_door_one_live.js` | compact structural marker receipt | audit-only transport | `keep subordinate` |
| 11b | `Provenance digest seam` | `Read-side function` | `scripts/run_door_one_provenance_digest.js` | historical digest receipt | audit-only transport | `keep subordinate` |
| 11c | `Reconstruction support staging seam` | `Read-side function` | `runtime/reconstruction/` | support-trace staging surfaces | bounded replay support | `tighten` |

## Touchpoint markers

- first structure-to-support transition: `CompressOp -> H1`
- commit boundary: `MemorySubstrate.commit(H1/M1)`
- first direct post-commit topology surface: `TrajectoryFrame`
- main remaining compression seam: `WorkbenchLmWrapper`

## Current runtime law visible from this map

- structure remains primary through `S1`
- support begins at `H1`
- commit admits only lawful support carriers
- the substrate organizes committed support into temporal and neighborhood topology
- most active risk now lives in transport/comparison seams, not in the runtime spine

## One-line summary

The active chain map shows a runtime that is object-first through the commit
boundary and topological after commit, with the main remaining cleanup work
living in bounded read-side compression seams rather than in core execution.
