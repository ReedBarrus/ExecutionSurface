# ExecutionSurface Runtime Emission And Authority Grammar

## Status

This document is part of the shared active runtime grammar authority for
`ExecutionSurface`.

It defines what each runtime seam may emit and what authority those emissions do
or do not carry.

It should be read together with:

- `README.ExecutionSurfaceRuntimeObjectGrammar.md`
- `README.ExecutionSurfaceRuntimeChainMap.md`
- `README.ExecutionSurfaceRuntimeSeamLedger.md`

## Purpose

This file exists to prevent runtime seams from becoming mixed convenience bundles
whose labels are honest but whose packaging still encourages overread.

Its main corrective posture is:

- receipts are convenience only
- receipts do not determine runtime shape
- default runtime authority excludes semantic overlay

## Authority Bands

### Runtime Transformation Authority

This authority is limited to lawful deterministic transformation of admitted
input and preservation of lineage and policy anchors.

It belongs to the structural path through `S1`.

### Runtime Support Authority

This authority is limited to lawful support recruitment, support comparison,
support storage, support clustering, support retrieval, and support replay under
bounded non-claims.

It begins at `H1`.

### Subordinate Audit Authority

This authority is limited to receipts, validator results, benchmark results, and
other bounded audit surfaces.

It must never be mistaken for runtime substance.

### Read-Side Projection Authority

This is not runtime authority in the transformation sense.

It is limited to bounded inspection, staging, comparison, and rendering over
lawful upstream objects.

It must remain explicitly non-authoritative relative to runtime substance.

## Mechanism Strata

Emission law should be read through the following mechanism strata:

- `Operator seam`
- `Pipeline coordination function`
- `Substrate boundary / surface`
- `Read-side function`
- `Transitional bridge`

These strata are not interchangeable and should not be described as if they
carry the same kind of authority.

## Emission Laws

### Law 1: Structural Seams

Structural seams may emit:

- one structural object
- subordinate receipts

Structural seams must not emit:

- semantic overlays
- receipt-only substitutes for structural objects

### Law 2: Support Recruitment Seams

Support recruitment seams may emit:

- one support object
- subordinate receipts
- bounded subordinate support observations when explicitly declared

Support recruitment seams must not emit:

- semantic interpretation as part of default runtime authority
- receipt-only substitutes for support objects

### Law 3: Mixed Emission Restriction

One seam may not casually bundle:

- structural objects
- support objects
- interpretive overlays

inside one convenience packet without an explicit class split and explicit
non-authority posture.

Even where labels are honest, mixed packaging is a risk seam and should be
tightened or re-derived.

### Law 4: Receipt Subordination

Receipts may accompany any seam lawfully.

Receipts must remain:

- subordinate
- explicitly secondary
- incapable of determining runtime shape by themselves

### Law 5: No Default Semantic Dependency

Default runtime admission, storage, cross-run comparison, reconstruction
support, and LM staging must not require semantic overlay presence.

### Law 6: No Compatibility Alias Bridges In Default Runtime

Compatibility aliases that duplicate interpretive material across multiple names
should not remain in the default runtime posture.

They weaken provenance legibility and encourage overread across class
boundaries.

## Default Emission Grammar By Stratum

### Operator Seams

Allowed:

- one structural or support object family at a time
- subordinate receipts

Not allowed by default:

- semantic overlays
- compatibility aliases
- mixed convenience bundles of multiple authority classes

### Pipeline Coordination Functions

Allowed:

- lawful routing of upstream objects
- bounded assembly of sections that remain class-distinct
- subordinate receipts

Not allowed by default:

- semantic duplication as runtime necessity
- receipt-led substitution for missing descriptors
- mixed class packaging without explicit split and explicit non-authority posture

### Substrate Boundaries / Surfaces

Allowed:

- support objects
- relation objects
- subordinate receipts

Not allowed by default:

- semantic overlays as part of substrate storage law
- receipts as stand-ins for support state composition

### Read-Side Functions

Allowed:

- retrieval
- replay
- comparison
- validation
- staging
- rendering
- subordinate receipts

Not allowed by default:

- hidden runtime mutation
- identity closure
- semantic dependency for lawful admission unless explicitly declared as optional

### Transitional Bridges

Allowed only temporarily:

- compatibility shims
- mirrored fields
- staged fallback packaging

Default posture:

- transitional bridges should be explicitly labeled
- transitional bridges should be removable
- transitional bridges should not be depended on by later durable seams

## Default Emission Grammar By Region

### Orchestrator Assembly

