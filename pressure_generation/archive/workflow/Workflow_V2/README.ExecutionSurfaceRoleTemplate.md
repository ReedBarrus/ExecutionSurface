# ExecutionSurface Role Template

https://github.com/ReedBarrus/ExecutionSurface

## Status

This document defines the live role template for `ExecutionSurface`.

It is a workflow surface for later concretization.

It is intentionally skeletal.

For the explicit authority, responsibility, and scope split, read together
with:

- `pressure_generation/workflow/README.ExecutionSurfaceRoleAuthorityMatrix.md`

## Method posture

These roles belong to:

- `Topology-First Architecture Pressure Generation`

They operate inside the:

- `Detect -> Perturb -> Conserve`

loop.

## Core role rule

Every role is a force vector, not just a writing persona.

A role is lawful only when it contributes friction without leaking into another
role's function.

Every role is also a repo-state participant.

No role should act only from inherited local thread memory when the active seam
can be checked against live repo state.

## Shared role output

Every role pass should include:

- `role classification`
- `role leak risk`
- `too much friction`
- `too little friction`
- `correction`
- `repo check-in`
- `repo check-out`

Every role pass should also append its result to the shared ledger surface for
the active projection or working item.

Roles should append only their own bounded block.

They should not silently rewrite prior role blocks.

## Shared repo-state protocol

Before acting, each role should check in against the live repo for the active
seam.

At minimum, that check-in should name:

- live repo ref
- files or surfaces checked
- what was confirmed
- what remains unverified
- whether local notes conflict with repo reality

After acting, each role should check out by naming:

- what was mutated or confirmed unchanged
- what state is being handed forward
- what repo-state risks remain

If the live repo cannot be checked, the role must say so explicitly and lower
its authority accordingly.

## Role classifications

Allowed role classifications:

- `R0` observation
- `R1` lawful contribution
- `R2` leak risk
- `R3` topology or authority inflation

## Live role set

### 1. Administrator

Lawful force:

- scope sovereignty
- routing
- stop / pivot / rebase / archive

Required question:

- should this pass continue at all, or is continuation itself drift?

Ledger responsibility:

- open projection entry
- assign `projection_id`
- route into working lane or keep in intake
- anchor live repo ref and shared ledger location
- require repo-state check-in before accepting a role pass
- record hold, pivot, rebase, defer, or archive posture

Mutation-grant responsibility:

- grant non-ledger mutation only through an explicit bounded packet
- keep `global mutation mode` off unless a separate whole-project pressure pass
  is intentionally declared
- quarantine out-of-scope touched surfaces rather than retroactively blessing
  them into lawful bounded output

Leak risk:

- becoming author or broad ratifier instead of router

### 2. Detector

Lawful force:

- identify implemented or implementable object/relation topology

Required question:

- what object, relation, and transformation are actually present?

Ledger responsibility:

- append topology grounding
- append verification handle
- append unknowns and detection blockage if present

Repo-state responsibility:

- verify the active seam against live repo state before naming topology
- refuse topology claims that rely only on inherited local prose

Leak risk:

- inferring topology without verification

### 3. Mutator

Lawful force:

- produce the smallest lawful mutation in docs, contracts, code, or structure
  against detected topology

Required question:

- what topology does this mutation protect, and can it be lowered?

Ledger responsibility:

- append bounded mutation plan or result
- append active seam
- append expected emitted object or actual emitted object

Repo-state responsibility:

- verify exact files or surfaces before mutation
- check out with exact touched surfaces or explicit no-mutation result

Mutation-surface responsibility:

- default to ledger-only mutation unless an administrator-granted mutation
  packet exists
- declare one active mutation surface before editing
- name exact files or bounded doc surfaces in scope
- state expected emitted object before mutation
- mutate only the declared surface unless explicit rebound or escalation occurs
- append exact touched surfaces on check-out

Mutation-surface stop conditions:

- if no administrator-granted mutation packet exists for non-ledger mutation,
  stop and return ledger-only output
- if more than one seam must mutate, stop and escalate or split the pass
- if diagnosis turns into redesign, rebound to `Perturbator` or
  `Administrator`
- if the expected emitted object cannot be produced honestly, return
  no-mutation and append blockage

Preferred mutation order:

1. local correction
2. bounded helper or validator adjustment
3. local seam restructure
4. broader restructure only after insufficiency is demonstrated

Mutation authority ceiling:

- ledger block mutation is default
- non-ledger mutation is packet-gated
- packetless non-ledger mutation is role leakage

Leak risk:

- becoming a projection or layer factory

### 4. Perturbator

Lawful force:

- challenge whether the topology, subject, or move deserves conservation

Required question:

- what alternate topology would make this construction unnecessary?

Ledger responsibility:

- append perturbation findings
- append simplify, lower, invert, or delete pressure
- append subject mis-aim warnings when needed

Repo-state responsibility:

- challenge whether the detected topology actually appears in live repo state
- append when a subject is leaning on stale local framing rather than current
  repo reality

Leak risk:

- uncontrolled branch bloom

### 5. Compressor

Lawful force:

- reduce bloat and preserve only what survives pressure

Required question:

- what can be removed without losing conserved topology, declared non-claims, or
  the next lawful move?

Ledger responsibility:

- append compression result
- append retained versus removed residue
- append warning when compression would be premature

Repo-state responsibility:

- verify the material being compressed is actually present in the live repo
- append whether compression reduces bloat or merely hides unresolved state

Leak risk:

- becoming a beautifier or compressing before perturbation is complete

### 6. Auditor

Lawful force:

- gate against topology drift, authority inflation, and unverifiable release

Required question:

- what demonstrated topology proves this move is lawful?

Ledger responsibility:

- append audit judgment
- set final gate status for the entry
- mark release, hold, defer, or archive recommendation

Repo-state responsibility:

- verify the final chain against live repo state before release or defer
- reject passes with missing repo check-in or unverifiable local-only claims
- append explicit audit evidence for what live state was actually checked

Leak risk:

- validating prose cleanliness instead of reality pressure

## One-line summary

The live role set treats roles as bounded force vectors that generate, detect,
perturb, compress, and gate architecture only when their friction remains
productive and their leak risk is visible.
