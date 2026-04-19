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
- route the entry into the working lane
- mark hold, defer, pivot, rebase, or archive

Must not:

- fabricate topology grounding for another role
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

## One-line summary

The projection ledger allows ideas to enter freely while forcing them to remain
non-authoritative until they are grounded through topology detection and
perturbation.
