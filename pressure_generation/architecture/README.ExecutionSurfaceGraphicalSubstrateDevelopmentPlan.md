# ExecutionSurface Graphical Substrate Development Plan

## Status

This document is the high-resolution development plan for the graphical
substrate path.

It exists to keep the phase plan explicit and durable so implementation does
not drift into local patching without a shared end-state map.

It is subordinate to:

- `GraphicalSubstrateEmergence.md`
- `pressure_generation/architecture/README.ExecutionSurfaceSubstrateMeltdown.md`
- `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceRuntimeObjectGrammar.md`
- `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceMemoryObjectEnvelope.md`
- `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceSubstrateTopology.md`
- `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceSubstrateFunctionLedger.md`

## Purpose

This file answers:

- what is already landed
- what each remaining phase is trying to stabilize
- what each phase is allowed to widen
- what each phase must explicitly avoid
- what evidence is needed before moving up the ladder

`GraphicalSubstrateEmergence.md` remains the conceptual target.

This document is the execution-grade plan.

It now assumes the meltdown cut line is already declared and that clean runtime
construction proceeds from the substrate spine rather than by preserving older
runtime surfaces above that line.

## Distributed Authority Goal

The implementation target is not a single authority surface.

It is a functioning distributed authority split:

```text
support object / object body store
  = payload substance authority

MemoryObject
  = admission authority

graph ledger
  = mutation-history authority

Layer 1 graph state
  = exposed temporal / relational topology authority

Layer 2 relation state
  = emergent relation authority

Layer 3 transport/index/cards
  = access and packaging only
```

The plan should therefore avoid two opposite failures:

- collapsing graph topology back into raw state arrays and reports
- inflating Layer 3 packets into substrate authority

## Planning Split

Use the current doc split as:

```text
GraphicalSubstrateEmergence.md
  = architecture target, authority split, conserved identity families,
    transition ledger, phase summary

README.ExecutionSurfaceImplementationLadder.md
  = active operational tracker, current rung, blocked rungs,
    packet requirements

README.ExecutionSurfaceGraphicalSubstrateDevelopmentPlan.md
  = detailed phase plan, acceptance targets, scope locks,
    and exit conditions
```

## Frozen Identity Posture

The current plan freezes three conserved identity families:

1. `amplitude / absolute energy identity`
2. `spectral distribution identity`
3. `placement-sensitive structural identity`

These identities must remain attributable.

They must not be fused into one authoritative similarity or recurrence score.

Any future summary scalar is Layer 3 convenience only.

## Meltdown Cut Line

The meltdown cut line is drawn at the new Layer 1 / Layer 2 substrate spine.

Below the line, selected concepts may be conserved by explicit admission.

Above the line, old runtime surfaces are non-authoritative by default.

No old module, function, field, view, or transport surface survives by
inertia.

Any surviving component must be re-admitted by contract.

## Conserved Spine

The conserved spine for clean construction is:

1. lawful `H1` / `M1` support payload outputs, where still valid as
   support-body inputs
2. `MemoryObject` as the commit-boundary persistence envelope
3. `temporal_axis_v1` as the Layer 1 temporal coordinate
4. `CommittedMemoryNode` as the graph-native exposure of an admitted
   `MemoryObject`
5. Layer 1 graph / hypergraph ledger:
   - committed nodes
   - declared Layer 1 edges
   - append-only ledger events
6. Layer 2 derived relation ledger:
   - `structural_similarity` now
   - later graph-native basin, dwell, recurrence, transition, drift,
     interference
7. frozen identity families:
   - amplitude / absolute energy identity
   - spectral distribution identity
   - placement-sensitive structural identity

## Melted / Non-Authoritative Surfaces

Melted above the substrate line for the new runtime:

