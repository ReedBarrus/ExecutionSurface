# ExecutionSurface Architecture Seed

## Status

This document is the live architecture seed for the current `ExecutionSurface`
front.

It is a trunk surface.

It is not the full runtime grammar corpus and it is not a full implementation
contract.

Its job is to keep the architecture front aligned to the runtime grammar corpus
without drifting back into older retained-object, descriptor-first, or
receipt-first framing.

Historical morphogenesis process material now lives under:

- `morphogenesis/archive/`

That archive is non-authoritative.

## Authority chain

This seed should be read together with:

- `morphogenesis/architecture/runtime_grammar/README.ExecutionSurfaceRuntimeGrammarCorpus.md`
- `morphogenesis/architecture/runtime_grammar/README.ExecutionSurfaceRuntimeObjectGrammar.md`
- `morphogenesis/architecture/runtime_grammar/README.ExecutionSurfaceRuntimeEmissionAuthorityGrammar.md`
- `morphogenesis/architecture/runtime_grammar/README.ExecutionSurfaceMemoryObjectEnvelope.md`
- `morphogenesis/architecture/runtime_grammar/README.ExecutionSurfaceSubstrateTopology.md`
- `morphogenesis/architecture/runtime_grammar/README.ExecutionSurfaceSubstrateFunctionLedger.md`

When this seed is broader than the runtime grammar corpus, the runtime grammar
corpus wins.

## Purpose

`ExecutionSurface` is being stabilized as a direct-object-first memory
substrate.

The project is not currently trying to be:

- a general agent runtime
- a symbolic ontology
- a truth engine
- a canon layer
- a workflow bureaucracy

The immediate architectural goal is narrower:

stabilize the substrate, its commit-boundary object, its function hierarchy, and
the first lawful source-family admission basis so later comparison,
reconstruction, retrieval, and projection can operate without semantic drift or
receipt substitution.

## Core thesis

`ExecutionSurface` should be treated as a direct-object-first substrate where
lawful structural and support payloads are admitted into a temporal support
graph / hypergraph through conservative `MemoryObject` envelopes, organized by
neighborhood and basin overlays, and accessed through a subordinate corpus /
index layer without allowing descriptors, receipts, or access views to replace
runtime object authority.

The substrate is temporally continuous, not source-family-specific.

Static and non-temporal families may still be admitted once they are placed into
provenance-bearing, relation-bearing continuity.

## Architectural trunk

The current trunk has seven load-bearing elements.

### 1. Source-family adapters

Different source families may enter through different formation paths.

Early target families are:

- `analog_signal`
- `json`

Later families may include:

- `text`
- `table`
- `code`
- `image`
- `embedding`

The substrate should stay uniform without pretending every source family is an
audio signal.

### 2. Lawful payload formation

Each source family must form a lawful payload before admission.

Examples:

- `analog_signal` -> `H1` / `M1` support-bearing payload
- `json` -> parsed-tree or schema-shape support-bearing payload

The substrate should admit lawful payload, not raw narrative summary.

### 3. `MemoryObject` admission boundary

The substrate commit boundary should be singular and addressable.

`MemoryObject` is now the projected admission envelope.

Its three jobs are:

1. admission binding
2. dimensional conservation
3. relation exposure

`MemoryObject` must remain thinner than the payload it carries.

### 4. Layer 1 substrate truth

Layer 1 is the temporal support graph / hypergraph.

This is the primary substrate authority layer.

It hosts admitted `MemoryObject` envelopes and the direct relations needed to
preserve retained continuity.

### 5. Layer 2 derived organization

Layer 2 is the neighborhood / basin complex over retained objects.

It supports locality, recurrence, transition structure, and neighborhood-aware
comparison without replacing Layer 1 truth.

### 6. Layer 3 access and management

Layer 3 is the corpus / index access layer.

It provides addressability, retrieval, and management support.

It must remain subordinate to Layer 1 and Layer 2.

### 7. Over-substrate functions

The substrate should support but not collapse into:

- comparison
- reconstruction
- query projection
- workbench integration
- LM staging
- human-facing projection

These are real functions.

They are not the substrate's primary ontology.

## Active invariants

The following remain active across this seed:

1. Direct support-object exposure is mandatory wherever honest carriage remains
   practical.
2. `MemoryObject` is an admission envelope, not a summary surface.
3. Receipts, descriptors, object cards, and corpus/index views are subordinate
   or access-only surfaces.
4. Comparison is first-class, but comparison output is not object identity.
5. Reconstruction is lens-bound re-entry, not raw restoration.
6. Persistence does not grant same-object closure.
7. The substrate is not ontology.
8. Semantic overlay is outside default runtime authority.

## Current architectural front

The current active architectural front is no longer descriptor-family design.

It is:

- source-family admission basis
- commit-boundary object law
- relation-bearing substrate organization
- truthful access and projection posture

This means the next work should focus on:

- what topology is actually present or implementable
- how source families form lawful payload
- how those payloads are admitted through `MemoryObject`
- how comparison and reconstruction attach to retained bases without becoming
  truth closure

## Seeded next subjects

The following subjects should unfold from this seed.

### 1. Source-Family Admission Basis

Define how early source families form lawful payload for admission.

Early focus:

- `analog_signal`
- `json`

### 2. Topology Detection Object

Define the minimal object that records the implemented or implementable runtime
topology before larger architectural moves are made.

### 3. Comparison Basis Law

Define how comparison remains substrate-supported across source families without
becoming truth closure or object identity.

### 4. Reconstruction Lens Law

Define how reconstruction remains declared, bounded, and source-family-aware.

### 5. Corpus / Index Access Law

Define how access and retrieval remain useful without becoming runtime truth.

### 6. Human-Facing Projection Law

Define how future visual and textual projections stay reconstructable and
non-authoritative.

### 7. Workflow Reseed

Only after the architecture front is stable, reseed the workflow around:

- topology detection
- architectural identity
- decision
- evaluation
- memory or archive retention

## Non-goals

This seed does not yet define:

- full source-family adapter contracts
- final comparison schemas
- final reconstruction schemas
- final corpus/index implementation
- final workflow law
- agent write/read law
- multi-agent exchange law

Those remain later work.

## One-line summary

`ExecutionSurface` is being stabilized as a direct-object-first substrate whose
uniform admission boundary is `MemoryObject`, whose truth lives in a layered
temporal support topology, and whose next architectural work is source-family
admission plus topology-aware comparison, reconstruction, and access law.
