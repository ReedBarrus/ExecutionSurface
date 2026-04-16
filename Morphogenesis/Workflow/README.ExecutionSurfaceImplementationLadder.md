# ExecutionSurface Implementation Ladder

## Status

This document is a parallel implementation-planning surface for early ExecutionSurface development.

It is not an authority file and it does not replace the architectural subject registry.

Its function is narrower:

- define how architectural subjects are mechanized
- define how each rung is tested and proven
- distinguish concept stabilization from code touch
- keep proof posture explicit as development unfolds

This document should be read together with:

- `README.ExecutionSurfaceArchitectureSeed.md`
- `README.ExecutionSurfaceSubjectRegistry.md`
- `README.ArchitectMorphogenesisWorkflow.md`

---

## Purpose

ExecutionSurface needs two parallel ladders:

1. an **architectural subject ladder**
2. an **implementation and proof ladder**

The subject ladder answers:

- what must be conceptually stabilized
- what narrower child subject should unfold next
- what remains deferred

The implementation ladder answers:

- how a stabilized subject is mechanized
- what objects, validators, scripts, and tests are required
- what proof is needed before a rung is considered usable

This separation exists to prevent:

- architecture from drifting into vague capability claims
- implementation from outrunning unsettled object law
- tests from scoring surfaces whose meaning is not yet stabilized

---

## Core rule

No implementation rung may outrun the architectural subject it depends on.

A subject may be discussed before it is mechanized.

A subject may be partially mechanized for exploratory pressure.

But no mechanized surface should be treated as stable until the parent architectural subject is at least compressed enough to support bounded non-claims, explicit boundaries, and a named proof target.

---

## Ladder relationship

The default relationship is:

- subject ladder leads
- implementation ladder follows one stabilized rung behind

This keeps architectural law ahead of code churn.

Exploratory code may exist earlier, but exploratory code does not upgrade the architectural subject automatically.

---

## Implementation ladder

### Rung 0 — Object-family declaration surface

**Depends on subject:** Object-Class Grammar

**Implementation target:**
- explicit object-family index
- provisional shape definitions
- explicit non-claims per class

**Expected outputs:**
- object family surface
- provisional schema / type surfaces
- class-distinction notes

**Proof target:**
- object classes are distinguishable enough that later retained / reconstructed / compared objects cannot silently collapse into one mixed class

---

### Rung 1 — Commit-boundary and write eligibility

**Depends on subject:** Commit-Boundary Law

**Implementation target:**
- explicit write prerequisites
- explicit commit gating
- fail-closed malformed write handling

**Expected outputs:**
- write / retain contract surface
- validator rules for eligibility
- rejection receipt shape

**Proof target:**
- invalid objects fail closed
- valid objects cross the boundary lawfully
- commit does not silently upgrade authority

---

### Rung 2 — Retained object implementation

**Depends on subjects:** Object-Class Grammar, Commit-Boundary Law

**Implementation target:**
- retained object shape
- retain / reload path
- provenance / policy anchor persistence

**Expected outputs:**
- retained object schema or type
- write helper / loader seam
- invariance tests

**Proof target:**
- retain / reload preserves class, provenance refs, policy anchors, and authority posture without mutation

---

### Rung 3 — Comparison as a first-class operation

**Depends on subject:** Comparison Law

**Implementation target:**
- comparison receipt shape
- explicit basis and operand refs
- deterministic compare path

**Expected outputs:**
- comparison receipt schema
- comparison helper / operator seam
- identical-input stability tests

**Proof target:**
- retained↔retained and retained↔reconstruction comparisons emit stable receipts without truth or same-object closure

---

### Rung 4 — Reconstruction with declared source and lens

**Depends on subject:** Reconstruction Law

**Implementation target:**
- reconstruction object shape
- source + lens declaration requirement
- reconstruction / source distinction enforcement

**Expected outputs:**
- reconstruction schema
- reconstruction seam
- source/lens validation rules

**Proof target:**
- reconstruction cannot occur without declared source and lens
- reconstruction is visibly distinct from retained source

---

### Rung 5 — Memory routing implementation

**Depends on subject:** Memory Routing Law

**Implementation target:**
- retain / archive / promote posture object
- reconstruction availability markers
- bounded reuse-condition carriage

**Expected outputs:**
- memory routing object surface
- routing validator rules
- archive vs retain behavior tests

**Proof target:**
- memory routing is explicit
- archive is not deletion
- retain is not proof
- promote does not silently become canon