Should emit:

- structural and support sections only
- bounded support descriptors
- subordinate runtime receipt

Should not emit by default:

- semantic overlay
- top-level interpretation aliasing

### Workbench Integration

Should emit:

- bounded structural-support integration view
- subordinate workbench receipt

Should not emit by default:

- semantic overlay duplication
- compatibility aliases

### Cross-Run Comparison

Should emit:

- structural-support comparison descriptors
- reproducibility posture
- subordinate comparison receipts

Should not depend on:

- interpretive label families for admission
- optional semantic overlays for lawful comparison

### LM Wrapper

Should consume:

- bounded support descriptors
- subordinate receipts where helpful

Should not consume by default:

- semantic overlays as required input

## Descriptor Routing Rule

Descriptor families should route to seams as follows:

- state support descriptors: orchestrator assembly, workbench runtime section,
  LM staging, cross-run comparison
- basin support descriptors: substrate read-side exposure, workbench runtime
  section, cross-run comparison
- trajectory support descriptors: substrate read-side exposure, orchestrator
  assembly, cross-run comparison, workbench runtime section
- query support descriptors: query seam output, orchestrator assembly,
  workbench runtime section, LM staging when query is present
- replay support descriptors: replay seam output, reconstruction support staging,
  workbench runtime section when replay is present

## Seam-By-Seam Descriptor Emission Map

This table is the active routing skeleton for Phase 2 tightening.

It defines, seam by seam:

- what descriptor families are allowed
- what receipts may remain subordinate
- what should be removed or prohibited by default

