# Execution Surface Architecture Basis

## Status

This file defines the current architectural basis for `ExecutionSurface`.

It is an operating document, not canon.

Its job is to keep the repo anchored to executable runtime reality while we
tighten the surrounding read-side and workflow surfaces.

## One-line summary

`ExecutionSurface` is a deterministic executive runtime over bounded structural
and support objects, with JSON serving as transport and audit surface rather
than the source of runtime truth.

## Primary goal

The immediate goal is:

- preserve a lawful deterministic runtime spine
- keep structural and support objects directly exposed wherever possible
- keep provenance explicit
- keep JSON outputs small, typed, and diffable without letting them replace the objects

## Core stance

Object-first posture:

- direct structural/support object exposure is the default
- direct `H1` / `M1` / `MemoryObject` exposure is mandatory where honest carriage remains practical
- typed refs are the next fallback when full drag-forward is too coupled
- bounded packaging is the last fallback when direct objects or refs are not viable
- receipts are subordinate audit surfaces only

Convenience surfaces must not determine runtime shape.

Descriptors, object cards, projections, receipts, and corpus/index views are
fallback or access surfaces, not runtime replacements.

## Runtime / commit spine

The authority-bearing execution path is:

1. `IngestOp`
2. `ClockAlignOp`
3. `WindowOp`
4. `TransformOp`
5. `CompressOp`
6. `AnomalyOp`
7. `MemorySubstrate.commit(...)`

This path is authoritative only for:

- deterministic transformation of admitted input
- support recruitment and novelty fencing under policy
- preservation of lineage and policy anchors
- lawful commit into substrate continuity

Projected commit target:

- a singular `MemoryObject` envelope binds lawful support payload into retained continuity
- internal support payload such as `H1` / `M1` remains preserved rather than flattened

## Read-side band

Everything downstream of commit belongs to the read-side band.

That includes:

- substrate retrieval
- `MergeOp`
- `ReconstructOp`
- `QueryOp`
- cross-run comparison
- workbench assembly
- LM staging
- provenance digests
- benchmark and validation surfaces

These surfaces may inspect, compare, stage, or summarize runtime-visible state.

They do not become runtime authority merely by being useful.

## Direct exposure rule by seam

### Runtime and substrate seams

Prefer direct object carriage.

Examples:

- orchestrator artifacts
- committed substrate state
- segment transitions
- basin sets
- query artifacts
- replay artifacts

### Read-side seams

Prefer direct objects first, then typed refs, then bounded packaging.

Examples:

- workbench should expose operator/function/substrate sections directly
- cross-run should compare direct structural/support evidence before summary labels
- LM staging should eventually stage bounded object cards or typed refs, not receipt-only packets

### Audit seams

Receipts, validators, and benchmark artifacts are lawful only as subordinate
audit surfaces.

They must never stand in for runtime shape.

## Current legitimate compression seams

Compression beyond direct object exposure may still be lawful when:

1. a surface would otherwise drag forward too much coupled substrate detail
2. a consumer only needs typed evidence slices, not full object bodies
3. a comparison seam needs normalized vectors or distances to remain diffable
4. a transport seam needs a bounded packet to stay practical

When that happens, the preferred order is:

1. typed ref
2. bounded object card
3. compact derived projection
4. subordinate receipt

## Current repo reality

The active runtime is already closer to the target posture than the older docs
claimed:

- orchestrator exposes direct artifact families
- workbench exposes operator/function/substrate sections directly
- semantic overlays and compatibility aliases are removed from default runtime
- substrate commit and retrieval already operate on direct objects

The main remaining compression-heavy seams are:

- `runtime/lm/WorkbenchLmWrapper.js`
- `runtime/CrossRunDynamicsReport.js`
- `scripts/run_door_one_live.js`
- `scripts/run_door_one_provenance_digest.js`

Those are legitimate read-side compression seams, but they should be treated as
fallback transport or comparison layers, not truth carriers.

## Machine-facing posture

JSON remains important, but its role is narrower:

- transport
- audit
- validation
- staging
- bounded interchange

JSON is not the runtime substance.

Nor are descriptors, index entries, or receipts.

## Testing posture

The testing program should now prove:

- direct object exposure remains intact
- read-side packaging stays subordinate
- semantic overlay does not re-enter runtime dependency
- compression seams remain truthful and removable

## One-line summary

ExecutionSurface should expose direct structural and support objects by default,
fall back to typed refs or bounded packaging only when necessary, and keep
receipts as subordinate audit surfaces rather than runtime truth.
