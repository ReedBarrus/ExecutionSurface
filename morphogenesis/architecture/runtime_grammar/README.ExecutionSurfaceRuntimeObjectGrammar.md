# ExecutionSurface Runtime Object Grammar

## Status

This document defines the active object grammar for `ExecutionSurface`.

It is part of the shared runtime grammar authority.

## Purpose

This file exists to keep the runtime described in terms of its actual objects
and relations rather than convenience packets.

In particular, it prevents:

- receipts from being mistaken for runtime substance
- projections from being mistaken for source objects
- semantic overlays from being mistaken for runtime law
- packaging from outranking the objects it packages
- subordinate access layers from replacing committed object authority

## Core runtime object families

### Structural objects

Structural objects preserve source geometry and coordinate-bearing transforms.

Active structural families:

- `A1` ingest artifact
- `A2` aligned stream artifact
- `W1` window artifact
- `S1` spectral frame artifact

Structural objects may:

- preserve source lineage
- preserve clock/grid/window coordinates
- preserve full transform geometry
- carry audit receipts about the transform

Structural objects must not:

- recruit support
- cluster support
- assert memory closure
- assert semantic meaning

### Support objects

Support objects are derived mathematical/geometric objects built from lawful
upstream structure.

Active support families:

- `H1` harmonic state
- `An` anomaly report
- `SegmentTransition`
- `M1` merged state
- `BN` basin set / basin state
- `TrajectoryFrame`
- `Q` query result
- `A3` reconstructed chunk

Support objects may:

- recruit sparse support
- compare support
- compact support
- organize support neighborhoods
- record support trajectory
- retrieve or replay support under explicit non-claims

Support objects must:

- preserve derivation basis
- preserve provenance refs
- preserve policy anchors
- keep claim ceilings explicit

Support objects must not:

- silently become truth claims
- silently become canon claims
- silently become memory or identity closure

### Committed memory objects

Committed memory objects are the singular admitted substrate-boundary objects
that retain lawful support payload across continuity.

Active committed family target:

- `MemoryObject`

`MemoryObject` must:

- preserve payload kind
- preserve internal support payload refs such as `H1` / `M1`
- preserve support geometry or support-composition basis
- preserve provenance refs
- preserve temporal placement
- preserve continuity constraints
- preserve policy anchors

`MemoryObject` must not:

- replace internal support with counts alone
- become a descriptor-first summary
- assert same-object closure
- invent semantic identity

Implementation note:
current repo code still commits mixed `H1` / `M1` objects directly. `MemoryObject`
is the frozen commit-boundary target now being stabilized.

### Read-side projections

Read-side projections are bounded convenience assemblies over lawful upstream
objects.

Active read-side projection families:

- orchestrator assembled result
- workbench integration object
- cross-run comparison report
- LM staging packet
- reconstruction support staging

Read-side projections may:

- rearrange
- stage
- compare
- normalize
- compress

They must not:

- replace upstream runtime truth
- invent hidden write authority
- invent source identity
- erase object family boundaries
- replace direct support-object exposure where direct carriage is still lawful

### Receipt summaries

Receipts are subordinate audit summaries attached to seams or objects.

Active receipt families include:

- operator receipts
- runtime receipt
- workbench receipt
- provenance receipts
- benchmark receipts
- validator receipts

Receipts may summarize:

- counts
- thresholds
- policy ids
- validation outcomes
- benchmark outcomes

Receipts must not determine runtime shape.

## Relation families

The runtime is not just a bag of objects.

It is a relation-bearing topology.

### Provenance relations

Examples:

- `A2 -> A1`
- `S1 -> W1`
- `H1 -> S1`
- `M1 -> H1[]`
- `A3 -> H1 | M1`
- `Q -> consulted states`

### Temporal relations

Examples:

- ordered `TrajectoryFrame` adjacency
- segment-local frame order
- dwell runs
- recurrence and re-entry structure

### Support-composition relations

Examples:

- `H1` kept-bin membership
- `M1` merge lineage
- basin member-state relation
- basin centroid-to-member distance relation

### Neighborhood relations

Examples:

- state nearest-basin relation
- frame basin membership
- basin transition counts
- basin recurrence over time

### Read-side consult relations

Examples:

- query result ref edges
- replay source edges
- cross-run comparison pair edges

## Commit-boundary law

The substrate commit boundary is the key runtime divide.

### Pre-commit side

Pre-commit, the runtime is still transforming structure into support.

The important families here are:

- `A1`
- `A2`
- `W1`
- `S1`
- `H1`
- `An`
- `SegmentTransition`
- `M1`

### Commit gate

The substrate admits lawful support payloads into a singular committed
`MemoryObject` envelope.

Frozen admitted family target:

- `MemoryObject`

Commit law includes:

- append-only storage
- legitimacy gating
- provenance preservation
- policy-anchor preservation
- payload-kind preservation
- internal support-geometry preservation
- temporal-placement preservation
- bounded continuity constraints

Current implementation note:
the runtime still stores mixed `H1` / `M1` directly. That is now treated as an
implementation state on the way to explicit `MemoryObject` admission.

### Post-commit side

After commit, the substrate organizes and exposes support topology.

Primary post-commit families:

- admitted `MemoryObject`
- `TrajectoryFrame`
- `BN`
- substrate observational reports
- query/replay results built over safe copies

### Non-admitted families

The following are not substrate-truth carriers:

- receipts
- descriptors
- object cards
- workbench packets
- LM packets
- cross-run reports
- optional semantic overlays

## Addressability law

Objects should remain addressable by durable typed identity.

Examples:

- `stream_id`
- `segment_id`
- `state_id`
- `basin_id`
- query refs
- provenance input refs

Addressability is important because later packaging should point back to real
runtime objects rather than replace them.

## Exposure order

Above support recruitment, the default exposure order is:

1. direct object
2. typed ref
3. bounded object card
4. compact derived projection
5. subordinate receipt

For support-bearing continuity, direct `H1` / `M1` / `MemoryObject` exposure is
mandatory wherever honest carriage remains practical.

The reverse order is malformed as default runtime posture.

## Packaging rule

Packaging is lawful only when a seam cannot honestly or practically carry the
full object.

Good packaging preserves:

- typed identity
- enough geometry to remain reconstructable
- relation posture
- explicit omissions
- non-authority posture
- a pointer back to direct support or committed memory objects

Bad packaging:

- collapses objects to counts alone
- loses typed identity
- loses relation shape
- becomes the only visible runtime surface

## Root runtime law

The active runtime law established here is:

- structure remains primary through `S1`
- support recruitment begins at `H1`
- the commit boundary should bind lawful support payload into `MemoryObject`
- the substrate organizes committed support topology
- read-side projections remain secondary to object truth

## One-line summary

ExecutionSurface runtime grammar is now object-topological: structural objects
lead into support objects, the substrate commits only lawful support carriers,
relations are first-class, and packaging remains a bounded fallback rather than
the center of runtime truth.
