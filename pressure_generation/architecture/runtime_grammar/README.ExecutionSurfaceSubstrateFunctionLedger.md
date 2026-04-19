# ExecutionSurface Substrate Function Ledger

## Status

This document freezes the current substrate-function framing for
`ExecutionSurface`.

It is an authority-facing runtime grammar companion.

Its job is to distinguish:

- what functions belong to the substrate itself
- what functions belong to layers over the substrate
- which layer carries which kind of authority
- where later commit-boundary object design must attach

## Purpose

This ledger exists because commit-boundary law, object grammar, and read-side
packaging cannot be stabilized cleanly until the substrate's own job is named
first.

The substrate is not just storage.

It is the retained relational host for lawful support objects and their
continuity.

## Frozen substrate framing

The current best-fit substrate model is a three-layer stack:

1. temporal support graph / hypergraph
2. neighborhood / basin complex
3. corpus / index access layer

These layers are not equal in authority.

They form a functional hierarchy.

## Layer authority hierarchy

### Layer 1. Temporal support graph / hypergraph

This is the primary substrate authority layer.

It hosts committed support-bearing memory objects and their direct relations.

Primary relation families at this layer include:

- provenance edges
- temporal adjacency edges
- support-composition edges
- merge lineage edges
- commit-time policy anchors
- continuity constraints

If a later surface disagrees with Layer 1, Layer 1 wins.

### Layer 2. Neighborhood / basin complex

This is a derived substrate-organization layer.

It organizes committed memory objects into neighborhoods, basins, recurrence
regions, and transition structure.

It may derive:

- neighborhood membership
- nearest-neighbor posture
- basin transitions
- dwell / recurrence structure
- local comparison neighborhoods

Layer 2 remains subordinate to Layer 1 because it is built over committed
objects and their relations.

### Layer 3. Corpus / index access layer

This is an access and management layer.

It exists to make committed memory objects and neighborhood structure
addressable, retrievable, and projectable without becoming the truth-bearing
runtime host.

It may carry:

- typed addresses
- lookup indexes
- retrieval scopes
- bounded access views
- management and routing support

Layer 3 must not flatten or replace the lower layers.

It is useful because it is practical, not because it is ontologically primary.

## Intrinsic substrate functions

These functions belong to the substrate stack itself.

They are not optional convenience layers.

### 1. Admission

Function:
admit a lawful support-bearing memory object across the commit boundary.

Home layer:
Layer 1

Authority posture:
primary runtime substrate authority

Why intrinsic:
without admission there is no retained continuity.

### 2. Persistence

Function:
retain admitted memory objects durably under append-only or otherwise lawful
continuity rules.

Home layer:
Layer 1

Authority posture:
primary runtime substrate authority

Why intrinsic:
the substrate must preserve retained state rather than just stage it.

### 3. Provenance linkage

Function:
preserve upstream derivation refs, source lineage, and policy anchors for each
admitted memory object.

Home layer:
Layer 1

Authority posture:
primary runtime substrate authority

Why intrinsic:
without provenance, reconstruction and trust ceilings collapse.

### 4. Temporal placement

Function:
preserve ordered placement, adjacency, segment locality, and recurrence-ready
temporal structure.

Home layer:
Layer 1

Authority posture:
primary runtime substrate authority

Why intrinsic:
the substrate is not a bag of states; it is a continuity-bearing temporal host.

### 5. Support composition retention

Function:
preserve internal support-bearing composition and merge lineage for admitted
memory objects.

Home layer:
Layer 1

Authority posture:
primary runtime substrate authority

Why intrinsic:
committed objects must remain reconstructable as composed support, not as flat
counts or labels.

### 6. Continuity constraints

Function:
preserve uncertainty posture, bounded identity posture, and non-closure
constraints across retained continuity.

Home layer:
Layer 1

Authority posture:
primary runtime substrate authority

Why intrinsic:
the substrate should preserve persistence without silently asserting same-object
closure.

### 7. Neighborhood organization

Function:
organize admitted memory objects into basin and neighborhood structure over
retained relations.

Home layer:
Layer 2

Authority posture:
derived substrate authority

Why intrinsic:
recurrence, locality, and transition structure should live in the substrate,
not only in later reports.

### 8. Recurrence support

Function:
preserve the neighborhood and temporal conditions needed to observe re-entry,
dwell, transition, and recurrence patterns.

Home layer:
Layer 2

Authority posture:
derived substrate authority

Why intrinsic:
recurrence is one of the main reasons to have a memory substrate at all.

### 9. Comparison support

Function:
preserve the local relations, shared bases, and neighborhood structure needed
for lawful comparison.

Home layer:
Layer 1 and Layer 2

Authority posture:
derived substrate authority

Why intrinsic:
comparison should operate over retained object relations, not over detached
summary receipts alone.

### 10. Reconstruction support

Function:
preserve the source refs, lineage, and retained support relations needed for
bounded replay or reconstruction.

Home layer:
Layer 1

Authority posture:
derived substrate authority

Why intrinsic:
reconstruction requires durable retained links back to admitted support state.

### 11. Addressability

Function:
provide stable typed access to admitted memory objects and their neighborhoods.

Home layer:
Layer 3

