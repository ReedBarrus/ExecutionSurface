# ExecutionSurface Governed Recursion Entry Contract

## Status

This document defines the minimum entry contract for opening a governed recursion cycle over the early ExecutionSurface architectural surfaces.

It is a process-surface contract.

It does not replace:

- `README.ExecutionSurfaceArchitectureSeed.md`
- `README.ExecutionSurfaceSubjectRegistry.md`
- `README.ExecutionSurfaceImplementationLadder.md`
- `README.ArchitectMorphogenesisWorkflow.md`

Its purpose is narrower:

- define who may open a recursion cycle
- define the minimum input packet
- define the permitted mutation posture
- define what each cycle must emit
- define lawful stop conditions
- define write privilege posture for early recursion

---

## Purpose

Governed recursion is being introduced only to support bounded architectural morphogenesis over a lawful memory-medium substrate.

It is not a license for parallel freeform drafting, uncontrolled multi-author mutation, or hidden scope widening.

This contract exists to keep recursive architectural work inspectable, auditable, and stoppable.

---

## Entry authority

A governed recursion cycle may be opened only by the current Administrator.

In current early-phase posture, the Administrator is Reed.

The Administrator must declare:

- active subject
- active role for the thread or pass
- current subject state
- target state
- write privilege posture
- stop condition or gate target

No cycle is active unless those are declared.

---

## Minimum recursion input packet

Every governed recursion cycle must start with a bounded packet containing all of the following:

- cycle_id
- active subject
- current subject state
- active role
- live subject surface in scope
- governing surfaces
- non-goals
- expected emitted object
- write privilege posture
- stop / gate target

If any of these are missing, the cycle is not ready.

---

## Governing surfaces

Every cycle must name the governing surfaces it inherits from.

Minimum expected surfaces are:

- `README.ExecutionSurfaceArchitectureSeed.md`
- `README.ExecutionSurfaceSubjectRegistry.md`
- `README.ExecutionSurfaceImplementationLadder.md`
- `README.ArchitectMorphogenesisWorkflow.md`

If a narrower seam-local or subject-local contract exists, it must also be named.

---

## Mutation posture classes

Early governed recursion may operate in one of three postures only:

### 1. Read-only

May:

- inspect live subject surface
- propose changes
- append cycle-log entry

May not:

- mutate live subject surface
- change subject register
- change implementation ladder

### 2. Staged-write

May:

- return bounded replacement / insertion / deletion proposals
- append cycle-log entry
- identify exact write payloads

May not:

- directly mutate live subject surface unless explicitly promoted by Administrator under writing-role law

### 3. Write-authorized

May:

- mutate the live subject surface directly
- append cycle-log entry
- return narrower release / hold / rebound posture proposals

Write-authorized posture is lawful only when:

- the active role is a writing role under current workflow law
- the mutation remains bounded to the active subject
- no neighboring subject is widened silently
- cycle-log entry is completed in the same pass

---

## Cycle output rule

Every recursion cycle must emit all of the following:

- active subject
- active role
- state before pass
- state after pass
- live-surface mutation status
- what changed
- what remains unresolved
- recommended next role
- whether stop / hold / release / downgrade / rebound is requested
- cycle-log entry

If any of these are missing, the pass is incomplete.

---

## Lawful stop conditions

A governed recursion cycle must stop lawfully when any of the following occurs:

- the expected emitted object cannot be produced honestly
- the active subject can no longer be kept singular
- the active role is no longer singular
- unresolved ambiguity increases instead of decreases
- the next legal move is not narrower than the current subject
- the cycle must recruit downward or rebound
- the declared gate target is reached

Stopping lawfully is not failure.

Silent continuation after lawful stop is failure.

---

## Recursion kill-switch / rebound rule

If a recursion cycle causes any of the following:

- more than one active subject
- scope widening
- class ambiguity
- hidden state
- missing cycle-log entry
- missing emitted object
- unresolved role collision

then the cycle must automatically lose write privilege and shift to one of:

- Hold
- Rebound
- Downgrade

until re-bounded by the Administrator.

---

## Early-phase write privilege rule

During early governed recursion:

- Constructor may be write-authorized
- Reflector may be write-authorized
- Creative is read-only or staged-write by default
- Auditor is read-only or staged-write by default

No role may silently elevate its own write privilege.

---

## Non-claims

This contract does not yet define:

- autonomous recursion opening
- automatic gate release
- multi-branch recursion
- runtime-managed recursion orchestration
- automatic repo mutation outside bounded writing-role law

---

## One-line summary

A governed recursion cycle may open only under an explicit bounded packet, singular subject and role, declared write posture, complete cycle-log emission, and an always-active rebound path that removes write privilege when recursion stops being inspectable.
