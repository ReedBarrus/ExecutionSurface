# ExecutionSurface Implementation Ladder

## Status

This ladder supersedes the older workflow-object implementation assumption for
the graphical substrate path.

It is now an operational tracker rather than a second architecture narrative.

Conceptual authority:

- `GraphicalSubstrateEmergence.md`
- `pressure_generation/architecture/README.ExecutionSurfaceGraphicalSubstrateDevelopmentPlan.md`
- `pressure_generation/architecture/README.ExecutionSurfaceSubstrateMeltdown.md`

Supporting runtime grammar:

- `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceRuntimeObjectGrammar.md`
- `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceMemoryObjectEnvelope.md`
- `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceSubstrateTopology.md`
- `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceSubstrateFunctionLedger.md`

## Distributed Authority Reminder

The graphical substrate path is now trying to make a distributed authority
stack function in code, not merely describe it in prose.

```text
_states / object body store
  = payload substance

_memoryObjects
  = admitted persistence envelopes

_graphLedgerEvents
  = Layer 1 mutation history

_graphNodesById + _graphEdgesById
  = Layer 1 exposed topology

_graphDerivedEdgesById + _graphDerivedRelationEvents
  = Layer 2 emergent relation state and history

Layer 3 packets
  = access and transport only
```

The ladder should be read as the order for making that distributed authority
split function cleanly, not as a sequence for building more packaging.

## Active Rung

```text
Meltdown Phase 0 - Freeze cut line and construction spine
```

Current focus:

- declare the meltdown cut line
- name the conserved substrate spine
- mark old runtime surfaces above the substrate line as non-authoritative by
  default
- route the next build step into a clean construction lane inside the current
  repo

## Next Rung

```text
Meltdown Phase 1 - Create clean hypergraph runtime lane
```

## Landed Rungs

- `Phase 0 - Landed Substrate Foundation`

Phase 0 currently includes:

- `MemoryObject` admission
- `MemoryObject` parity tests
- Layer 1 `CommittedMemoryNode` graph ledger
- Layer 1 `graphStateView()`
- orchestrator/workbench Layer 1 `graph_state_view` exposure
- Layer 2 `structural_similarity` derivation
- Layer 2 derived relation reads

## Blocked / Deferred Rungs

Blocked:

- orchestrator rebuild
- workbench rebuild
- query rebuild
- support replay rebuild
- basin/neighborhood rebuild
- Layer 3 index/cards
- LM transport

These remain blocked until the clean Layer 1/2 spine is built and tested.

## Transition Ledger

This is the operational summary of the transition/deprecation ledger in
`GraphicalSubstrateEmergence.md`.

| Structure | Current role | Target role | Status | Exit condition |
| --- | --- | --- | --- | --- |
| `_states` | object body store for `H1` / `M1` | retained support body store | authoritative | keep direct support truth |
| `_memoryObjects` | admitted persistence envelopes | commit-boundary object store | authoritative | add validator/schema |
| `_graphLedgerEvents` | Layer 1 mutation history | retained graph mutation ledger | authoritative | keep explicit and validator-backed |
| `_graphNodesById` | Layer 1 graph nodes | retained graph floor | authoritative | keep |
| `_graphEdgesById` | Layer 1 declared edges | retained graph floor | authoritative | keep |
| `_graphDerivedEdgesById` | Layer 2 derived relations | emergent relation state | partial authoritative for Layer 2 | expand relation families |
| `_graphDerivedRelationEvents` | Layer 2 mutation history | derived relation ledger | authoritative for Layer 2 history | keep explicit and validator-backed |
| `_trajectory` | temporal coordinate + legacy dynamics scaffold | temporal axis / compatibility scaffold | transitional | replace dwell/recurrence/transition with graph-native relations |
| `_basins` | state-first basin compatibility | graph-native `BasinNode` / membership later | legacy/transitional | parity with graph-native basin layer |
| `BasinOp` | state-first basin derivation | compatibility or graph-native adapter later | legacy/transitional | graph-native basin parity |
| `WorkbenchLmWrapper` | LM transport | Layer 3 consumer only | hold | no widening before Layer 3 |

## Packet Requirements

Every future implementation packet must name:

- target layer
- target function
- identity family touched
- authority surface being changed
- transitional structure introduced
- exit condition for that transition

## Operational Rules

- no new read-side packaging until its substrate home layer is named
- no new receipt-like transport unless it is explicitly Layer 3 and explicitly
  temporary or permanent
- no widening LM transport before Layer 2 basin/recurrence structure is settled
- no new identity fusion

## Frozen Conserved Identity Families

The graphical substrate path currently freezes three conserved identity
families:

1. amplitude / absolute energy identity
2. spectral distribution identity
3. placement-sensitive structural identity

No implementation packet may fuse these into one authoritative score.

Any summary score, routing score, card score, or LM-facing compression must
preserve source attribution back to the relevant identity family and remain
non-authoritative unless explicitly promoted by later governance.

## Near-Term Sequence

```text
Meltdown Phase 0 - Freeze cut line and construction spine
Meltdown Phase 1 - Create clean hypergraph runtime lane
Phase 1 - Stabilize Layer Boundaries And Temporal Axis
Phase 2 - Layer 2 Inspection Exposure
Phase 3 - Graph-Native Basin / Neighborhood Contract
Phase 4 - Graph-Native Dwell / Recurrence / Transition
Phase 5 - Comparison / Query / Lens-Bound Replay Admission
Phase 6 - Layer 3 Corpus / Index / Cards
Phase 7 - LM / Workbench Transport
```

## Supersession Note

The older ladder language remains historically useful as background for how the
repo moved through earlier `MemoryObject` and topology work, but it is no
longer the active execution grammar for the graphical substrate path.
