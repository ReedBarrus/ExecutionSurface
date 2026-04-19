# ExecutionSurface Role Authority Matrix

## Status

This document freezes the current role authority, responsibility, and scope
posture for `ExecutionSurface` workflow.

It is a live workflow authority surface.

It should be read together with:

- `pressure_generation/workflow/README.ExecutionSurfaceRoleTemplate.md`
- `pressure_generation/workflow/README.ExecutionSurfaceWorkflowTemplate.md`
- `pressure_generation/workflow/README.ExecutionSurfaceProjectionLedger.md`
- `README.EX.DecisionMatrix.md`
- `README.EX.SeamDisciplineContract.md`

If this document conflicts with live repo reality or the matrix stack on current
code state, live repo and matrix authority win for current implementation facts.

## Purpose

This matrix exists to remove ambiguity about:

- what each role is for
- what each role may mutate
- what each role may never mutate
- what scope each role may carry
- what handoff each role owes the next role

The point is to reduce rhetorical drift and stop roles from borrowing ambient
authority from the overall process.

## Shared role law

All roles inherit these rules:

1. live repo state is upstream authority for current implementation reality
2. every serious pass must check in against live repo state for the active seam
3. every serious pass must append only its own bounded ledger block
4. no role may silently rewrite prior role blocks
5. no role may silently widen the active seam
6. no role may upgrade projection into implementation or release authority by
   rhetoric alone

## Role matrix

### Administrator

Function:

- route work
- set scope
- grant or deny packets
- stop, hold, pivot, rebase, defer, or archive

Primary responsibility:

- preserve scope sovereignty
- keep the process bounded
- require repo-state check-in
- ensure packets exist before non-ledger mutation

May mutate:

- administrator block in shared ledger
- entry routing fields
- explicit mutation packet fields

May not mutate:

- detector findings as if they were observed
- perturbation findings as if they were challenged
- mutator implementation result as if it were performed
- final release judgment that belongs to `Auditor`

Default scope:

- shared ledger entry
- packet boundaries
- role routing

Non-default scope:

- broader workflow posture only when explicitly declared

Authority ceiling:

- process authority
- packet authority
- no implementation truth authority
- no release authority

Required handoff:

- active scope
- packet status
- next role
- hold or proceed posture

Hard stop:

- if scope cannot be bounded
- if packet authority is unclear
- if the pass is trying to continue only because motion feels productive

### Detector

Function:

- identify implemented or implementable topology

Primary responsibility:

- name object, relation, transformation, conserved relations, lost relations,
  and verification handle against live repo reality

May mutate:

- detector block in shared ledger

May not mutate:

- non-ledger docs, code, or schemas
- packet authority
- release state

Default scope:

- active seam inspection
- topology grounding

Authority ceiling:

- observational and topological grounding
- no implementation mutation authority
- no release authority

Required handoff:

- detected topology
- verification handle
- unknowns
- detection blockage if present

Hard stop:

- if live repo state was not checked
- if topology claim is inherited from prose rather than observed state

### Mutator

Function:

- produce the smallest lawful mutation against detected topology

Primary responsibility:

- mutate only the declared surface
- protect the emitted object
- stop before scope or layer bloom

May mutate:

- mutator block in shared ledger
- non-ledger surfaces only when an administrator mutation packet already exists

May not mutate:

- any non-ledger surface without a prior packet
- surfaces outside packet scope
- release fields
- other role blocks

Default scope:

- ledger-only

Non-default scope:

- one declared mutation surface
- exact files or bounded doc surfaces named in packet

Authority ceiling:

- local mutation authority only
- no ambient repo-wide mutation authority
- no release authority

Required handoff:

- exact touched surfaces
- expected emitted object versus actual emitted object
- no-mutation result if blocked
- open mutation risks

Hard stop:

- if no packet exists for non-ledger mutation
- if more than one seam must mutate
- if mutation turns into redesign
- if the expected emitted object cannot be produced honestly

### Perturbator

Function:

- challenge whether topology, subject, or move deserves conservation

Primary responsibility:

- generate pressure against convenience, inflation, mis-aim, and unnecessary
  objects or surfaces

May mutate:

- perturbator block in shared ledger

May not mutate:

- non-ledger docs, code, or schemas
- detector findings by overwrite
- release state

Default scope:

- challenge surface for one active subject or seam

Authority ceiling:

- challenge authority
- no implementation mutation authority
- no release authority

Required handoff:

- simplification pressure
- delete or lower pressure
- subject mis-aim warning
- reasons a move should hold, split, or re-scope

Hard stop:

- if the challenge depends on stale local framing rather than live repo reality
- if branch bloom is being generated without bounded decision pressure

### Compressor

Function:

- remove bloat and preserve only what survives pressure

Primary responsibility:

- reduce residue without hiding unresolved tension

May mutate:

- compressor block in shared ledger
- non-ledger surfaces only if explicitly packeted for compression work

May not mutate:

- compress before detection and perturbation are visible
- beautify unresolved state into false coherence
- release state

Default scope:

- ledger-only

Non-default scope:

- one packeted compression surface

Authority ceiling:

- local reduction authority
- no topology invention authority
- no release authority

Required handoff:

- what was removed
- what was retained
- why compression was lawful or premature

Hard stop:

- if compression would erase load-bearing distinctions
- if compression would hide unresolved state instead of reducing bloat

### Auditor

Function:

- gate against topology drift, authority inflation, unverifiable motion, and
  unlawful release

Primary responsibility:

- verify the visible chain against live repo state and packet law
- decide release, hold, defer, quarantine, or archive posture

May mutate:

- auditor block in shared ledger
- final gate fields
- entry status and defer/archive reason

May not mutate:

- fabricate missing detector or mutator work
- retroactively replace missing check-ins with narrative cleanliness
- perform implementation mutation under audit cover

Default scope:

- full visible ledger chain for one active item

Authority ceiling:

- final gate authority for that item
- no implementation mutation authority

Required handoff:

- final gate judgment
- authority ceiling judgment
- explicit reason for release, hold, defer, quarantine, or archive

Hard stop:

- if repo-state check-in is missing
- if packet authority is missing or was added too late
- if role leakage is visible
- if release is being justified by coherence rather than proof

## Default mutation posture by role

- `Administrator`: ledger and packet fields only
- `Detector`: ledger only
- `Mutator`: ledger only by default, packet-gated outside ledger
- `Perturbator`: ledger only
- `Compressor`: ledger only by default, packet-gated outside ledger
- `Auditor`: ledger and gate fields only

## One-line summary

Roles in `ExecutionSurface` are not generic collaborative voices; each one has
a bounded authority surface, a bounded mutation posture, and a specific handoff
obligation that must remain narrower than the process as a whole.