- old `DoorOneOrchestrator` assumptions
- old `DoorOneWorkbench` assumptions
- old `WorkbenchLmWrapper` assumptions
- old `QueryOp` target assumptions
- old `ProvenanceReconstructionPipeline` target assumptions
- old `TrajectoryBuffer` as authority object
- old `BasinOp` as target basin architecture
- state-array-first query as target design
- any support replay path that bypasses `MemoryObject` lenses
- LM transport before Layer 3
- receipt/card/package surfaces that are not explicitly Layer 3

These may remain in the repo temporarily as reference or compatibility code.

They are not the target runtime and may not define future substrate
architecture.

## New Runtime Construction Spine

Clean runtime construction begins from:

1. admit support payload
2. mint `MemoryObject`
3. mint `temporal_axis_v1` in a real `TemporalAxisLedger`
4. mint `CommittedMemoryNode` in the Layer 1 graph / hypergraph ledger
5. admit Layer 1 edges:
   - `payload_ref`
   - `temporal_next`
   - `merge_lineage_ref`
6. derive Layer 2 `structural_similarity`
7. stop

No orchestrator, workbench, query, support replay, basin, recurrence, cards,
index, or LM transport enters the clean runtime until re-admitted by contract.

## Re-Admission Test

Every old component must pass this test before entering the new runtime:

1. What target layer does it belong to?
2. What target function does it perform?
3. Which conserved identity families does it touch?
4. What authority does it claim?
5. What old assumptions does it carry?
6. What is its clean replacement shape?
7. What tests prove it does not preserve semantic inflation?
8. What is its exit condition if transitional?

If any answer is unclear, the component remains outside the clean runtime.

## Project Placement

Default placement:

Create a clean construction lane inside the current repo rather than starting a
new repo immediately.

Candidate directory:

- `hypergraph_runtime/`

This lane must not import old orchestrator, workbench, query, support replay,
trajectory, basin, card, or LM modules by default.

A new repository is only justified if current repo topology blocks clean
construction.

## Meltdown Phase 0 - Freeze Cut Line And Construction Spine

### Purpose

Freeze the cut line so future implementation packets stop assuming older
runtime surfaces survive above the substrate spine by default.

### Deliverables

- explicit meltdown declaration
- conserved spine declaration
- melted surface declaration
- re-admission test
- clean placement rule for the new runtime lane

### Acceptance

- the cut line is explicit
- old surfaces above the substrate line are non-authoritative by default
- the clean construction spine is explicit
- future work is routed through a clean construction lane inside the current
  repo

## Meltdown Phase 1 - Create Clean Hypergraph Runtime Lane

### Purpose

Start a clean construction lane without importing old runtime surfaces by
default.

### Deliverables

- `hypergraph_runtime/`
- empty admitted spine modules
- empty admitted spine tests

### First runtime target

- `TemporalAxisLedger`
- `MemoryObjectStore`
- `HypergraphLedger`
- `DerivedRelationLedger`
- minimal commit path:
  `support payload -> MemoryObject -> temporal axis -> CommittedMemoryNode -> L1 edges -> L2 structural_similarity`

### Acceptance

- the lane exists inside the current repo
- the lane does not import old orchestrator, workbench, query, support replay,
  trajectory, basin, card, or LM modules by default
- the minimal conserved spine can be built and tested independently

## Current Foundation Snapshot

The graphical substrate path already has:

- `MemoryObject` admission for `analog_signal`
- `MemoryObject` payload parity with direct `H1` / `M1`
- `memory_object_id` threaded into trajectory metadata
- Layer 1 `CommittedMemoryNode` graph ledger
- Layer 1 `graphStateView()`
- orchestrator/workbench exposure of Layer 1 `graph_state_view`
- Layer 2 `structural_similarity` derivation
- Layer 2 derived relation read surfaces

The path does not yet have:

- `temporal_axis_v1`
- Layer 2 inspection exposure outside direct substrate reads
- graph-native basin membership
- graph-native dwell / recurrence / transition relations
- placement-sensitive structural identity as a declared runtime channel
- Layer 3 corpus/index/cards
- LM transport rebased onto Layer 3 packets

## Development Rules

