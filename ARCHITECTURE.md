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

## Active development front

`ExecutionSurface` is now the active use-oriented foundation for real DME v2 development.

This repo is the current development front for:

- deterministic executive runtime work
- JSON-facing receipt design
- bounded language-kernel attachment
- benchmark and audit harness development
- workflow and morphogenesis process support built on top of the executive substrate

This repo is not a sidecar to a separate “real” runtime anymore.

For current development purposes, this is the active home of DME v2 runtime-facing work.

That does **not** mean every future DME layer is already active here.

It means current DME v2 development should be grounded in this repo’s executable reality first, then widened lawfully from there.
## Runtime / commit spine

The runtime / commit spine is the authority-bearing execution path that transforms admitted input and lawfully commits bounded state into substrate continuity.

Current runtime / commit spine:

1. `IngestOp`
2. `ClockAlignOp`
3. `WindowOp`
4. `TransformOp`
5. `CompressOp`
6. `AnomalyOp`
7. `MemorySubstrate.commit(...)`

This spine is the narrowest authority-bearing execution chain in the repo.

Its job is to:

- transform admitted input deterministically
- preserve declared policy anchors
- preserve provenance and receipt integrity
- commit lawful bounded state into substrate continuity

It does not by itself settle:

- canon
- truth uplift
- symbolic closure
- unconstrained agentic behavior
- language-layer judgment

## Read-side / observation band

Everything downstream of commit that exposes, compares, reconstructs, summarizes, stages, or benchmarks runtime-visible state belongs to the read-side / observation band.

Current read-side / observation band includes:

1. bounded read-side substrate access
2. `MergeOp`
3. `ReconstructOp`
4. `QueryOp`
5. trajectory and cross-run observation
6. `runtime/DoorOneWorkbench.js`
7. LM wrapper / staged invocation surfaces
8. benchmark and validation surfaces
9. workflow and morphogenesis process-support surfaces built on bounded receipts

These surfaces are useful and often essential, but they are not the same thing as runtime / commit authority.

They must not silently promote themselves into:

- substrate authority
- canon authority
- truth authority
- symbolic closure
- unrestricted runtime mutation

## Coordination surfaces

The main coordination surfaces are:

- `runtime/DoorOneOrchestrator.js`
- `runtime/DoorOneExecutiveLane.js`
- `runtime/DoorOneWorkbench.js`

These surfaces coordinate runtime execution and read-side exposure, but they do not erase the distinction between the runtime / commit spine and the downstream read-side / observation band.

## Active repository bands

The active repository bands are:

### Runtime / commit implementation
- `operators/`
- `runtime/`
- `fixtures/`
- `test_signal/`

### Read-side / control surfaces
- `schemas/`
- `scripts/`
- `tests/`
- `Transformer/LanguageKernel/`

### Repo-level orientation surfaces
- `README.md`
- `ARCHITECTURE.md`

## Machine-facing attachment surfaces

These are the primary machine-facing entry points for kernels, wrappers, benchmarks, and later governed process surfaces:

- `scripts/run_pipeline_substrate.js`
- `scripts/run_door_one_live.js`
- `scripts/run_door_one_workbench.js`
- `scripts/run_door_one_provenance_digest.js`

Preferred posture:

- kernels read bounded JSON receipts and summaries
- kernels emit advisory or separately gated outputs only
- kernels do not bypass operators or mutate substrate authority
- process-support surfaces ride on explicit receipts, not prose improvisation

## Read-side helper posture

The following remain downstream helper or observation surfaces rather than runtime / commit authority:

- `runtime/CrossRunSession.js`
- `runtime/CrossRunDynamicsReport.js`
- `runtime/TrajectoryInterpretationReport.js`
- `runtime/AttentionMemoryReport.js`

They may support:

- replay understanding
- bounded reconstruction
- comparison
- runtime observation
- downstream kernel attachment

They do not by themselves become canon, truth, or runtime authority.

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