Authority posture:
access authority only

Why intrinsic:
without addressability, the substrate remains truthful but operationally
intractable.

### 12. Retrieval

Function:
retrieve scoped memory objects, relation slices, and neighborhood slices
without flattening them into receipts by default.

Home layer:
Layer 3

Authority posture:
access authority only

Why intrinsic:
retrieval is how higher functions lawfully consult retained memory.

## Over-substrate functions

These functions operate on top of the substrate.

They are useful and important, but they do not define substrate truth.

### 1. Query projection

Role:
assemble retrieved object slices into user-facing or function-facing query
results.

Why over-substrate:
the query result is a consult surface, not the retained truth-host.

### 2. Reconstruction emission

Role:
emit replay or reconstruction artifacts from retained support and provenance.

Why over-substrate:
the emitted replay artifact is downstream of retained support, not identical to
it.

### 3. Comparative reports

Role:
normalize or summarize comparison outcomes across runs, segments, or scopes.

Why over-substrate:
the report is secondary to the retained relations that support it.

### 4. Workbench integration

Role:
assemble a bounded inspectable runtime view for development and audit.

Why over-substrate:
the workbench is an operator-facing integration surface, not the substrate.

### 5. LM staging

Role:
stage bounded transport packets for local or remote model invocation.

Why over-substrate:
an LM packet is transport and prompt material, not runtime truth.

### 6. Human-facing planar projection

Role:
project object and relation slices into visual, textual, or geometric views.

Why over-substrate:
the projection is an access view over substrate reality.

### 7. Benchmark and validator receipts

Role:
measure or certify bounded properties of a run or emitted packet.

Why over-substrate:
validation does not become ontology.

## Functional hierarchy table

| Function | Layer home | Scope | Authority posture | Default output posture |
| --- | --- | --- | --- | --- |
| Admission | Layer 1 | intrinsic substrate | primary runtime substrate authority | committed memory object and lawful relation edges |
| Persistence | Layer 1 | intrinsic substrate | primary runtime substrate authority | retained committed objects |
| Provenance linkage | Layer 1 | intrinsic substrate | primary runtime substrate authority | preserved source and policy refs |
| Temporal placement | Layer 1 | intrinsic substrate | primary runtime substrate authority | ordered temporal relations |
| Support composition retention | Layer 1 | intrinsic substrate | primary runtime substrate authority | internal composition and lineage |
| Continuity constraints | Layer 1 | intrinsic substrate | primary runtime substrate authority | bounded continuity posture |
| Neighborhood organization | Layer 2 | intrinsic substrate | derived substrate authority | basin and neighborhood relations |
| Recurrence support | Layer 2 | intrinsic substrate | derived substrate authority | recurrence-ready relation structure |
| Comparison support | Layer 1 / 2 | intrinsic substrate | derived substrate authority | retained comparative basis |
| Reconstruction support | Layer 1 | intrinsic substrate | derived substrate authority | replay-supporting refs and relations |
| Addressability | Layer 3 | intrinsic substrate | access authority only | typed access handles |
| Retrieval | Layer 3 | intrinsic substrate | access authority only | scoped object and relation slices |
| Query projection | over substrate | read-side | read-side only | consult packet |
| Reconstruction emission | over substrate | read-side | read-side only | replay packet or object slice |
| Comparative reports | over substrate | read-side | read-side only | bounded comparison surface |
| Workbench integration | over substrate | read-side | read-side only | inspectable integration view |
| LM staging | over substrate | read-side | read-side only | bounded transport packet |
| Human-facing projection | over substrate | read-side | read-side only | visual or textual projection |
| Benchmark / validator receipts | over substrate | audit | subordinate audit only | receipts only |

## Commit-boundary implications

This ledger implies several things for the next object-law pass.

### 1. The commit boundary should terminate in one admitted object

The substrate should not be forced to reason only in terms of loose mixed
`H1`/`M1` fragments if a single admitted memory object can retain them
conservatively.

### 2. The admitted object must stay internally dimensional

The admitted object must preserve at least:

- structural/support refs
- provenance refs
- temporal placement
- support composition or merge lineage
- continuity constraints
- policy anchors

### 3. The admitted object must not collapse into corpus-only identity

Layer 3 addressability is useful, but it must point back to Layer 1 and Layer 2
rather than replacing them.

### 4. Comparison and reconstruction should attach to retained relations

They should not depend on receipt-only summaries as their primary support.

## Anti-patterns fenced by this ledger

The following are malformed:

- corpus or index entries treated as substrate truth
- comparison reports treated as primary memory objects
- reconstruction outputs treated as raw restoration
- benchmark receipts treated as object evidence
- Layer 3 access surfaces defining runtime shape for Layers 1 or 2
- admitted objects flattened to scalar counts where retained relations are
  actually needed

## Next lawful move

The next architectural move after this ledger is:

define the admitted memory object for the commit boundary in a way that fits
this three-layer substrate and preserves internal dimensionality.

## One-line summary

ExecutionSurface is best stabilized as a three-layer substrate in which a
temporal support graph / hypergraph carries primary authority, a neighborhood /
basin complex organizes retained continuity, and a corpus / index layer provides
addressable access without replacing lower-layer truth.
