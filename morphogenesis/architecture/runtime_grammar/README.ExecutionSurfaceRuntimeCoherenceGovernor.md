# ExecutionSurface Runtime Coherence Governor

## Status

This document is an operational companion surface within the active runtime
grammar corpus for `ExecutionSurface`.

It does not replace:

- `README.ExecutionSurfaceRuntimeObjectGrammar.md`
- `README.ExecutionSurfaceRuntimeEmissionAuthorityGrammar.md`
- `README.ExecutionSurfaceRuntimeSeamLedger.md`

Its role is narrower:

- classify runtime-side transformations by coherence effect
- prevent coherence inflation from silently becoming runtime authority
- keep lawful descriptor compression distinct from semantic smoothing

---

## Purpose

ExecutionSurface already distinguishes:

- structural objects
- support objects
- receipt summaries
- read-side projections
- optional semantic overlays

What was still missing was a compact enforcement grammar for this question:

**Did a runtime-side transformation increase apparent coherence beyond what its
upstream structural or support grounding can justify?**

This file exists to answer that question without widening runtime doctrine into
semantic policy or subjective style judgment.

---

## Core Invariant

No runtime-side transformation may increase apparent coherence beyond what is
structurally or support-wise justified by its declared upstream objects.

If a transformation crosses that line, it may still exist as an optional or
diagnostic surface, but it must not become primary runtime authority.

---

## Non-Goals

This governor does not:

- ban lawful support recruitment
- ban lawful descriptor compression
- ban bounded read-side projections
- require maximal verbosity or maximal object exposure everywhere
- treat every summary as inflation

It is not an anti-compression doctrine.
It is an anti-unfounded-coherence doctrine.

---

## Classification Ladder

Runtime-side transformations should be classified as one of the following:

### RC0 - Structure-Preserving

The step preserves structural composition without adding new coherence claims.

Typical examples:

- deterministic ingest normalization
- explicit framing / segmentation that remains provenance-bound
- structural transforms that keep geometry primary

### RC1 - Support-Deriving

The step recruits mathematical support from structure under declared reduction,
comparison, clustering, replay, or retrieval rules.

Typical examples:

- `H1` recruitment
- basin formation
- trajectory support derivation
- query support derivation

### RC2 - Descriptor-Compressing

The step compresses already lawful structural or support objects into bounded
descriptor surfaces without changing their authority class.

Typical examples:

- state support descriptor exposure
- basin support descriptor exposure
- trajectory support descriptor exposure
- replay support descriptor exposure

### RC3 - Projection-Assembling

The step assembles bounded read-side views from lawful upstream objects and
descriptors while remaining explicitly non-authoritative.

Typical examples:

- workbench integration views
- LM staging packets
- reconstruction support summaries
- bounded comparative support views

### RC4 - Coherence-Inflating

The step adds interpretive smoothness, semantic closure, synthetic unification,
or apparent completeness that is not fully justified by the declared upstream
objects or descriptors.

Typical examples:

- semantic overlay becoming necessary to read runtime shape
- receipt-led packets standing in for support composition
- interpretive aliasing that blurs object-class boundaries
- prose or labels that imply stronger unity than the upstream objects support

---

## Hard Rules

### Rule 1 - RC4 may not carry primary runtime authority

An `RC4` output may not become:

- runtime transformation authority
- runtime support authority
- substrate storage law
- default runtime admission dependency

At most, it may remain:

- optional
- explicitly labeled
- removable
- read-side only
- subordinate to lawful upstream structure/support surfaces

### Rule 2 - RC3 must remain visibly non-authoritative

Projection assembly is lawful only when:

- upstream object families are named
- omitted material is bounded honestly
- subordinate receipts remain secondary
- the projection can disappear without collapsing runtime authority

### Rule 3 - RC2 must not secretly become RC4

Descriptor compression is lawful only when it preserves declared class and
traceability.

If descriptor exposure begins to smuggle in interpretation, closure, or
semantic necessity, it should be reclassified as `RC4`.

### Rule 4 - Receipts cannot launder coherence

A receipt remains subordinate even if it is convenient, stable, compact, or
repeatedly used.

Receipt convenience does not upgrade receipt authority.

---

## Diagnostic Questions

When evaluating a runtime-side seam or emitted surface, ask:

1. What upstream object family supports this output?
2. What authority class does that upstream object carry?
3. What was omitted?
4. Did the step add interpretation not present in the upstream structure or
   support objects?
5. Can the output be traced back to one named object family or descriptor
   family?
6. If this surface disappeared, would runtime authority still remain intact?

If question 6 is answered with `no`, the surface is likely over-authoritative
and should be investigated for `RC4` inflation.

---

## Default Runtime Posture

Default runtime posture should remain:

- `RC0` through `RC2` on runtime-authoritative seams
- `RC3` only on explicitly read-side or staging seams
- `RC4` excluded from default runtime authority

This means the governor should bias toward:

- richer structural/support exposure
- descriptor-led packaging
- removable projections
- explicit optionality for semantic overlays

It should not bias toward disabling lawful compression or useful bounded views.

---

## Seam Consequences

The seams most likely to need this governor are already known:

- `Orchestrator runtime receipt seam`
- `Orchestrator result assembly seam`
- `Workbench runtime section seam`
- `Workbench semantic overlay seam`
- `LM wrapper extraction seam`
- `Cross-run report seam`

The structural and direct support seams lower in the pipeline should mostly
classify as `RC0` or `RC1` unless they begin exporting flattened substitutes.

---

## Failure Posture

When a seam is judged `RC4`, the default response is not to erase it blindly.

The default response is to do one of:

- downgrade it to optional read-side material
- relabel it as transitional
- replace it with descriptor-led exposure
- remove it from default runtime flow

This governor is therefore corrective, not punitive.

---

## One-Line Summary

The Runtime Coherence Governor classifies runtime-side transformations by how
much coherence they add beyond declared structural or support grounding and
prevents coherence-inflating outputs from becoming default runtime authority.
