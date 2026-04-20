# Graphical Substrate Emergence

## Status

Design target. Not an implementation packet. Not a runtime mutation contract.

This document freezes the current conceptual target for an authoritative graphical substrate in ExecutionSurface. It exists to prevent a flattened read-side graph view, LM transport shape, or index card surface from accidentally inflating into substrate authority.

This is the target Layer 1 exposure model after `MemoryObject` admission is stabilized. It does not replace the admission seam and should not be treated as the first implementation obligation unless the active packet explicitly grants that scope.

## Purpose

The graphical substrate exists to expose the emergent relationships of admitted memory envelope signatures interacting over time.

The graph is not merely a reference map and not merely a packaging layer. Its purpose is to conserve invariance across the expressive dimensions of admitted memory so that temporal continuity, recurrence, drift, neighborhoods, basins, lineage, and interference can be derived lawfully rather than inferred from flattened receipts.

## Core Thesis

One admitted memory event becomes one layered graph node.

That node is the graph-native exposure of a real admitted `MemoryObject`. It conserves the memory object across multiple axes without exploding every attribute into a separate pseudo-object too early.

The target identity rule is:

```text
node_id == memory_object_id
```

A `CommittedMemoryNode` is therefore not a substitute for `MemoryObject`; it is the graph-native expression of a committed `MemoryObject`.

This graph exposure must not remove, replace, or weaken truthful direct access to the underlying support object. Direct support access remains preserved through the object body store and existing state-first read paths unless a later packet explicitly changes that contract.

## Layered Substrate Model

The hybrid substrate is organized into three distinct authority layers.

### Layer 1 - Exposure Graph Floor

Layer 1 is the authoritative graph floor for committed memory topology.

Its graph state is derived from an append-only graph ledger of lawful node and edge mutations. Its role is to conserve multi-axis identity and exposed structural invariance over time.

Layer 1 does not derive neighborhoods, does not package cards, does not emit LM summaries, and does not claim canon.

### Layer 2 - Emergent Relation Layer

Layer 2 derives relationships over Layer 1 nodes and edges.

It may produce structural similarity relations, basin nodes, basin membership edges, dwell relations, recurrence relations, transition relations, lineage convergence relations, and interference relations.

Layer 2 is derived substrate organization. It must remain subordinate to the Layer 1 graph floor.

### Layer 3 - Corpus / Index / Transport Layer

Layer 3 owns efficient packaging and access.

Cards, compact graph excerpts, query packets, LM transport packets, UI inspection packets, and corpus/index views belong here.

Cards are not Layer 1 graph nodes.

## Current Representation Pressure

The current substrate already implies a graph through several coordinated but separate structures:

```text
_states
_memoryObjects
_memoryObjectIdsByStateId
_trajectory
_basins
_basinsBySegment
```

This is workable as implementation scaffolding, but it creates representation pressure. If additional graph views, LM packets, and index cards are added without explicit coordination, authority can inflate across duplicated representations.

This document defines the target split:

```text
Object body store = substance / payload body
Graph ledger      = append-only mutation history
Graph state       = relation / topology / continuity floor
Index layer       = retrieval / packaging / access
```

## MemoryObject, Support Object, and Graph Node

The current distinction should be preserved and made explicit.

### Support Object

`H1` and `M1` are support-bearing structural objects. They carry produced structural support such as coordinate basis, retained bins, invariants, uncertainty, confidence, policies, provenance, and replay-relevant material.

They answer:

```text
What support structure was produced?
```

### MemoryObject

`MemoryObject` is the admitted persistence envelope. It binds a support object to admission extent, policy refs, continuity constraints, relation slots, provenance edges, non-claims, and persistence posture.

It answers:

```text
What admitted memory envelope now carries this support?
```

### CommittedMemoryNode

`CommittedMemoryNode` is the Layer 1 graph-native exposure of an admitted `MemoryObject`.

It answers:

```text
How does this admitted memory event participate in conserved graph topology over time?
```

## Trajectory Frame Reframing

A trajectory frame is not the primary graph identity.

A trajectory frame is an emergent temporal coordinate for an admitted memory node.

This avoids overloading trajectory frames as object identity, temporal coordinate, diff container, basin bridge, and graph node all at once.

The cleaner split is:

```text
CommittedMemoryNode = identity-bearing graph node
trajectory axis     = temporal coordinate of that node
temporal_next edge  = declared relation between admitted memory events
Layer 2 delta edges = derived relations between nodes
```

## Layer 1 Node Shape

Layer 1 should begin with one primary graph node type:

```text
CommittedMemoryNode
```

A node should be populated from the admitted `MemoryObject`, its support payload reference, and its trajectory coordinate.

The node should be multi-axis, not fragmented into many premature subnodes.

