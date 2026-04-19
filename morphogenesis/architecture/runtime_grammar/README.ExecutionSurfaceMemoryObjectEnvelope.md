# ExecutionSurface MemoryObject Envelope

## Status

This document defines the projected `MemoryObject` envelope for
`ExecutionSurface`.

It is an authority-facing runtime grammar surface.

It freezes the commit-boundary object shape we are now stabilizing toward.

It does not claim that the full envelope is already implemented in code.

## Purpose

`MemoryObject` exists to make the substrate commit boundary singular, durable,
typed, and source-family-wide without flattening admitted payload into summary
surfaces.

The envelope must support at least two early families cleanly:

- `analog_signal`
- `json`

If it works lawfully for those two, it is wide enough to admit later source
families such as text, tables, code, images, and embeddings without redesigning
the substrate.

## Core thesis

`MemoryObject` is the singular admitted substrate-boundary object.

It binds lawful payload into one durable, typed, addressable substrate object
while preserving payload-native dimensionality and exposing typed relation hooks
for later topology, comparison, reconstruction, and retrieval.

`MemoryObject` is not:

- a summary surface
- a descriptor
- an object card
- a receipt
- a semantic wrapper

## Three jobs

### 1. Admission binding

Bind a lawful payload into one durable, typed, addressable substrate object.

### 2. Dimensional conservation

Preserve payload-native structural/support dimensionality sufficient for
declared comparison and reconstruction.

### 3. Relation exposure

Expose typed relation hooks for provenance, temporal placement, continuity,
neighborhood, comparison, reconstruction, and retrieval without flattening the
payload into summaries, descriptors, or receipts.

## Field contract

### Required fields

- `memory_object_id`
- `source_family`
- `payload_kind`
- `payload_ref`
- `admission_extent`
- `provenance_edges`
- `policy_refs`
- `continuity_constraints`
- `relation_slots`
- `explicit_non_claims`

### Conditionally required fields

- `structural_refs`
  Required when the payload derives from distinct upstream structural objects.

- `support_refs`
  Required when the payload is support-bearing or support-derived.

- `comparison_basis_refs`
  Required when the object is admitted with declared comparison bases.

- `reconstruction_lenses`
  Required when lawful reconstruction routes are declared.

- `family_contract_ref`
  Required when admission relies on a source-family-specific adapter contract.

- `admission_mode`
  Required when the family needs explicit distinction such as
  `temporal_stream`, `static_snapshot`, `revision_event`, or `derived_merge`.

- `lineage_refs`
  Required when the object inherits from prior admitted objects, revisions,
  merges, or splits.

### Optional fields

- bounded retained structure needed for lawful addressability
- bounded family-specific handles that do not collapse payload-native geometry
- explicit omission markers when the admitted object intentionally stages only a
  bounded slice

## Field meanings

### `memory_object_id`

The durable typed identity of the admitted object.

### `source_family`

The source-family route that produced the payload.

Examples:

- `analog_signal`
- `json`
- `text`
- `table`
- `code`

### `payload_kind`

The payload family carried under the envelope.

Examples:

- `h1_support`
- `m1_support`
- `parsed_tree_support`
- `schema_shape_support`
- `span_support`
- `row_column_support`
- `syntax_tree_support`

### `payload_ref`

The primary typed pointer to the admitted payload surface.

`payload_ref` must point back to retained lawful runtime material, not to a
receipt or narrative summary.

### `structural_refs`

Pointers back to upstream structural objects when those remain relevant to
provenance or reconstruction.

### `support_refs`

Pointers to support-bearing objects preserved under the envelope.

For analog signal this may include `H1` and `M1`.

For `json` this may include parsed-tree or schema-shape support objects.

### `admission_extent`

The placement extent that admits the object into substrate continuity.

This must be wide enough for temporal and non-temporal families.

Examples:

- temporal span for analog signal
- snapshot or revision extent for `json`
- span or section extent for text
- row/column extent for tables

The substrate is temporally continuous, not source-family-specific.

Static families may still enter through temporally placed admission extents.

### `provenance_edges`

Typed source and derivation edges sufficient to preserve lineage and trust
ceilings.

### `lineage_refs`

Typed relations to prior admitted objects, revisions, merges, splits, or
derived continuity events.

This is distinct from provenance because it captures object-to-object retained
history, not only upstream derivation.

### `policy_refs`

Typed policy anchors attached at admission.

### `continuity_constraints`

The bounded continuity posture attached to the object.

This may include:

- uncertainty posture
- bounded identity posture
- non-closure constraints
- replay limits
- promotion separation

### `relation_slots`

Typed relation hooks used by the substrate to attach the object into retained
topology.

Possible slots include:

- provenance
- temporal adjacency
- merge or membership
- neighborhood or basin membership
- recurrence or reuse
- comparison basis
- reconstruction source
- query or retrieval consult

### `comparison_basis_refs`

Typed basis handles that permit comparison without baking comparison outcomes
into object identity.

Examples:

- band profile basis
- kept-bin basis
- path-set basis
- schema-shape basis
- token-order basis
- row/column basis
- syntax-tree basis

### `reconstruction_lenses`

Declared lawful reconstruction routes.

These are lenses, not restoration claims.

### `family_contract_ref`

The adapter contract that explains how a source family forms a lawful payload
for admission.

This lets the top-level envelope stay uniform while family-specific structure
varies underneath it.

### `admission_mode`

The declared admission posture for the object.

Examples:

- `temporal_stream`
- `static_snapshot`
- `revision_event`
- `derived_merge`

### `explicit_non_claims`

The envelope must state what it does not claim.

Examples:

- no same-object closure
- no semantic identity
- no truth closure
- no canon
- no raw restoration
- no hidden write authority

## Invariants

