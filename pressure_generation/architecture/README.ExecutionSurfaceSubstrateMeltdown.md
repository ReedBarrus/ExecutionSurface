# ExecutionSurface Substrate Meltdown

## Status

This document declares the architectural meltdown cut line for the new
hypergraph runtime path.

It is a documentation-only authority reset.

It does not delete code.

It does not migrate code by default.

It does not call the process reconstruction.

## Purpose

The current mixed runtime remains usable as historical or compatibility code,
but it is no longer the authority for the new runtime above the substrate line.

Future development constructs the runtime from the admitted substrate spine
instead of carrying old assumptions forward by inertia.

## Meltdown Cut Line

The meltdown cut line is drawn at the new Layer 1 / Layer 2 substrate spine.

Below the line, selected concepts may be conserved by explicit admission.

Above the line, old runtime surfaces are non-authoritative by default.

No old module, function, field, view, or transport surface survives by
inertia.

Any surviving component must be re-admitted by contract.

## Conserved Spine

The conserved spine is:

1. lawful `H1` / `M1` support payload outputs, where still valid as
   support-body inputs
2. `MemoryObject` as the commit-boundary persistence envelope
3. `temporal_axis_v1` as the Layer 1 temporal coordinate
4. `CommittedMemoryNode` as the graph-native exposure of an admitted
   `MemoryObject`
5. Layer 1 graph / hypergraph ledger:
   - committed nodes
   - declared Layer 1 edges
   - append-only ledger events
6. Layer 2 derived relation ledger:
   - `structural_similarity` now
   - later graph-native basin, dwell, recurrence, transition, drift,
     interference
7. frozen identity families:
   - amplitude / absolute energy identity
   - spectral distribution identity
   - placement-sensitive structural identity

## Melted / Non-Authoritative Surfaces

The following are melted above the substrate line for the new runtime:

- old `DoorOneOrchestrator` assumptions
- old `DoorOneWorkbench` assumptions
- old `WorkbenchLmWrapper` assumptions
- old `QueryOp` target assumptions
- old `ProvenanceReconstructionPipeline` target assumptions
- old `TrajectoryBuffer` as authority object
- old `BasinOp` as target basin architecture
- state-array-first query as target design
- any support replay path that bypasses `MemoryObject` lenses
- LM transport before Layer 3
- receipt/card/package surfaces that are not explicitly Layer 3

These may remain in the repo temporarily as reference or compatibility code.

They are not the target runtime and may not define future substrate
architecture.

## New Runtime Construction Spine

Clean runtime construction begins from:

1. admit support payload
2. mint `MemoryObject`
3. mint `temporal_axis_v1` in a real `TemporalAxisLedger`
4. mint `CommittedMemoryNode` in the Layer 1 graph / hypergraph ledger
5. admit Layer 1 edges:
   - `payload_ref`
   - `temporal_next`
   - `merge_lineage_ref`
6. derive Layer 2 `structural_similarity`
7. stop

No orchestrator, workbench, query, support replay, basin, recurrence, cards,
index, or LM transport enters the clean runtime until re-admitted by contract.

## Re-Admission Test

Every old component must pass this test before entering the new runtime:

1. What target layer does it belong to?
2. What target function does it perform?
3. Which conserved identity families does it touch?
4. What authority does it claim?
5. What old assumptions does it carry?
6. What is its clean replacement shape?
7. What tests prove it does not preserve semantic inflation?
8. What is its exit condition if transitional?

If any answer is unclear, the component remains outside the clean runtime.

## Project Placement

Default placement:

Create a clean construction lane inside the current repo rather than starting a
new repo immediately.

Candidate directory:

- `hypergraph_runtime/`

This lane must not import old orchestrator, workbench, query, support replay,
trajectory, basin, card, or LM modules by default.

A new repository is only justified if current repo topology blocks clean
construction.

## Immediate Next Move

Next move:

```text
Create the clean construction lane and build only the minimal conserved spine.
```

First runtime target:

- `TemporalAxisLedger`
- `MemoryObjectStore`
- `HypergraphLedger`
- `DerivedRelationLedger`
- minimal commit path:
  `support payload -> MemoryObject -> temporal axis -> CommittedMemoryNode -> L1 edges -> L2 structural_similarity`

## One-Line Summary

The clean hypergraph runtime starts at the admitted substrate spine, not at the
old runtime surfaces above it.