- No new read-side packaging until its substrate home layer is named.
- No new receipt-like transport unless it is explicitly Layer 3.
- No widening LM transport before Layer 2 basin/recurrence structure is
  stabilized.
- No new identity fusion.
- No compatibility scaffold may remain indefinitely without an exit condition.
- No authority surface may silently absorb another authority role by
  convenience.

Every implementation packet should name:

- target phase
- target layer
- target function
- identity family touched
- authority surface being advanced
- transitional structure introduced
- exit condition for that transition

## Phase 1 - Stabilize Layer Boundaries And Temporal Axis

### Purpose

Freeze the temporal contract that the rest of the graph-native work will rely
on.

This phase exists because Layer 1 and first-pass Layer 2 are already real, but
temporal structure is still split across graph nodes, trajectory frames, and
legacy reporting scaffolds without one declared substrate contract.

### Main questions

- What exactly is `temporal_axis_v1`?
- Which trajectory fields are authoritative for graph placement?
- Is `TrajectoryBuffer` a long-lived compatibility scaffold, or should it be
  reduced to append/order mechanics only?
- Which current dwell/transition/recurrence outputs are legacy observational
  scaffolds rather than future substrate law?

### In scope

- define `temporal_axis_v1`
- classify trajectory coordinate fields and ordering rules
- define the relationship between `CommittedMemoryNode.axes.trajectory` and
  `TrajectoryBuffer`
- classify current trajectory/basin observational reports as transitional
  Layer 2 scaffolds
- define the compatibility retention rule for existing trajectory APIs

### Not in scope

- Layer 2 inspection transport
- graph-native basin membership
- graph-native recurrence or dwell relations
- Layer 3 packets
- LM transport widening

### Deliverables

- `temporal_axis_v1` contract doc
- trajectory-to-graph authority note
- compatibility scaffold classification note
- explicit keep/reduce decision for `TrajectoryBuffer`
- ordering authority note for `frame_index`, graph commit order, and ledger
  event order

### Acceptance

- every temporal field needed by Layer 1 and future Layer 2 is named
- graph recency/order rules are explicit
- `TrajectoryBuffer` is classified as either compatibility scaffold or durable
  append/order primitive
- the relationship between trajectory ordering, graph commit order, and ledger
  mutation order is explicit
- no implementation packet after Phase 1 needs to guess which temporal surface
  is authoritative

### Exit condition

Phase 1 is complete when future graph-native dwell/recurrence/transition work
can cite `temporal_axis_v1` instead of reading temporal law from scattered
tests and current behavior, and when temporal ordering no longer has to be
inferred from multiple competing runtime surfaces.

## Phase 2 - Layer 2 Inspection Exposure

### Purpose

Expose bounded read-side inspection of derived Layer 2 relations without
promoting them into transport authority or mixing them into Layer 1 by default.

### Main questions

- What is the smallest lawful Layer 2 inspection surface?
- How should Layer 2 be visible beside Layer 1 without collapsing them into one
  graph packet?
- What bounded view shape will survive later basin and recurrence expansion?

### In scope

- bounded Layer 2 read-side inspection surface
- default separation between Layer 1 `graphStateView()` and Layer 2 relation
  inspection
- deterministic filtering and mutation-safe reads for Layer 2 relation views

### Not in scope

- LM transport
- cards
- index packaging
- basin derivation
- recurrence derivation

### Deliverables

- Layer 2 relation inspection contract
- bounded read-side API or view shape
- tests proving Layer 1 remains default and Layer 2 remains explicit

### Acceptance

- Layer 2 relations can be inspected without reading private substrate state
- `graphStateView()` remains Layer 1 only by default
- no Layer 2 inspection packet includes raw payload bodies

### Exit condition

Phase 2 is complete when later basin or recurrence relation families can land
without inventing a new inspection seam each time.

## Phase 3 - Graph-Native Basin / Neighborhood Contract

### Purpose