Suggested minimal shape:

```json
{
  "node_type": "CommittedMemoryNode",
  "node_id": "MO:H1:...",
  "memory_object_id": "MO:H1:...",
  "state_id": "H1:...",
  "artifact_class": "H1",
  "axes": {
    "trajectory": {
      "stream_id": "STR:...",
      "segment_id": "seg:...",
      "t_start": 0,
      "t_end": 1,
      "frame_index": 0
    },
    "structure": {
      "signature_type": "band_energy_vector_v1",
      "basis": "invariants.band_profile_norm.band_energy",
      "vector": [1, 0],
      "energy_raw": 1.25,
      "confidence": 1
    },
    "support": {
      "payload_kind": "h1_support",
      "payload_ref": "H1:..."
    },
    "provenance": {
      "source_refs": ["S1:test:w0"],
      "operator_id": "CompressOp",
      "operator_version": "0.1.0"
    },
    "policy": {
      "clock_policy_id": "CLK:v1",
      "compression_policy_id": "COMP:1"
    },
    "continuity": {
      "admission_mode": "temporal_stream",
      "non_claims": [
        "not_canon",
        "not_truth_closure",
        "not_same_object_closure",
        "not_raw_restoration"
      ]
    }
  }
}
```

## Layer 1 Axes

The initial node axes are:

```text
identity axis
trajectory axis
structure axis
support axis
provenance axis
policy axis
continuity axis
```

### Identity Axis

Conserves the admitted object identity.

Required identifiers:

```text
memory_object_id
state_id
artifact_class
```

### Trajectory Axis

Conserves temporal placement.

Required fields:

```text
stream_id
segment_id
t_start
t_end
frame_index
```

### Structure Axis

Conserves the minimal exposed signature needed for geometry and relation derivation.

Initial fields:

```text
signature_type
basis
vector
energy_raw
confidence
```

This axis should expose enough structure for Layer 2 derivation without duplicating the full support payload.

### Support Axis

Conserves payload reference and support class.

Initial fields:

```text
payload_kind
payload_ref
```

The full support body remains in the object body store unless retention law explicitly requires embedded duplication.

The local axis field `payload_ref` is a typed handle on the node. A graph `payload_ref` edge is a declared relation between the committed memory node and the support object identity. The field and the edge may carry the same target, but they have different roles:

```text
axis field = local typed handle
edge       = graph-declared relation
```

### Provenance Axis

Conserves derivation source and operator lineage.

Initial fields:

```text
source_refs
operator_id
operator_version
```

### Policy Axis

Conserves relevant policy anchors.

Initial fields are copied or projected from the admitted `MemoryObject.policy_refs`.

### Continuity Axis

Conserves admission and non-claim posture.

Initial fields:

```text
admission_mode
continuity constraints
explicit non-claims
```

## Layer 1 Edges

Layer 1 edges should be minimal and declared. Do not materialize shared metadata as edges until needed.

Initial required edge candidates:

```text
temporal_next
payload_ref
merge_lineage_ref
```

### temporal_next

Connects one committed memory node to the next committed memory node along the same relevant temporal stream/order.

This edge expresses temporal adjacency, not sameness, not identity closure, and not continuity proof.

### payload_ref

Connects the committed memory node to the support object identity carried by the admitted envelope.

This edge may target `state_id` as an object-body-store ref rather than another Layer 1 graph node if support bodies are not separately represented as graph nodes.

### merge_lineage_ref

Connects an `M1` committed memory node to its merge input refs.

If a target is not present in the bounded graph state, it should remain an external ref, not an invented internal node.

## Edges to Avoid Initially

Avoid materializing the following as Layer 1 edges at first:

```text
same_stream
same_segment
same_policy
same_operator
same_source_family
```

These are derivable from node axes. They may later be materialized by Layer 2 relation derivation or Layer 3 indexing if useful.

## Ledger and Graph State

The ledger and graph state are distinct.

```text
Graph ledger = append-only history of lawful graph mutations.
Graph state  = current topology derived from ledger events.
```

The ledger records how nodes and edges were admitted. The graph state exposes the current relation topology.

Example ledger event:

```json
{
  "event_type": "commit_committed_memory_node",
  "event_index": 12,
  "node_id": "MO:H1:...",
  "memory_object_id": "MO:H1:...",
  "state_id": "H1:...",
  "edges_added": [
    {
      "edge_type": "payload_ref",
      "from": "MO:H1:...",
      "to": "H1:..."
    },
    {
      "edge_type": "temporal_next",
      "from": "MO:H1:previous",
      "to": "MO:H1:current"
    }
  ]
}
```

## Object Body Store vs Graph Ledger

The object body store, graph ledger, graph state, and index layer should not compete.

