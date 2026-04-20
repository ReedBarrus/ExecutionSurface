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

## Distributed Authority

The substrate does not have one single authority surface.

Its authority is distributed across distinct functional layers that must not be
collapsed into each other.

```text
Support object / object body store
  = payload substance authority

MemoryObject envelope
  = admission and persistence authority

Graph ledger
  = mutation-history authority

Layer 1 graph state
  = exposed temporal / relational topology authority

Layer 2 relation state
  = derived emergent relation authority

Layer 3 transport/index/card surfaces
  = access and packaging only
```

Plainly:

- the support object says what structural support was produced
- the `MemoryObject` says what admitted memory envelope now carries it
- the graph ledger says what node and edge mutations happened in what order
- Layer 1 graph state says how admitted memory events are exposed in time and
  relation
- Layer 2 says what neighborhoods, basins, recurrence, drift, and interference
  are derived over that exposed topology
- Layer 3 says how bounded consumers inspect or transport the result

Layer 1 is therefore not merely read-side packaging.

It is the authoritative exposure floor for temporal and relational topology,
while the object body store remains authoritative for payload substance and the
graph ledger remains authoritative for mutation history.

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
MemoryObject      = admission / persistence envelope
Graph ledger      = append-only mutation history
Graph state       = relation / topology / continuity floor
Layer 2 state     = derived emergent relation structure
Index layer       = retrieval / packaging / access
```

The current separate runtime structures may remain as transitional scaffolding until the graph floor is explicitly implemented.

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

## Execution Posture

This document is not the execution order authority.

Execution sequencing, current rung, and phase exit conditions belong to:

```text
README.ExecutionSurfaceImplementationLadder.md
README.ExecutionSurfaceGraphicalSubstrateDevelopmentPlan.md
```

This document should stay focused on substrate target shape, authority split,
and conserved identity structure rather than duplicating implementation order.

Layer 1 graph exposure is not a decorative projection over a more real
substrate elsewhere. It is the authoritative exposure floor for committed
temporal and relational topology, while the object body store preserves payload
substance and Layer 3 handles transport/index packaging.

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

## Implementation Ladder V2 And Current-State Audit

This section freezes the current development read on the graphical substrate
path so implementation can proceed against one explicit ladder instead of
incremental seam memory.

It does not replace the runtime grammar corpus.

It does replace the older workflow-object implementation assumption for the
graphical substrate path.

Detailed phase-by-phase execution planning now lives in:

- `pressure_generation/architecture/README.ExecutionSurfaceGraphicalSubstrateDevelopmentPlan.md`

### Current Landed State

The current repo reality is:

```text
MemoryObject admission seam: landed
MemoryObject payload parity with H1/M1: tested
Trajectory metadata carries memory_object_id: landed
Layer 1 CommittedMemoryNode graph ledger: landed
Layer 1 graphStateView(): landed
Orchestrator/workbench Layer 1 graph_state_view exposure: landed
Layer 2 structural_similarity derived relations: landed
Layer 2 derived relation reads: landed
Layer 2 orchestrator/workbench inspection: not landed
Layer 2 basin/neighborhood graph derivation: not landed
Layer 2 dwell/recurrence/transition graph derivation: not landed
Layer 3 corpus/index/cards/LM transport: not landed
Temporal axis cleanup: not landed
Legacy TrajectoryBuffer/BasinOp path: still active compatibility scaffold
```

### Three Conserved Identity Families

The substrate-first ladder now freezes three conserved identity families by
name.

#### 1. Amplitude / Absolute Energy Identity

Conserved through `energy_raw` and amplitude-bearing metrics.

This identity family preserves magnitude-bearing distinction and must remain
attributable as its own channel.

#### 2. Spectral Distribution Identity

Conserved through `band_profile_norm.band_energy` and
`CommittedMemoryNode.axes.structure.vector`.

This identity family preserves frequency/shape distribution and must remain
attributable as its own channel.

#### 3. Placement-Sensitive Structural Identity

This is the support-horizon resonance / band-boundary harmonic placement /
finite amplitude splitting-window behavior identified in harmonic-placement
probes.

It currently exists as probe knowledge and basin-splitting law, not yet as a
first-class runtime channel.

It must be admitted deliberately later as either:

- a Layer 2 relation family, or
- an explicit structure-axis contract that later Layer 2 relations can consume

#### Identity non-fusion rule

No derived relation may fuse these identities into one authoritative score.

Summaries may exist later only as Layer 3 routing conveniences.

### Authority Split

The current authority split should be treated as:

#### Object body store

Holds:

```text
H1 / M1 support payloads
MemoryObject envelopes
```

#### Layer 1 graph floor

Holds:

```text
CommittedMemoryNode records
Layer 1 graph edges
graph ledger events
graphStateView()
```

#### Layer 2 emergent relation layer

Holds:

```text
structural_similarity edges now
later basin membership
later recurrence
later dwell
later transition
later drift
later interference
later placement-sensitive relation families
```

#### Layer 3 corpus / index / transport

Future home of:

```text
cards
compact packets
LM-safe transport
UI indexes
query acceleration
```

#### Legacy compatibility scaffold

The following remain active compatibility scaffolds until graph-native
replacements are explicitly admitted and tested:

```text
TrajectoryBuffer basin / dwell / recurrence / transition reports
BasinOp state-first path
```

### End-State Target

The intended end-state is:

```text
MemoryObject = singular commit-boundary object
H1 / M1      = direct support payload truth
Layer 1      = authoritative exposure graph floor
Layer 2      = graph-native derived neighborhood / comparison / recurrence layer
Layer 3      = subordinate corpus / index / transport layer
```

This means:

- direct support truth remains reachable
- `MemoryObject` remains the admitted continuity-bearing envelope
- Layer 1 preserves node/edge/continuity truth
- Layer 2 derives organization without replacing Layer 1
- Layer 3 packages access without replacing lower-layer truth

### Ladder V2

#### Phase 0 - Landed Substrate Foundation

Landed:

- `MemoryObject` admission
- `MemoryObject` parity tests
- Layer 1 `CommittedMemoryNode` graph ledger
- Layer 1 graph state inspection
- Layer 2 `structural_similarity` derivation

#### Phase 1 - Stabilize Layer Boundaries And Temporal Axis

Targets:

- define `temporal_axis_v1`
- decide whether `TrajectoryBuffer` remains compatibility scaffold or is reduced
  to append/order mechanics
- align `CommittedMemoryNode.axes.trajectory` with `temporal_axis_v1`
- classify `TrajectoryBuffer` dwell/transition/recurrence reports as legacy
  Layer 2 observational scaffolding until replaced
- do not delete compatibility APIs until replacement coverage exists

#### Phase 2 - Layer 2 Inspection Exposure

Targets:

- expose bounded Layer 2 derived relation inspection beside `graph_state_view`
- keep `graphStateView()` Layer 1 only by default
- do not feed Layer 2 to LM/cards/index yet

#### Phase 3 - Graph-Native Basin / Neighborhood Contract

Targets:

- define `BasinNode` and `basin_membership` edges as Layer 2 derived structure
- derive basin membership from Layer 1 node structure axes and Layer 2
  similarity relations
- preserve all three identity families
- keep old `BasinOp` behavior as compatibility until graph-native basin parity
  is tested

#### Phase 4 - Graph-Native Dwell / Recurrence / Transition

Targets:

- derive dwell, recurrence, and transition from `temporal_axis_v1` plus Layer 2
  relations
- preserve two-channel and placement-sensitive identity attribution
- do not promote recurrence into same-object closure

#### Phase 5 - Comparison / Query / Reconstruction Rebase

Targets:

- comparison uses declared comparison bases
- query becomes `MemoryObject` / Layer 1 / Layer 2 aware while preserving
  direct support truth
- reconstruction becomes `MemoryObject`-lens-first with lineage and support
  refs as lawful basis

#### Phase 6 - Layer 3 Corpus / Index / Cards

Targets:

- introduce compact cards only after Layer 2 graph-native relations justify
  packaging
- cards point back to Layer 1/2 refs
- cards are access surfaces, not substrate authority

#### Phase 7 - LM / Workbench Transport

Targets:

- LM transport consumes Layer 3 packets only after index/card posture is
  explicit
- LM must not consume raw Layer 1/2 graph state as interpretive authority

### Transition / Deprecation Ledger

| Structure | Current role | Target role | Status | Exit condition |
| --- | --- | --- | --- | --- |
| `_states` | object body store for `H1` / `M1` | retained support body store | authoritative | keep direct support truth |
| `_memoryObjects` | admitted persistence envelopes | commit-boundary object store | authoritative | add validator/schema |
| `_graphNodesById` | Layer 1 graph nodes | retained graph floor | authoritative | keep |
| `_graphEdgesById` | Layer 1 declared edges | retained graph floor | authoritative | keep |
| `_graphDerivedEdgesById` | Layer 2 derived relations | emergent relation store | partial authoritative for Layer 2 | expand relation families |
| `_trajectory` | temporal coordinate + legacy dynamics scaffold | temporal axis / compatibility scaffold | transitional | replace dwell/recurrence/transition with graph-native relations |
| `_basins` | state-first basin compatibility | graph-native `BasinNode` / membership later | legacy/transitional | parity with graph-native basin layer |
| `BasinOp` | state-first basin derivation | compatibility or graph-native adapter later | legacy/transitional | graph-native basin parity |
| `WorkbenchLmWrapper` | LM transport | Layer 3 consumer only | hold | no widening before Layer 3 |

### Development Rules

The active rules are:

- no new read-side packaging until its substrate home layer is named
- no new receipt-like transport unless it is explicitly Layer 3 and explicitly
  temporary or permanent
- no widening LM transport before Layer 2 basin/recurrence structure is settled
- no new identity fusion

Every implementation packet must name:

- target layer
- target function
- identity family touched
- transitional structure introduced
- exit condition for that transition

### Next Recommended Move

Next recommended move:

```text
Phase 1 - Stabilize Layer Boundaries And Temporal Axis
```

Reason:

Layer 1 and Layer 2 are now real enough that the old trajectory/basin scaffold
must be classified before additional exposure, index, or basin derivation work
continues.
