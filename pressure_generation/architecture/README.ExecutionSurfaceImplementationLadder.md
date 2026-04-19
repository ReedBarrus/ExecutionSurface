# ExecutionSurface Implementation Ladder

## Status

This document is the live implementation ladder for the current
`ExecutionSurface` front.

It does not replace the runtime grammar corpus or the architecture seed.

Its job is to translate stabilized architectural subjects into bounded proof and
mechanization steps.

## Reading posture

Read this ladder together with:

- `pressure_generation/architecture/README.ExecutionSurfaceArchitectureSeed.md`
- `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceRuntimeGrammarCorpus.md`
- `pressure_generation/workflow/README.ExecutionSurfaceSubjectRegistry.md`

Historical workflow material under `pressure_generation/archive/` is non-authoritative
background only.

## Core rule

Implementation must not outrun the stabilized architectural object it depends
on.

Architecture names the substrate and boundary law first.

The ladder then proves those laws through bounded objects, validators, code
changes, and tests.

## Proof-object sequence

Before larger implementation churn, every serious pass should be able to name
one of these proof objects cleanly:

1. `Topology detection object`
2. `Identity object`
3. `Decision object`
4. `Evaluation object`
5. `Memory record or archive entry`

These do not yet require a full workflow engine.

They define the proof grammar that later workflow reseeding should mechanize.

## Ladder

### Rung 0 - Runtime topology detection

**Depends on subjects:**
- `Runtime Grammar Corpus`
- `Substrate Topology`

**Implementation target:**
- detect the implemented or implementable object chain for an active family
- record what relations are conserved and what relations are lost across a seam

**Expected proof object:**
- `Topology detection object`

**Minimum fields:**
- source artifact
- active seam
- input object family
- output object family
- transformation
- conserved relations
- lost or omitted relations
- authority ceiling
- verification handle
- unknowns

**Proof target:**
- the active chain is inspectable enough that later architectural claims are
  tied to real topology rather than prose convenience

### Rung 1 - Architectural identity against detected topology

**Depends on subjects:**
- `Topology Detection Object`
- `Source-Family Admission Basis`

**Implementation target:**
- define what topology the current contract, doc, or code move is trying to
  protect

**Expected proof object:**
- `Identity object`

**Proof target:**
- every major move can say what object chain and relation posture it is
  conserving

### Rung 2 - Decision discipline

**Depends on subjects:**
- `Source-Family Admission Basis`
- `MemoryObject Envelope`

**Implementation target:**
- choose whether the next move is:
  - implementation
  - documentation
  - contract
  - validator
  - cleanup

**Expected proof object:**
- `Decision object`

**Proof target:**
- the repo does not widen into unrelated layers or move code before the target
  object law is explicit

### Rung 3 - Evaluation against topology

**Depends on subjects:**
- `Topology Detection Object`
- `Comparison Basis Law`
- `Reconstruction Lens Law`

**Implementation target:**
- audit whether the proposed move preserves the detected topology or flattens it

**Expected proof object:**
- `Evaluation object`

**Proof target:**
- evaluation can name conserved relations, lost relations, and authority
  ceilings explicitly

### Rung 4 - Historical retention or archive

**Depends on subjects:**
- `Workflow Reseed` later
- current doc-only discipline for now

**Implementation target:**
- retain the result as a live memory-bearing surface or archive it as history

**Expected proof object:**
- `Memory record` or `archive entry`

**Proof target:**
- historical process material stays readable without remaining active authority

### Rung 5 - `MemoryObject` contract surface

**Depends on subjects:**
- `MemoryObject Envelope`
- `Source-Family Admission Basis`

**Implementation target:**
- schema or type surface for `MemoryObject`
- fail-closed validation for required and conditional fields

**Expected outputs:**
- `MemoryObject` schema or type
- validator path
- malformed-admission rejection tests

**Proof target:**
- admission binding preserves payload kind, refs, continuity constraints, and
  non-claims without collapsing into summary surfaces

### Rung 6 - `analog_signal` admission adapter

**Depends on subjects:**
- `Source-Family Admission Basis`
- `MemoryObject Envelope`

**Implementation target:**
- define how current `H1` / `M1` runtime payloads are bound into
  `MemoryObject`

**Expected outputs:**
- family contract surface for `analog_signal`
- adapter or helper path
- tests proving support geometry and lineage are conserved

**Proof target:**
- current signal support can be admitted without flattening direct support
  objects

### Rung 7 - `json` admission adapter

**Depends on subjects:**
- `Source-Family Admission Basis`
- `MemoryObject Envelope`

**Implementation target:**
- define parsed-tree or schema-shape payload admission for `json`

**Expected outputs:**
- family contract surface for `json`
- adapter or helper path
- tests proving non-temporal families can still be placed into continuity

**Proof target:**
- the substrate is shown to be temporally continuous rather than
  source-family-specific

### Rung 8 - Substrate commit rebase

**Depends on subjects:**
- `MemoryObject Envelope`
- `Substrate Topology`

**Implementation target:**
- move the commit boundary from direct mixed `H1` / `M1` storage toward explicit
  `MemoryObject` admission

**Expected outputs:**
- commit path updates
- retrieval updates
- continuity-preservation tests

**Proof target:**
- admitted objects become singular and addressable without losing payload-native
  dimensionality

### Rung 9 - Comparison basis surfaces

**Depends on subjects:**
- `Comparison Basis Law`

**Implementation target:**
- family-aware comparison-basis surfaces for admitted objects

**Expected outputs:**
- comparison-basis contracts
- basis validators
- same-input stability tests

**Proof target:**
- comparison remains substrate-supported and non-identitarian

### Rung 10 - Reconstruction lens surfaces

**Depends on subjects:**
- `Reconstruction Lens Law`

**Implementation target:**
- source-family-aware reconstruction lenses over admitted objects

**Expected outputs:**
- reconstruction-lens contracts
- replay or reconstruction helpers
- source-versus-reconstruction distinction tests

**Proof target:**
- reconstruction remains lens-bound and does not claim raw restoration

### Rung 11 - Corpus / index access surfaces

**Depends on subjects:**
- `Corpus / Index Access Law`

**Implementation target:**
- typed addressability and retrieval over admitted objects

**Expected outputs:**
- index or access contracts
- retrieval helpers
- tests proving access remains subordinate to lower-layer truth

**Proof target:**
- addressability becomes practical without corpus-only collapse

## Testing posture

Every rung should prefer:

- direct object checks before receipt checks
- relation conservation checks before count summaries
- fail-closed validators
- narrow fixture-based proofs

Avoid treating:

- receipts as object evidence
- indexes as ontology
- projections as proof of runtime shape

## One-line summary

The live implementation ladder now starts from topology detection and
`MemoryObject` admission, then steps through source-family adapters, substrate
commit rebasing, comparison, reconstruction, and access law without reviving the
older retained-object or receipt-era implementation grammar.