| Seam | Mechanism Stratum | Default Emitted Family | Allowed Descriptor Families | Allowed Subordinate Surfaces | Default Prohibited / To Remove | Active Correction Target |
| --- | --- | --- | --- | --- | --- | --- |
| `Ingest seam` | `Operator seam` | `Structural object` | none | ingest and sequence receipts | support descriptors, semantic overlays, receipt-only substitution | keep structural only |
| `Clock alignment seam` | `Operator seam` | `Structural object` | none | alignment receipts | support descriptors, semantic overlays, receipt-only substitution | keep structural only |
| `Windowing seam` | `Operator seam` | `Structural object` | none | window receipts | support descriptors, semantic overlays, receipt-only substitution | keep structural only |
| `Transform seam` | `Operator seam` | `Structural object` | none | transform receipts | support descriptors, semantic overlays, receipt-only substitution | keep structural only |
| `Support recruitment seam` | `Operator seam` | `Support object` | none at emission; source object is `H1` | compression receipts and gates | semantic overlays, receipt-only substitution | preserve `H1` as primary support carrier |
| `Novelty evidence seam` | `Operator seam` | `Support object` | none at emission; source object is `An` | anomaly receipts | semantic overlays, semantic narration | preserve `An` as primary novelty carrier |
| `Segmentation bookkeeping seam` | `Pipeline coordination function` | `Support object` | none at emission; source object is `SegmentTransition` | transition bookkeeping fields | semantic overlays, identity claims | preserve bounded transition object |
| `Substrate commit seam` | `Substrate boundary / surface` | `Support object host` | none; this seam admits stored support objects rather than exporting descriptors by default | commit receipts, trajectory push metadata | semantic overlays, receipt-only substrate identity | preserve lawful commit boundary |
| `Trajectory surface seam` | `Substrate boundary / surface` | `Support object` | `Trajectory support descriptor` | trajectory summaries, bounded receipts | semantic trajectory overlays, count-only packets as sole exposure | expose trajectory descriptor directly |
| `Basin formation seam` | `Substrate boundary / surface` | `Support object` | `Basin support descriptor` | basin receipts | semantic basin narration, count-only packets as sole exposure | expose basin descriptor directly |
| `Query seam` | `Read-side function` | `Support object` | `Query support descriptor` | query receipts | symbolic interpretation, ontological labeling | expose query descriptor directly |
| `Merge seam` | `Operator seam` | `Support object` | none at emission; source object is `M1` | merge receipts | semantic overlays, receipt-only substitution | preserve `M1` as primary support carrier |
| `Replay seam` | `Read-side function` | `Support object` | `Replay support descriptor` | reconstruct receipts | raw restoration claims, semantic overlays as replay necessity | expose replay descriptor directly |
| `Orchestrator runtime receipt seam` | `Pipeline coordination function` | `Receipt summary` | none | `runtime_receipt` only | receipt-led runtime shape | subordinate receipt only |
| `Orchestrator result assembly seam` | `Pipeline coordination function` | `Read-side projection` | `State support descriptor`, `Trajectory support descriptor`, `Query support descriptor`, `Replay support descriptor` when present | subordinate `runtime_receipt` | `semantic_overlay`, top-level `interpretation`, count-only runtime packets as sole exposure | rebuild around support descriptors |
| `Trajectory interpretation seam` | `Read-side function` | `Semantic overlay` | none in default runtime | none | default dependency, runtime authority | remove from default posture |
| `Attention/memory interpretation seam` | `Read-side function` | `Semantic overlay` | none in default runtime | none | default dependency, runtime authority | remove from default posture |
| `Cross-run session admission seam` | `Pipeline coordination function` | `Read-side projection` | none directly; should admit runs with descriptor-capable runtime sections | bounded admission receipts | interpretive overlays as admission requirement | admit on structural-support basis |
| `Cross-run report seam` | `Read-side function` | `Read-side projection` | `State support descriptor`, `Basin support descriptor`, `Trajectory support descriptor`, `Query support descriptor` when present | comparison receipts | interpretive label families as comparison basis | re-derive on structural-support descriptors |
| `Workbench runtime section seam` | `Pipeline coordination function` | `Read-side projection` | `State support descriptor`, `Basin support descriptor`, `Trajectory support descriptor`, `Query support descriptor`, `Replay support descriptor` when present | subordinate `workbench_receipt` | count-heavy packets as sole exposure | rebuild as descriptor-led integration view |
| `Workbench receipt seam` | `Pipeline coordination function` | `Receipt summary` | none | `workbench_receipt` only | receipt-led runtime shape | subordinate receipt only |
| `Workbench semantic overlay seam` | `Pipeline coordination function` | `Semantic overlay` | none in default runtime | none | default runtime dependency | remove |
| `Workbench compatibility alias seam` | `Transitional bridge` | `Semantic overlay` | none | transitional bridge only | durable dependency, provenance blur | remove entirely |
| `LM wrapper extraction seam` | `Read-side function` | `Read-side projection` | `State support descriptor`, `Trajectory support descriptor`, `Query support descriptor` when present, `Replay support descriptor` when present | subordinate receipts when helpful | semantic overlays as required input, count-only packet as final target | retune packet around support descriptors |
| `LM output validation seam` | `Read-side function` | `Read-side projection` | none; validates bounded LM output against upstream descriptor-based input | validation receipts | hidden write authority, widened authority posture | keep bounded validation seam |
| `Reconstruction runtime support collection seam` | `Read-side function` | `Read-side projection` | `Replay support descriptor`, `State support descriptor` when needed for source support basis | reconstruction receipts | semantic overlays as required support basis | keep structural-support basis only |
| `Reconstruction interpretive support seam` | `Read-side function` | `Semantic overlay` | none in default runtime | none | default support basis, widened interpretation reliance | remove |
| `Probe receipt seam` | `Read-side function` | `Receipt summary` | none | probe receipts only | runtime authority, write authority | keep advisory-only |

## Runtime Seam And Authority Grammar Compression

Downstream mixed seams may assemble, stage, compare, validate, or expose lawful upstream structural and support objects through bounded support descriptors, read-side projections, and subordinate receipts.

They may not treat semantic overlays, compatibility aliases, receipt-only summaries, hidden write authority, identity closure, truth posture, or canon posture as default runtime authority.

Any downstream seam whose current usefulness depends on semantic overlay, compatibility aliasing, or receipt-only exposure above `H1` must be tightened, re-derived, removed, or quarantined before `Support Descriptor Contract Family` opens broadly.

### Target mixed-seam classifications

