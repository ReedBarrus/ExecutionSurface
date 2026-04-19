# ExecutionSurface Projection Ledger

Accessed and mutated @
https://github.com/ReedBarrus/ExecutionSurface

## Status

This document is the projection intake surface for `ExecutionSurface`.

It belongs to the live workflow band, but it is not runtime authority and it is
not implementation authority.

## Method posture

This surface belongs to:

- `Topology-First Architecture Pressure Generation`

Its role is to accept projection without granting projection authority.

## Purpose

The projection ledger exists so ideas can enter the process freely without
forcing immediate stabilization, implementation, or release.

Projection is allowed here.

Projection does not become authority here.

## Working rule

Every projection must be classified before it can move into the working lane.

Allowed statuses:

- `detected in runtime`
- `implementable against current runtime`
- `requires topology detection`
- `requires topology perturbation`
- `speculative / deferred`
- `anti-pattern / archive`

## Mutation contract

The projection ledger should be treated as a shared, append-only chain rather
than a free-edit note surface.

The ledger exists so later roles, especially `Auditor`, can inspect one
projection's working history without reconstructing it from scattered prose.

### Core mutation rule

Each projection entry should be opened once and then mutated only by bounded
role-local append blocks.

Do not silently rewrite prior role blocks once they have been appended.

If a later pass needs correction, append a correction block rather than
rewriting history.

## Repo-state protocol

This ledger should also act as the shared repo-state handoff surface for a
projection or subject moving across roles.

The live repo is upstream authority for current file and code reality.

Local thread context is helpful, but it is not authoritative when it conflicts
with the live repo.

Every serious role pass should therefore:

1. check in against live repo state before acting
2. append its role-local mutation block
3. check out by declaring what live state or bounded local mutation it is
   handing to the next role

### Minimum repo check-in fields

Each serious entry should carry, or append when missing:

- `live_repo_ref`
- `check_in_time`
- `active branch or working ref`
- `files or surfaces checked`
- `repo-state findings`
- `repo/local drift note`

### Minimum repo check-out fields

Each serious role block should end with:

- `check_out_time`
- `surfaces mutated or confirmed unchanged`
- `handoff state`
- `next role`
- `open repo-state risks`

### Working rule

If a role has not checked live repo state for the active seam, that role is not
ready to act.

If local notes and live repo state conflict, the role must append the conflict
and defer to live repo state rather than silently proceeding.

### Entry-level mutation authority

#### Administrator

May:

- open a new projection entry
- assign `projection_id`
- assign initial status
- set active seam or bounded scope
- anchor `live_repo_ref` for the entry
- require repo-state check-in before role action
- grant or deny non-ledger mutation authority
- record explicit mutation packet when non-ledger mutation is lawful
- route the entry into the working lane
- mark hold, defer, pivot, rebase, or archive

May ratify only:

- a mutation already inside the explicitly scoped packet surface
- a correction that narrows back to the declared surface

Post-hoc ratification must not silently convert broad ambient repo edits into
lawful bounded mutation.

If out-of-scope surfaces were touched, `Administrator` must classify them as:

- `quarantined mutation residue`
- `requires separate packet`
- `requires archive or revert review`

Must not:

- fabricate topology grounding for another role
- retroactively legalize global or multi-surface mutation pressure by fiat
- finalize a release judgment that belongs to `Auditor`

#### Detector

May append:

- repo check-in findings for the active seam
- runtime object or relation grounding
- required detection
- verification handle
- unknowns
- topology confidence or blockage notes

Must not:

- mutate implementation result fields
- mark release

#### Perturbator

May append:

- repo-checked challenge basis for the active seam
- required perturbation
- alternative topology pressure
- subject mis-aim risk
- lowest-lawful-layer challenge
- reasons to simplify, lower, defer, or delete

Must not:

- rewrite detection findings
- mark release

#### Mutator

May append:

- repo check-in on exact files or surfaces to be touched
- proposed bounded mutation
- implementation seam
- expected emitted object
- proof target
- observed implementation result if a real mutation occurred

By default, `Mutator` may mutate only:

- its own bounded block in the shared ledger entry

`Mutator` may touch non-ledger docs, contracts, or code only when the ledger
entry already contains an explicit administrator-granted mutation packet naming:

- active mutation surface
- exact files or bounded surfaces in scope
- expected emitted object
- mutation authority window
- next required auditor check

Must not:

- overwrite projection intake
- overwrite detection or perturbation findings
- mark release

#### Compressor

May append:

- repo-checked residue basis
- reduction result
- residue removed
- residue retained
- reasons compression was lawful or premature

Must not:

- compress before detection and perturbation are visible
- mark release

#### Auditor

May append:

- repo check-in for the final active seam state
- audit finding
- release or hold judgment
- authority ceiling judgment
- archive or defer recommendation
- final gate status

May also mutate these entry-level fields:

- `status`
- `defer/archive reason`

`Auditor` is the final gate on whether the projection leaves intake posture.

## Ledger entry template

Each entry should carry at minimum:

- `projection_id`
- `projection`
- `source`
- `desired function`
- `status`
- `live_repo_ref`
- `runtime object/relation grounding`
- `required detection`
- `required perturbation`
- `implementation seam`
- `defer/archive reason`

### Recommended role-append subblocks

Each entry should reserve room for:

- `administrator block`
- `detector block`
- `perturbator block`
- `mutator block`
- `compressor block`
- `auditor block`

Empty blocks are acceptable when a role has not yet acted.

Each populated block should include a bounded repo check-in and check-out note.

### Optional mutation packet

When non-ledger mutation is lawful, the ledger entry should carry an explicit
administrator-written mutation packet containing:

- `mutation_packet_id`
- `granted_to_role`
- `active mutation surface`
- `files or bounded surfaces in scope`
- `expected emitted object`
- `grant reason`
- `authority ceiling`
- `expires after handoff to`

The packet should also declare:

- `global mutation mode: false` by default
- `ratification ceiling`

Without that packet, the default rule is ledger-only mutation.

### Post-hoc ratification rule

If a role mutates outside the granted packet surface, `Administrator` may log
the event, quarantine it, or split it into new candidate entries.

`Administrator` may not simply bless those extra touches into lawful history
unless a broader mutation mode was declared in advance.

Default posture:

- no global mutation pressure
- no retroactive broad-surface legalization
- out-of-scope mutation becomes review residue, not success

## Gate to the working lane

A projection may move into the working lane only when:

1. a runtime or implementable topology candidate is named
2. a topology detection request exists or has already been satisfied
3. the idea has a bounded seam or subject scope

If those are missing, the projection remains here.

## Non-goals

This ledger does not:

- stabilize architecture by itself
- authorize implementation
- replace the subject registry
- replace topology detection
- replace perturbation

## Ledger entries

### Projection: Commit-Boundary Admission Basis for analog_signal

- `projection_id`: `PG-ANALOG-COMMIT-BOUNDARY-001`
- `projection`: record the lowered active topology for `analog_signal` commit-boundary admission.
- `source`: Administrator handoff after perturbation result.
- `desired function`: preserve direct `H1` / `M1` support-bearing payload as the lower active topology while keeping `MemoryObject` as projected commit-boundary candidate.
- `status`: `requires administrator mutation packet or auditor routing`
- `live_repo_ref`: `https://github.com/ReedBarrus/ExecutionSurface`
- `runtime object/relation grounding`: runtime chain map identifies `MemorySubstrate.commit(H1/M1)` as the current substrate commit boundary.
- `required detection`: satisfied by prior topology detection packet for `analog_signal -> H1 / M1 support-bearing payload -> projected MemoryObject admission envelope`.
- `required perturbation`: satisfied by prior perturbation result lowering active topology to direct `H1` / `M1`.
- `implementation seam`: proposed doc-only pressure-generation mutation across subject registry, implementation ladder, MemoryObject envelope, and substrate topology.
- `defer/archive reason`: none from Mutator; non-ledger mutation is not authorized by this block.

#### mutator block — 2026-04-19

- `role`: `Mutator`
- `thread_class`: `pressure_generation`
- `active_subject`: `Commit-Boundary Admission Basis for analog_signal`
- `active_macro_verb`: `Decide`
- `state_before`: `Rebound`
- `active_seam`: `analog_signal commit-boundary admission seam`
- `role classification`: `R1 lawful contribution`
- `role leak risk`: bounded after correction; this pass is ledger-only and does not touch non-ledger surfaces.
- `check_in_time`: `2026-04-19`
- `active branch or working ref`: `main`
- `files or surfaces checked`:
  - `pressure_generation/workflow/README.ExecutionSurfaceProjectionLedger.md`
- `repo-state findings`:
  - projection ledger is present and defines Mutator default authority as ledger-only unless an explicit administrator-granted mutation packet exists.
  - no administrator mutation packet is currently present in this ledger entry.
  - therefore this Mutator pass may append only this bounded ledger block and may not mutate subject registry, implementation ladder, MemoryObject envelope, substrate topology, code, schemas, or contracts.
- `repo/local drift note`: prior non-ledger mutations were reverted by the operator; current retry is scoped to ledger append only.
- `active mutation surface`: `pressure_generation/workflow/README.ExecutionSurfaceProjectionLedger.md`
- `expected emitted object`: `Decision object / bounded mutation proposal`
- `bounded mutation proposal`:
  - Subject Registry should rebound `Source-Family Admission Basis` into active child subject `Commit-Boundary Admission Basis for analog_signal`.
  - Implementation Ladder should clarify Rung 6 as direct `H1` / `M1` conservation proof before requiring `MemoryObject` wrapping.
  - Implementation Ladder should preserve `MemoryObject` rebase as Rung 8, not immediate `analog_signal` admission floor.
  - MemoryObject Envelope should add or reinforce that `MemoryObject` is not the payload floor for `analog_signal`; direct `H1` / `M1` remains lower lawful support payload.
  - Substrate Topology should clarify that direct `H1` / `M1` commit remains current runtime reality and `MemoryObject` is the projected boundary target.
- `proof target`: preserve `analog_signal -> direct H1 / M1 support-bearing payload -> current direct commit reality` as lower active topology while preserving `MemoryObject` as projected boundary target.
- `observed implementation result`: ledger append only; no non-ledger mutation performed.
- `non-claims`:
  - no code mutation
  - no `MemoryObject` implementation
  - no `json` admission
  - no subject release
  - no non-ledger doc mutation authority claimed
- `check_out_time`: `2026-04-19`
- `surfaces mutated or confirmed unchanged`:
  - mutated: `pressure_generation/workflow/README.ExecutionSurfaceProjectionLedger.md`
  - confirmed unchanged by this pass: subject registry, implementation ladder, MemoryObject envelope, substrate topology, code, schemas, contracts.
- `handoff state`: Mutator proposal appended; non-ledger mutation requires explicit Administrator mutation packet or Auditor routing.
- `next role`: `Administrator` or `Auditor`
- `open repo-state risks`:
  - Administrator must explicitly grant a mutation packet before any non-ledger doc surfaces are touched.
  - Auditor should verify that the reverted non-ledger mutations no longer remain in live repo state.
  - Projection remains non-authoritative until gated.

## One-line summary

The projection ledger allows ideas to enter freely while forcing them to remain
non-authoritative until they are grounded through topology detection and
perturbation.