Move basin/neighborhood structure from legacy state-first compatibility
behavior toward explicit Layer 2 graph-native organization over Layer 1 nodes.

### Main questions

- What is the minimal lawful `BasinNode` shape?
- How should `basin_membership` be derived from Layer 1 axes and existing
  similarity structure?
- How does placement-sensitive structural identity participate in basin
  formation?
- What parity evidence is required before older `BasinOp` behavior can be
  downgraded to compatibility?

### In scope

- `BasinNode` contract
- `basin_membership` edge contract
- graph-native neighborhood derivation basis
- parity criteria against current `BasinOp`

### Not in scope

- LM transport
- cards
- Layer 3 indexing
- full recurrence/transition derivation

### Deliverables

- graph-native basin contract doc
- basin parity plan against `BasinOp`
- derivation basis note showing how all three identity families are preserved

### Acceptance

- basin structure is defined as Layer 2 derived organization over Layer 1
- all three conserved identity families are accounted for
- old `BasinOp` can be named explicitly as compatibility or adapter behavior

### Exit condition

Phase 3 is complete when graph-native basin behavior has a declared contract
strong enough to test parity against the old state-first path.

## Phase 4 - Graph-Native Dwell / Recurrence / Transition

### Purpose

Derive temporal-neighborhood structure from the declared temporal axis and
graph-native Layer 2 relations rather than from legacy trajectory summaries
alone.

### Main questions

- What is the minimal relation vocabulary for dwell, recurrence, and transition?
- How does recurrence avoid becoming same-object closure?
- How does placement-sensitive identity influence recurrence or transition
  interpretation?

### In scope

- dwell relation contract
- recurrence relation contract
- transition relation contract
- relation derivation over `temporal_axis_v1` plus Layer 2 organization

### Not in scope

- Layer 3 packaging
- LM transport
- canon or identity closure

### Deliverables

- graph-native dwell/recurrence/transition contract
- explicit non-claims for recurrence and transition semantics
- parity/deprecation note for old trajectory observational reports

### Acceptance

- dwell, recurrence, and transition are defined as graph-native derived
  relations
- recurrence remains below same-object closure
- legacy observational summaries can be clearly marked as compatibility outputs

### Exit condition

Phase 4 is complete when future recurrence or transition features no longer
need to route through `TrajectoryBuffer` reporting as the primary semantic
home.

## Phase 5 - Comparison / Query / Lens-Bound Replay Admission

### Purpose

Re-admit comparison, query, and support replay around declared substrate
relations and admitted `MemoryObject` structure without losing direct support
truth.

### Main questions

- What comparison bases are declared and stable?
- How should query consult Layer 1/2 relations without replacing direct H1/M1
  truth?
- How should support replay become `MemoryObject`-lens-first while remaining
  support-trace bounded?

### In scope

- declared comparison-basis contracts
- query posture against `MemoryObject`, Layer 1, and Layer 2
- support-replay lens posture over memory objects, lineage, and support refs
- compatibility policy for older state-corpus-first query behavior

### Not in scope

- Layer 3 cards or index transport
- LM graph transport
- canon/promotion semantics

### Deliverables

- comparison basis contract
- query rebase contract
- support-replay re-admission contract

### Acceptance

- comparison uses declared bases rather than ad hoc runtime convenience
- query can name how it consults substrate layers
- support replay can cite admitted memory and declared lenses as its lawful
  basis

### Exit condition

Phase 5 is complete when comparison/query/support replay can be described as
substrate-supported functions over admitted memory and derived relations rather
than as detached read-side utilities.

## Phase 6 - Layer 3 Corpus / Index / Cards

### Purpose

Introduce practical access packaging only after Layer 1 and Layer 2 relations
are stable enough to justify a subordinate access layer.

### Main questions

- What typed addresses belong to Layer 3?
- What is the minimal lawful card shape?
- Which access surfaces are permanent and which are temporary routing aids?

### In scope

- index/address contract
- retrieval scopes
- bounded cards or compact graph excerpts
- query acceleration surfaces

