# ExecutionSurface Substrate Topology

## 1. Status

This document freezes the projected substrate topology for `ExecutionSurface`.

It is an authority-facing runtime grammar surface.

It does not claim that every detail is already implemented in code.

It defines the substrate shape we are now stabilizing toward.

## 2. Core substrate thesis

`ExecutionSurface` is a direct-object-first substrate where lawful
structural/support objects are admitted into a temporal support graph /
hypergraph through conservative `MemoryObject` envelopes, organized by basin /
neighborhood overlays, and accessed through a subordinate corpus / index layer
without allowing projections, descriptors, receipts, or semantic overlays to
replace runtime object authority.

The substrate is not merely a graph database.

It is an attributed temporal support graph with hyperedge-compatible relation
families and neighborhood overlays.

## 3. Layer 1 - Temporal Support Graph / Hypergraph

Layer 1 is the primary substrate authority layer.

It hosts admitted `MemoryObject` envelopes and the direct relations needed to
preserve retained continuity.

Primary relation families at this layer include:

- provenance edges
- temporal adjacency edges
- support-composition edges
- merge-lineage edges
- commit-time policy anchors
- continuity constraints
- hyperedge-compatible multi-object relations where pairwise edges are too weak

Layer 1 is where retained runtime truth lives.

If a later layer disagrees with Layer 1, Layer 1 wins.

## 4. Layer 2 - Neighborhood / Basin Complex

Layer 2 is a derived organization layer over Layer 1.

It groups admitted memory objects into neighborhoods, basins, recurrence zones,
and transition structures.

Layer 2 may expose:

- neighborhood membership
- nearest-neighbor posture
- basin transitions
- dwell and recurrence structure
- local comparison neighborhoods

Layer 2 is substrate-supported but subordinate to Layer 1.

It organizes retained continuity.

It does not replace it.

## 5. Layer 3 - Corpus / Index Access Layer

Layer 3 is a subordinate access and management layer.

It exists to make substrate objects and relations addressable, retrievable, and
projectable without flattening them into runtime truth.

Layer 3 may carry:

- typed addresses
- lookup indexes
- retrieval scopes
- bounded access views
- routing and management support

Layer 3 is practical infrastructure.

It is not substrate ontology.

Indexing and corpus views must not masquerade as runtime authority.

## 6. Admission Boundary

The admission boundary is the commit gate into retained continuity.

Its function is to accept lawful support payloads into a singular
`MemoryObject` envelope while preserving:

- payload kind
- internal support geometry
- provenance refs
- temporal placement
- continuity constraints
- policy anchors

Admission does not flatten support objects into descriptors, counts, or
receipts.

Admission is conservative binding, not semantic interpretation.

Implementation note:
current repo code still commits mixed `H1` / `M1` objects directly. The active
topology target is to make that commit boundary explicit through one admitted
`MemoryObject` envelope that retains those internal support payloads lawfully.

## 7. MemoryObject Envelope

`MemoryObject` is the singular admitted boundary object for retained
continuity.

It is not a descriptor, receipt, object card, or semantic wrapper.

It is a conservative envelope over lawful support payload.

### Minimum retained dimensions

A lawful `MemoryObject` should preserve at least:

- `memory_object_id`
- payload kind
- internal support payload refs such as `H1` / `M1`
- support geometry or support-composition basis
- provenance refs
- temporal placement
- segment / stream placement
- continuity constraints
- uncertainty posture
- policy anchors

### Envelope posture

The envelope exists to:

- make the commit boundary singular and addressable
- preserve internal dimensionality
- keep support payload reconstructable
- support later neighborhood, comparison, and reconstruction functions

The envelope does not exist to:

- collapse payload into scalar counts
- replace internal support with a summary view
- assert same-object closure
- invent semantics

### Internal dimensionality rule

`MemoryObject` may bind `H1`, `M1`, or a mixed support payload surface, but it
must preserve payload kind and internal support-bearing relations explicitly.

The envelope must remain thinner than the payload it carries.

## 8. Intrinsic substrate functions

These functions belong to the substrate stack itself:

- admission
- persistence
- provenance linkage
- temporal placement
- support composition retention
- continuity constraints
- neighborhood organization
- recurrence support
- comparison support
- reconstruction support
- addressability
- retrieval

These functions are defined in more detail in
`README.ExecutionSurfaceSubstrateFunctionLedger.md`.

## 9. Over-substrate functions

These functions operate over the substrate but do not define substrate truth:

- query projection
- reconstruction emission
- comparative reports
- workbench integration
- LM staging
- human-facing planar projection
- benchmark and validator receipts

These functions may consult substrate truth.

They must not replace it.

## 10. Direct exposure and projection rules

### Direct object exposure rule

Direct support-object exposure is mandatory.

Descriptors, object cards, projections, and receipts are fallback or read-side
views, not replacements for `H1`, `M1`, or `MemoryObject`.

### Projection rule

If a seam cannot honestly carry the full object, it should prefer:

1. typed ref
2. bounded object card
3. compact derived projection
4. subordinate receipt

The reverse order is malformed as default posture.

### Comparison and reconstruction rule

Comparison and reconstruction should be substrate-supported but not necessarily
substrate-authoritative truth operations.

They remain bounded downstream functions operating over retained substrate
relations.

### Receipt and index rule

Receipts and index entries must never masquerade as runtime truth, substrate
truth, or commit-boundary substance.

They are convenience, access, validation, or audit surfaces only.

## 11. Non-claims

This topology does not claim:

- that query is truth
- that the substrate is ontology
- that replay is raw restoration
- that promotion is identical to retention
- that `MemoryObject` implies same-object closure
- that comparison output is canon
- that corpus/index access is primary substrate authority
- that descriptors or receipts may replace direct support objects

## One-line summary

ExecutionSurface is best stabilized as a three-layer direct-object substrate in
which `MemoryObject` envelopes bind lawful support payload into a temporal
support graph / hypergraph, neighborhood structure organizes retained
continuity, and corpus/index access remains subordinate to lower-layer truth.