---

### Rung 6 — Read-model distinction

**Depends on subject:** Read-Model Distinction

**Implementation target:**
- separate shapes and surfaces for retained object, reconstruction object, comparison receipt, query/read result, and later agent emission object

**Expected outputs:**
- role-distinct shapes
- validation rules against class collapse
- mixed-class rejection tests

**Proof target:**
- read-side result cannot silently masquerade as retained state
- reconstruction cannot silently masquerade as source object

---

### Rung 7 — Continuity under bounded identity posture

**Depends on subject:** Continuity Under Bounded Identity Posture

**Implementation target:**
- recurrence / reuse continuity surfaces
- explicit same-object non-claim posture
- continuity receipts or continuity fields

**Expected outputs:**
- continuity support shape
- recurrence/reuse comparison tests

**Proof target:**
- repeated reuse can be tracked without collapsing into same-object closure

---

### Rung 8 — Agent write discipline

**Depends on subject:** Agent Write Discipline

**Implementation target:**
- typed agent emission object
- bounded agent write contract
- fail-closed validator path

**Expected outputs:**
- agent emission object
- agent write validator
- malformed agent write rejection tests

**Proof target:**
- agents can write only bounded classes under explicit policy and authority posture

---

### Rung 9 — Agent read / reconstruction discipline

**Depends on subject:** Agent Read / Reconstruction Discipline

**Implementation target:**
- lens-bound read surfaces for agents
- auditable agent read receipts
- reconstruction usage guardrails

**Expected outputs:**
- agent read surface
- agent read receipt
- lens / source validation tests

**Proof target:**
- agents can read and reconstruct lawfully without blurring retained state, reconstruction, and interpretation

---

### Rung 10 — Multi-agent exchange over substrate

**Depends on subject:** Multi-Agent Exchange Over Substrate

**Implementation target:**
- explicit handoff objects or exchange receipts
- inspectable pass-to-pass diffs
- role / lane declaration for each pass

**Expected outputs:**
- exchange receipt shape
- multi-pass replay harness
- handoff tests

**Proof target:**
- two or more agents can exchange over the substrate without hidden shared state and with explicit retained pass artifacts

---

### Rung 11 — Human resolution and governance

**Depends on subject:** Human Resolution And Governance

**Implementation target:**
- accept / reject / defer / promote user resolution objects
- user intervention continuity surface

**Expected outputs:**
- governance object
- user resolution receipt
- continuity tests for intervention

**Proof target:**
- human acceptance or rejection becomes first-class continuity without silently becoming canon

---

### Rung 12 — Cross-session recursive continuity

**Depends on subject:** Cross-Session Recursive Continuity

**Implementation target:**
- re-entry surface from retained substrate objects rather than chat memory alone
- session continuity receipts

**Expected outputs:**
- session continuity object
- re-entry harness
- replay / resume tests

**Proof target:**
- later sessions can resume from retained objects with visible reconstruction path and preserved non-claims

---

## Stabilizing-pass posture

Between implementation rungs, stabilizing passes are lawful and encouraged.

A stabilizing pass may:

- tighten object boundaries
- harden non-claims
- refine validator scope
- reduce silent authority inflation risk
- improve reporting and explicitness

A stabilizing pass must not:

- silently widen the architectural subject
- quietly import deferred upper-ladder behavior
- treat exploratory code as settled proof

---

## Test families

Early proof should be organized into small test families:

1. **shape tests**
   - does the object match its declared class?

2. **boundary tests**
   - does malformed input fail closed?
   - can class collapse be detected?

3. **invariance tests**
   - does retain / reload preserve what must persist?

4. **comparison tests**
   - do identical inputs yield stable comparison receipts?

5. **reconstruction tests**
   - is source/lens declaration mandatory?

6. **routing tests**
   - do retain / archive / promote postures remain explicit?

7. **continuity tests**
   - can recurrence be tracked without same-object inflation?

---

## Non-claims

This ladder does not yet define:

- final package placement
- final runtime orchestration
- final agent prompt contracts
- final benchmarking surface
- final control-loop implementation
- autonomous repo mutation policy

These may unfold later when their parent subjects are stable enough.

---

## One-line summary

ExecutionSurface implementation should mechanize one stabilized subject at a time, proving each rung through bounded object shapes, fail-closed validators, explicit receipts, and narrow tests so code does not outrun the lawful memory-medium architecture.