### Not in scope

- LM transport widening before Layer 3 packet posture is explicit
- replacing Layer 1/2 truth with cards or index entries

### Deliverables

- Layer 3 addressability contract
- card/access packet contract
- explicit ref-back rules from cards to Layer 1/2 objects

### Acceptance

- cards are clearly subordinate access surfaces
- every card or compact packet points back to Layer 1/2 refs
- Layer 3 cannot be mistaken for substrate authority

### Exit condition

Phase 6 is complete when access/index/card surfaces are practical without
becoming a shadow ontology or shadow runtime.

## Phase 7 - LM / Workbench Transport

### Purpose

Retune LM and workbench transport so they consume deliberate Layer 3 packets
instead of half-formed substrate summaries or direct graph state as authority.

### Main questions

- What Layer 3 packet is lawful for LM transport?
- What is the smallest useful workbench inspection packet once Layer 3 exists?
- Which direct object refs should remain available to humans but not be routed
  into LM transport?

### In scope

- LM-safe Layer 3 packet contract
- workbench transport alignment with Layer 3
- explicit read-only, non-authoritative posture for all LM packet fields

### Not in scope

- direct LM consumption of raw Layer 1/2 graph state as interpretive authority
- writeback into substrate or memory

## Phase 8 - Graph / Envelope Hardening

### Purpose

Freeze the post-movement contracts for admitted memory envelopes, Layer 1 graph
nodes, graph ledger events, and Layer 2 derived relation events so the
substrate can keep moving without silent shape drift becoming hidden runtime
law.

This phase comes after the main movement/relation work because the target
shapes need to stabilize through implementation before they are worth locking
down formally.

### Main questions

- What envelope fields are now durable runtime contract rather than transitional
  convenience?
- What `CommittedMemoryNode` axes and edge shapes are now frozen enough for
  validators?
- What graph ledger and derived-relation event fields are mandatory for replay,
  audit, and mutation-safe inspection?
- Which transitional compatibility fields can remain loose, and which must be
  made explicit?

### In scope

- `MemoryObject` validation surface
- `CommittedMemoryNode` validation surface
- Layer 1 graph edge validation surface
- graph ledger event validation surface
- Layer 2 derived relation edge/event validation surface
- ordering consistency validation across trajectory, graph state, and ledger
  history
- tests proving validation rejects malformed graph/envelope mutations cleanly

### Not in scope

- new Layer 3 transport surfaces
- new LM transport widening
- canon/promotion semantics
- graph database redesign

### Deliverables

- envelope hardening contract
- Layer 1 graph node/edge hardening contract
- graph ledger event hardening contract
- Layer 2 derived relation hardening contract
- focused validator tests

### Acceptance

- malformed admitted envelopes fail closed
- malformed Layer 1 nodes or edges fail closed
- malformed ledger events fail closed
- malformed Layer 2 derived relations fail closed
- ordering drift between trajectory, graph commit order, and ledger history is
  detectable
- the hardened shapes match the implemented substrate rather than an outdated
  projection

### Exit condition

Phase 8 is complete when graph/envelope mutation shape is explicit enough that
future work can extend the substrate without silently changing committed memory,
graph exposure, or derived relation contracts by convenience.

### Deliverables

- Layer 3 LM packet contract
- workbench Layer 3 transport note
- explicit forbidden-authority language for LM consumers

### Acceptance

- LM transport reads Layer 3 packets only
- packet fields are explicitly bounded and non-authoritative
- no raw graph-state packet is being treated as model-facing truth authority

### Exit condition

Phase 7 is complete when LM/workbench transport can be widened or refined
without reopening Layer 1/2 authority questions.

## Immediate Recommendation

The next recommended move is now:

```text
Create the clean construction lane and build only the minimal conserved spine.
```

That move should be developed against this file and
`README.ExecutionSurfaceSubstrateMeltdown.md` rather than by widening old
runtime surfaces above the cut line.