| Seam | Mechanism stratum | Allowed authority | Allowed default emission | Prohibited default emission | Forward posture |
| --- | --- | --- | --- | --- | --- |
| `Orchestrator result assembly seam` | `Pipeline coordination function` | `Read-side projection only` with subordinate audit | class-distinct structural/support sections, allowed support descriptors, subordinate `runtime_receipt` | semantic overlay as runtime dependency, top-level interpretation alias, receipt-only substitute above `H1`, hidden write authority, identity/truth/canon claims | `Re-derive` |
| `Workbench runtime section seam` | `Pipeline coordination function` | `Read-side projection only` with subordinate audit | descriptor-led structural/support integration view, subordinate `workbench_receipt` | count-heavy packet as sole exposure, semantic overlay dependency, compatibility aliases, hidden write authority, identity/truth/canon claims | `Tighten` |
| `Workbench compatibility alias seam` | `Transitional bridge` | `Transitional compatibility only` until removed | no durable default emission; temporary compatibility shim only when explicitly labeled | compatibility alias as durable law, semantic mirror as runtime necessity, provenance blur, receipt/object substitution | `Remove` |
| `Cross-run session admission seam` | `Pipeline coordination function` | `Read-side projection only` for run admission | descriptor-capable runtime section admission, bounded admission receipt | interpretive overlay admission requirement, semantic label family dependency, hidden promotion/truth/canon posture | `Re-derive` |
| `Cross-run report seam` | `Read-side function` | `Read-side projection only` with subordinate comparison receipts | descriptor-led structural/support comparison posture, reproducibility posture, subordinate comparison receipts | interpretive label comparison as default basis, semantic overlay dependency, truth/canon/same-object closure | `Re-derive` |
| `LM wrapper extraction seam` | `Read-side function` | `Read-side projection only` | bounded descriptor-fed LM input view, subordinate receipts when useful | semantic overlay as required input, count-only packet as final target, hidden write authority, agent authority inflation | `Tighten` |
| `Reconstruction runtime support collection seam` | `Read-side function` | `Read-side projection only` over runtime support | replay/state descriptor support basis, reconstruction receipts | interpretive support as required basis, raw restoration claim, source-equivalence proof, hidden enhancement | `Tighten` |
| `Reconstruction interpretive support seam` | `Read-side function` | optional downstream read-side interpretation only | none in default runtime authority; optional overlay only when explicitly separated | default reconstruction support basis, widened interpretation reliance, semantic overlay as support authority | `Remove` |

### Allowed emissions for the mixed downstream band

The mixed downstream band may emit or route:

- bounded read-side projections that preserve class separation
- support descriptors routed from lawful upstream support objects
- subordinate receipts for audit, validation, comparison, admission, or transport
- optional semantic overlays only when explicitly downstream and non-default
- temporary transitional bridges only when explicitly named, removable, and not used as later durable dependencies

### Prohibited emissions for the mixed downstream band

The mixed downstream band must not emit by default:

- semantic overlay as runtime dependency
- compatibility alias as durable law
- receipt-only substitute above `H1`
- hidden write authority
- hidden memory retention or promotion
- identity closure
- truth claims
- canon posture
- source-equivalence or raw restoration claims
- agent authority inflation

### Transitional-material posture

Compatibility aliases, semantic mirrors, count-heavy convenience packets, and interpretive support dependencies are transitional material when they remain necessary for repo continuity.

They may be tolerated only when explicitly labeled, removable, and subordinate to lawful upstream structural/support objects and support descriptors.

They must not become descriptor-contract inputs, implementation proof targets, runtime authority, or default dependencies for cross-run admission, workbench exposure, LM staging, or reconstruction support.

### Support Descriptor Contract Family opening condition

`Support Descriptor Contract Family` may open only after this seam-authority grammar is stable enough that descriptor contracts will not harden:

- semantic overlays as default runtime authority
- compatibility aliases as durable law
- receipt-only exposure above `H1`
- mixed read-side projections without explicit non-authority posture
- hidden write, identity, truth, canon, promotion, or source-equivalence claims

The next descriptor-contract opening should either:

- open the full first descriptor family only if Reflector and Auditor confirm the mixed downstream band is sufficiently bounded; or
- open a first narrow slice for `State support descriptor` with explicit routing and non-claim limits if any seam-class tension remains.

## Phase 2 Descriptor Priorities

The descriptor families should be implemented in this order:

1. `State support descriptor`
2. `Trajectory support descriptor`
3. `Basin support descriptor`
4. `Query support descriptor`
5. `Replay support descriptor`

This order follows the active correction corridor:

- orchestrator assembly
- workbench runtime section
- cross-run comparison
- LM staging
- reconstruction support staging

## Revision Rule

This emission grammar should remain open to correction when implementation shows
that:

- a seam stratum is misclassified
- a descriptor family is routed to the wrong seam
- a supposedly durable surface is still transitional
- a read-side function is still smuggling authority

## Current Runtime Correction Target

The main correction target established here is:

- remove default semantic emission from orchestrator and workbench
- replace count-only read-side exposure with bounded support descriptors
- keep receipts as subordinate audit surfaces

## One-Line Summary

ExecutionSurface emission law permits structural and support objects plus
subordinate receipts at lawful seams, while forbidding receipt-led runtime shape
and removing semantic overlay from default runtime authority across operators,
coordination, substrate, and read-side seams.