### Invariant 1. `MemoryObject` is not a summary surface

It binds payload.

It does not replace payload with summary.

### Invariant 2. `MemoryObject` does not normalize all families into one geometry

It preserves family-native dimensionality under a shared envelope.

### Invariant 3. `MemoryObject` must remain thinner than the payload it carries

The envelope should point, bind, constrain, and relate.

It should not become a second payload format.

### Invariant 4. `MemoryObject` must preserve lawful comparison basis

Comparison may be supported by the object.

Comparison results must not become the object's identity.

### Invariant 5. `MemoryObject` must preserve lawful reconstruction basis

Reconstruction may be supported by the object.

Reconstruction output must not be claimed as raw restoration.

### Invariant 6. `MemoryObject` must preserve addressability without corpus-only collapse

Addressability is necessary.

Index or corpus access must still point back to admitted object truth.

### Invariant 7. `MemoryObject` must preserve continuity without same-object inflation

Persistence does not grant identity closure.

### Invariant 8. `MemoryObject` must preserve relation hooks without payload flattening

The substrate may attach the object into topology, but the topology must not be
faked through receipts or count-only summaries.

## Source-family posture

The top-level envelope is uniform.

Payload-native structure underneath it is not.

### `analog_signal`

Typical payload kinds:

- `h1_support`
- `m1_support`

Likely comparison bases:

- kept bins
- band profiles
- basin distance
- trajectory posture

Likely reconstruction lenses:

- support-derived replay
- bounded replay slice
- continuity replay under declared lens

### `json`

Typical payload kinds:

- `parsed_tree_support`
- `schema_shape_support`

Likely comparison bases:

- path-set difference
- schema-shape difference
- subtree relation
- value-change posture

Likely reconstruction lenses:

- normalized object view
- subtree replay
- prior revision view
- bounded diff lens

The envelope stays the same.

The admitted basis varies by source family.

## Minimal examples

### Example 1. `analog_signal`

```json
{
  "memory_object_id": "mo:analog:streamA:seg04:h1m1:0001",
  "source_family": "analog_signal",
  "payload_kind": "m1_support",
  "payload_ref": "m1:streamA:seg04:0001",
  "structural_refs": ["s1:streamA:seg04:frame008"],
  "support_refs": ["h1:streamA:seg04:008", "m1:streamA:seg04:0001"],
  "admission_extent": {
    "mode": "temporal_span",
    "stream_id": "streamA",
    "segment_id": "seg04",
    "frame_start": 8,
    "frame_end": 12
  },
  "provenance_edges": ["prov:s1_to_h1:008", "prov:h1_to_m1:0001"],
  "lineage_refs": [],
  "policy_refs": ["policy:door_one_commit:v1"],
  "continuity_constraints": {
    "bounded_identity": true,
    "same_object_closure": false,
    "replay_is_lens_bound": true
  },
  "relation_slots": {
    "temporal_adjacency": true,
    "neighborhood_membership": true,
    "comparison_basis": true,
    "reconstruction_source": true
  },
  "comparison_basis_refs": ["basis:kept_bins:0001", "basis:band_profile:0001"],
  "reconstruction_lenses": ["lens:analog_support_replay:v1"],
  "family_contract_ref": "contract:analog_signal_support_admission:v1",
  "admission_mode": "temporal_stream",
  "explicit_non_claims": [
    "no_same_object_closure",
    "no_semantic_identity",
    "no_raw_restoration",
    "no_hidden_write_authority"
  ]
}
```

### Example 2. `json`

```json
{
  "memory_object_id": "mo:json:configA:rev07:tree:0001",
  "source_family": "json",
  "payload_kind": "parsed_tree_support",
  "payload_ref": "json_tree:configA:rev07:0001",
  "structural_refs": ["json_src:configA:rev07"],
  "support_refs": ["json_tree:configA:rev07:0001"],
  "admission_extent": {
    "mode": "revision_extent",
    "document_id": "configA",
    "revision_id": "rev07"
  },
  "provenance_edges": ["prov:json_parse:configA:rev07"],
  "lineage_refs": ["mo:json:configA:rev06:tree:0001"],
  "policy_refs": ["policy:json_commit:v1"],
  "continuity_constraints": {
    "bounded_identity": true,
    "same_object_closure": false,
    "reconstruction_is_lens_bound": true
  },
  "relation_slots": {
    "lineage": true,
    "comparison_basis": true,
    "reconstruction_source": true,
    "query_consult": true
  },
  "comparison_basis_refs": [
    "basis:path_set:configA:rev07",
    "basis:schema_shape:configA:rev07"
  ],
  "reconstruction_lenses": ["lens:json_normalized_view:v1", "lens:json_subtree:v1"],
  "family_contract_ref": "contract:json_tree_admission:v1",
  "admission_mode": "revision_event",
  "explicit_non_claims": [
    "no_same_object_closure",
    "no_truth_closure",
    "no_canon",
    "no_hidden_write_authority"
  ]
}
```

## Non-claims

`MemoryObject` does not claim:

- that every admitted family shares one geometry
- that every admitted family is an analog signal
- that temporal continuity means source-family time series
- that comparison outputs define object identity
- that reconstruction restores raw original truth
- that index entries or receipts may replace admitted object authority
- that semantic overlay is part of commit-boundary law

## Relation to the substrate

`MemoryObject` is the admission envelope for Layer 1 substrate truth.

Neighborhood overlays, comparison views, reconstruction outputs, workbench
assemblies, and LM packets remain downstream of that admitted truth.

## One-line summary

`MemoryObject` is a singular, typed, source-family-wide admission envelope that
binds lawful payload into retained substrate continuity while conserving
payload-native dimensionality and exposing typed relation hooks without turning
the envelope into a summary surface.
