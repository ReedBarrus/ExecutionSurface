# ExecutionSurface Runtime Coherence Governor

## Status

This document classifies runtime-side transformations by coherence effect and
prevents packaging or projection from outranking upstream runtime objects.

It is an operational companion surface within the runtime grammar corpus.

## Purpose

The core question is:

**Did a runtime-side step make the output look more unified, complete, or
legible than its upstream objects actually justify?**

This governor exists to keep that from silently becoming runtime authority.

## Core invariant

No runtime-side transformation may increase apparent coherence beyond what its
declared upstream objects and relations justify.

If a step crosses that line, it may remain as optional or diagnostic material,
but it may not become primary runtime truth.

## Classification ladder

### RC0 - structure-preserving

The step preserves source geometry or coordinate-bearing structure without
changing authority class.

Examples:

- ingest
- alignment
- windowing
- transform

### RC1 - support-deriving

The step derives support from lawful upstream structure.

Examples:

- `H1` recruitment
- novelty evidence
- merge
- basin formation
- trajectory frame creation
- query/replay over committed support

### RC2 - topology-preserving packaging

The step compresses or packages lawful objects while preserving typed identity,
relation posture, and reconstructable geometry.

Examples:

- typed refs
- bounded object cards
- induced subgraph packets

### RC3 - projection-assembling

The step assembles bounded read-side projections over lawful upstream objects.

Examples:

- workbench
- cross-run comparison report
- LM staging packet
- provenance marker receipt

### RC4 - coherence-inflating

The step adds smoothness, closure, or apparent completeness not justified by
upstream objects and relations.

Examples:

- receipt-only packets treated as runtime truth
- semantic overlays becoming necessary
- transport packets that erase typed identity
- projections that imply stronger continuity than upstream support warrants

## Hard rules

### Rule 1 - RC4 may not carry primary runtime authority

`RC4` outputs may not become:

- runtime transformation authority
- runtime support authority
- substrate storage law
- commit-boundary law

### Rule 2 - RC3 must stay visibly secondary

Projection assembly is lawful only when:

- upstream object families are named
- omissions are explicit
- typed identity is preserved where relevant
- the projection can disappear without collapsing runtime truth

### Rule 3 - RC2 must preserve reconstructability

Packaging is lawful only when it keeps enough structure to reconstruct:

- what object is being packaged
- what family it belongs to
- what relations remain active
- what was omitted

### Rule 4 - receipts cannot launder coherence

Receipt repetition or convenience does not upgrade receipt authority.

## Diagnostic questions

When evaluating a seam, ask:

1. What upstream object or relation family supports this output?
2. What typed identity remains visible?
3. What geometry or relation posture was omitted?
4. Could the same task have been done with a direct object, typed ref, or bounded object card instead?
5. If this surface disappeared, would runtime truth remain intact?

If question 5 is answered with `no`, the surface is over-authoritative and
should be investigated as `RC4`.

## Default runtime posture

Default posture should remain:

- `RC0` through `RC1` on runtime-authoritative seams
- `RC2` through `RC3` on bounded read-side seams only
- `RC4` excluded from default runtime authority

## Current high-attention seams

The seams most likely to need this governor are:

- `Cross-run report seam`
- `LM wrapper extraction seam`
- `Live provenance seam`
- `Provenance digest seam`
- `Reconstruction support staging seam`

## One-line summary

The Runtime Coherence Governor now treats the main risk as over-flattening or
over-unifying lawful runtime objects, and it prevents those packaging steps
from becoming default runtime truth.