The object body store holds payload bodies:

```text
H1 / M1 support objects
MemoryObject envelopes
Basin objects, when derived
Other emitted object bodies, later
```

The graph ledger holds graph mutation history:

```text
node admission events
edge admission events
mutation order
replay/audit sequence
```

The graph state holds conserved graph exposure:

```text
node identity
node axes
declared edges
relation topology
```

This avoids duplicating payload truth while still giving the graph enough structure for geometric derivation.

## Raw Payload Boundary

Layer 1 graph nodes should not blindly embed full raw support payloads.

They should carry minimal exposed structure required for lawful geometry:

```text
signature vector
signature basis
energy scalar
confidence scalar
temporal coordinate
payload ref
policy / provenance / continuity posture
```

The full support body remains available by reference through the object body store and through direct support read paths where those paths are already lawful.

This keeps the graph meaningful without turning every node into a duplicated payload blob.

## Layer 2 Derivation

Layer 2 derives emergent relationships over Layer 1 nodes.

Candidate Layer 2 relation families:

```text
structural_similarity
basin_membership
dwell
recurrence
transition
interference
drift
lineage_convergence
```

Layer 2 should consume Layer 1 node axes and edges, not loose H1/M1 arrays.

## Basin / Neighborhood Model

Basins and neighborhoods should be derived from the graph floor.

A basin can be represented as:

```text
BasinNode + basin_membership edges
```

The basin node summarizes the region. The membership edges define the region.

This avoids treating basin objects as pseudo-canonical truth floating outside the graph.

Example:

```json
{
  "node_type": "BasinNode",
  "node_id": "BN:...",
  "layer": "L2",
  "summary_posture": "derived_region_summary"
}
```

```json
{
  "edge_type": "basin_membership",
  "from": "MO:H1:...",
  "to": "BN:...",
  "layer": "L2",
  "distance": 0.04,
  "derived_by": "BasinOp"
}
```

## Emergence Principle

Layer 1 conserves exposed invariance.

Layer 2 detects emergent relations.

Layer 3 packages access.

This preserves the difference between:

```text
conserved substrate identity
emergent relation structure
efficient transport surface
```

## Non-Claims

The graphical substrate does not claim:

```text
canon
truth closure
same-object closure
identity closure
raw restoration
prediction authority
LM authority
index authority
```

Layer 1 graph authority is exposure-substrate authority only. It is not canon authority.

## Implementation Order

Recommended order:

```text
1. Stabilize MemoryObject admission seam.
2. Preserve downstream state-first behavior.
3. Thread memory_object_id through trajectory metadata.
4. Define CommittedMemoryNode target and graph ledger law.
5. Implement minimal GraphLedger as append-only node/edge admission history.
6. Expose bounded graph state/views from the ledger.
7. Derive Layer 2 neighborhoods/basins from Layer 1 graph nodes and edges.
8. Let Layer 3 index/LM/UI consume bounded graph views and cards.
```

Do not implement LM/workbench transport projections before the graph ledger boundary is clear, unless explicitly labeled as temporary read-side packaging.

## First Implementation Target

The first graph implementation should be minimal:

```text
SubstrateGraphLedger
- nodes: Map<memory_object_id, CommittedMemoryNode>
- edges: Map<edge_id, GraphEdge>
- ledger_events: GraphLedgerEvent[]
- commitCommittedMemoryNode(memoryObject, trajectoryCoordinate, supportState)
- graphStateView(opts)
```

First commit-time graph write should admit:

```text
one CommittedMemoryNode
payload_ref edge
temporal_next edge if prior node exists
merge_lineage_ref edges for M1 where available
one ledger event documenting the mutation
```

## Open Design Questions

These remain intentionally open:

```text
1. Should support states ever become separate Layer 1 graph nodes, or remain object-body refs?
2. Should signatures eventually become child nodes once multiple signature families exist?
3. What is the minimum structure vector for non-audio source families?
4. How should cross-source temporal adjacency be represented?
5. When should same_stream / same_segment become materialized edges instead of axis filters?
6. Should GraphLedger be replay-only derived state, or persisted alongside object stores?
7. How much of MemoryObject.payload should remain embedded once object body refs are stable?
```

## Compression

The target architecture is:

```text
MemoryObject -> CommittedMemoryNode -> GraphLedger -> GraphState -> Layer 2 emergent relations -> Layer 3 index/cards
```

One admitted memory envelope becomes one layered graph node.

The node conserves trajectory, structure, support, provenance, policy, and continuity axes.

Edges declare lawful relations between committed nodes.

The ledger records graph mutation history.

The graph state exposes current topology.

Layer 2 derives emergent neighborhoods and relations.

Layer 3 packages views, cards, queries, LM packets, and UI transport.
