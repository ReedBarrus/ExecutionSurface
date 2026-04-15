# Execution Surface Architecture Basis

## Status

This file defines the current architectural basis for the trimmed
`ExecutionSurface` repo.

It is a practical operating surface.

It does not claim final V2 architecture.
It does not claim canon.
It does not claim symbolic closure.

Its job is narrower:

- define the deterministic runtime spine we are preserving
- separate core runtime from optional read-side helpers
- identify the JSON surfaces a language kernel can attach to
- make future GitHub sharing legible

## One-line summary

`ExecutionSurface` is a deterministic executive runtime over bounded structural
memory, with JSON-first runners and provenance-preserving receipts.

## Primary goal

The immediate goal of this repo is not a broad product shell.

The immediate goal is:

- run a lawful deterministic structural pipeline
- preserve provenance and bounded invariants
- commit lawful state into substrate continuity
- expose JSON receipts that a language kernel can consume without bypassing the runtime

## Core runtime spine

The structural runtime spine is:

1. `IngestOp`
2. `ClockAlignOp`
3. `WindowOp`
4. `TransformOp`
5. `CompressOp`
6. `AnomalyOp`
7. `MemorySubstrate.commit(...)`
8. bounded read-side substrate access
9. `MergeOp`
10. `ReconstructOp`
11. `QueryOp`
12. trajectory / cross-run observation

The main coordination surfaces are:

- `runtime/DoorOneOrchestrator.js`
- `runtime/DoorOneExecutiveLane.js`
- `runtime/DoorOneWorkbench.js`

## Keep set

These directories define the active architectural basis:

- `fixtures/`
- `operators/`
- `runtime/`
- `scripts/`
- `tests/`
- `test_signal/`
- `Transformer/LanguageKernel/`
- `package.json`

## Machine-facing surfaces

These are the primary entry points for attaching kernels or automation:

- `scripts/run_pipeline_substrate.js`
- `scripts/run_door_one_live.js`
- `scripts/run_door_one_workbench.js`
- `scripts/run_door_one_provenance_digest.js`

Preferred posture:

- kernels read JSON receipts and summaries
- kernels emit advisory output only
- kernels do not bypass operators or mutate substrate authority

## Read-side helpers

These remain useful, but they are downstream composition surfaces rather than
the executive substrate itself:

- `runtime/CrossRunSession.js`
- `runtime/CrossRunDynamicsReport.js`
- `runtime/TrajectoryInterpretationReport.js`
- `runtime/AttentionMemoryReport.js`

## Quarantine completed

The review / promotion / canon-adjacent surfaces have been removed from this
repo basis:

- consensus and consultation surfaces
- promotion-readiness and canon-candidate packaging
- door-two scripts
- archive / pin-packet packaging runners
- replay and probe runners that depended on the removed review stack

## Runtime authority rule

The runtime is authoritative only for:

- deterministic transformation of admitted input
- preservation of declared lineage and policy anchors
- lawful commit into substrate continuity
- truthful read-side retrieval and bounded observational summaries

The runtime is not authoritative for:

- canon
- promotion
- ontology
- truth uplift
- symbolic closure
- language-kernel verdicts

## Suggested public GitHub posture

If this repo is shared on GitHub in its current trimmed phase, its public framing
should be:

"Deterministic executive surface for provenance-first structural memory with
JSON-first runtime receipts."

That is cleaner and more honest than describing it as a full product shell or as
the whole DME architecture.
