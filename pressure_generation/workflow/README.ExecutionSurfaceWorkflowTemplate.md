# ExecutionSurface Workflow Template

## Status

This document defines the live workflow template for `ExecutionSurface`.

It is a skeletal process surface.

It is not yet the final full workflow law.

For the explicit role authority split, read together with:

- `pressure_generation/workflow/README.ExecutionSurfaceRoleAuthorityMatrix.md`

## Method name

The current method name is:

- `Topology-First Architecture Pressure Generation`

## Core loop

The current working loop is:

- `Detect -> Perturb -> Conserve`

This loop applies across:

- subject
- role
- process

## Working lanes

The workflow currently has three lanes:

### 1. Projection ledger

Projection enters freely.

No authority is granted here.

This lane is still a shared chain surface.

It should be append-only at the role-block level so one item can accumulate a
visible working history.

### 2. Working lane

Only topology-grounded candidates may enter.

This lane runs:

- detection
- perturbation
- conservation decision
- bounded mutation or compression
- evaluation

The working lane should continue appending to the same bounded ledger entry for
that item rather than opening disconnected role notes.

### 3. Memory / archive sink

Every result must end as one of:

- live authority
- retained deferred projection
- archived history
- archived anti-pattern

## Process friction classes

Every serious pass should classify process friction as one of:

- `F0` under-pressured
- `F1` productive friction
- `F2` metastable hold
- `F3` over-smooth
- `F4` over-generated
- `F5` blocked / recruit downward

## Minimal pass template

Every serious pass should carry:

### Subject metadata

- `subject`
- `subject topology claim`
- `subject aim`
- `subject philosophy`
- `active seam or scope`
- `why active now`

### Pass state

- `active role`
- `macro verb`
- `state before`
- `state after`

### Detected topology

- `input object`
- `transformation`
- `output object`
- `conserved relations`
- `lost / omitted relations`
- `authority ceiling`
- `verification handle`
- `unknowns`

### Perturbation

- `can this object be removed?`
- `can the prior object be exposed directly?`
- `can this become a relation instead of an object?`
- `is this the lowest lawful layer?`
- `what breaks if semantic/projection material disappears?`
- `is the subject mis-aimed?`
- `is the subject philosophy inflating process?`

### Role / process audit

- `role classification`
- `role leak risk`
- `process friction`
- `correction if needed`

### Result

- `emitted object`
- `decision`
- `unresolved`
- `next move`

### Mutation surface

- `active mutation surface`
- `files or doc surfaces in scope`
- `expected emitted object`
- `surface widening risk`
- `mutation packet status`
- `global mutation mode`

### Repo-state handoff

- `live repo ref checked`
- `files or surfaces checked`
- `repo/local drift`
- `surfaces mutated or confirmed unchanged`
- `handoff repo state`

## Shared-ledger execution rule

The cleanest workflow execution posture is:

1. `Administrator` opens one ledger entry.
2. each acting role appends one bounded role block to that same entry.
3. no role silently rewrites earlier role blocks.
4. corrections append as new blocks.
5. every role performs repo-state check-in and check-out.
6. `Auditor` gates against the visible chain and live repo state, not against
   reconstructed prose.

### Minimal entry chain

For one serious item, the ledger chain should accumulate in this order:

1. `administrator block`
2. `detector block`
3. `perturbator block`
4. `mutator block`
5. `compressor block` when needed
6. `auditor block`

`Compressor` is conditional.

If no compression pass occurs, the chain can move directly from `Mutator` to
`Auditor`.

### Status authority

To keep status drift small:

- `Administrator` may set initial routing status
- `Auditor` may set final gate status

Other roles should append findings, not silently mutate shared status fields.

## Live-repo authority rule

The workflow should treat live repo state as upstream authority for current
implementation reality.

The shared ledger is the handoff carrier.

The live repo is the thing being checked and handed against.

### Practical execution rule

For each serious role pass:

1. read the shared ledger entry
2. check the active seam against live repo state
3. append bounded findings or mutation
4. record repo check-out and handoff state
5. hand to the next role

If the role cannot perform step 2, the pass must explicitly downgrade itself to
partial or non-authoritative posture.

If the acting role is `Mutator`, it must also:

1. default to ledger-only mutation unless a mutation packet exists
2. declare one active mutation surface
3. declare exact files or bounded doc surfaces in scope
4. state the expected emitted object before mutation
5. stop if the pass widens beyond that surface without explicit escalation

## Mutation-packet rule

Non-ledger mutation by `Mutator` is lawful only when `Administrator` has
already written an explicit mutation packet into the shared ledger entry.

Without that packet:

- `Mutator` may inspect live repo state
- `Mutator` may append findings and proposed mutation to its ledger block
- `Mutator` may not edit docs, code, schemas, or other non-ledger surfaces

This keeps mutation authority explicit instead of ambient.

## Global-mutation rule

Whole-project or broad multi-surface mutation pressure is disabled by default.

If a pass truly intends global or cross-surface pressure, that mode must be
declared in advance as a separate workflow posture, not smuggled in through
retroactive ratification.

Without that explicit declaration:

- `Administrator` may not legalize broad ambient edits after the fact
- out-of-scope touched surfaces become quarantined residue
- those surfaces require separate packets or separate review

The normal workflow posture is bounded-surface mutation, not global mutation
pressure.

## Release gate

A subject may release only if all are true:

1. topology is detected
2. topology was perturbed
3. conserved topology survived perturbation
4. a verification handle exists
5. live repo state was checked for the active seam
6. any non-ledger mutator change was covered by an administrator mutation packet
7. any `Mutator` pass stayed inside its declared mutation surface
8. any post-hoc ratification stayed inside the packet ratification ceiling
9. role leak is below inflation threshold
10. process friction is productive or metastable
11. the next move is narrower and more grounded

## Stop conditions

The workflow must hold, recruit downward, defer, pivot, or archive if:

- no topology is detected
- no perturbation occurred
- no live repo check-in occurred for the active seam
- a mutator performs non-ledger mutation without an administrator mutation packet
- a mutator pass widens beyond its declared mutation surface
- administrator retroactively legalizes out-of-scope broad-surface mutation
- the emitted object cannot be produced honestly
- process friction is over-smooth
- process friction is branch bloom
- the pass is only polishing projection

## One-line summary

The workflow template defines a minimal topology-first process in which
projection is admitted freely, only grounded candidates enter the working lane,
and release requires both topology detection and perturbation before
conservation.
