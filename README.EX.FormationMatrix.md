# ExecutionSurface — Formation Matrix

Live Repo State:
https://github.com/ReedBarrus/ExecutionSurface

## Status

This document is the structure and placement authority for the active
ExecutionSurface development front.

It governs only:

- current repo zones
- root authority files
- placement rules
- active-vs-non-active repo structure
- how execution-bearing and read-side objects are kept distinct
- how generated artifacts are classified without becoming runtime authority

It does not govern:

- constitutional boundaries
- movement procedure
- evaluation procedure
- memory retention by itself
- operator semantics by itself
- artifact meaning by itself

The live repo is the authority for current file and folder reality.

If this document and live repo state conflict about what currently exists, live
repo state wins.

If formation and constraint conflict on boundary posture, constraint wins.

If formation and decision conflict on movement procedure, decision wins.

If formation and evaluation conflict on judgment or outcome routing, evaluation wins.

If formation and memory conflict on retention, archive, reconstruction, or
trust-tier persistence, memory wins.

---

## 1. Formation function

This document exists only to answer:

- what top-level zones currently exist
- what each zone is for
- what root files are authoritative
- where new files should go
- what must not cohabit
- how execution-bearing structure is externalized in the repo
- how generated surfaces remain distinct from runtime authority

Nothing else belongs here.

---

## 2. Current top-level zones

Current top-level repo zones are:

- `fixtures/`
- `operators/`
- `runtime/`
- `schemas/`
- `scripts/`
- `tests/`
- `test_signal/`
- `Transformer/`
- `benchmarks/`
- `out_workbench/`
- `out_lm/`
- `morphogenesis/`

Current root orientation / authority-support files include:

- `README.md`
- `ARCHITECTURE.md`
- `README.EX.ConstraintMatrix.md`
- `README.EX.FormationMatrix.md`
- `README.EX.DecisionMatrix.md`
- `README.EX.EvaluationMatrix.md`
- `README.EX.MemoryMatrix.md`

If a zone is not present in the live repo, it is not part of current formation reality.

## 3. Root authority files

Current root authority files for the ExecutionSurface development front are:

- `README.EX.ConstraintMatrix.md`
- `README.EX.FormationMatrix.md`
- `README.EX.DecisionMatrix.md`
- `README.EX.EvaluationMatrix.md`
- `README.EX.MemoryMatrix.md`

Supporting root orientation files include:

- `README.md`
- `ARCHITECTURE.md`

`README.md` and `ARCHITECTURE.md` are active orientation surfaces.

They are not matrix authority by default.

Generated outputs, benchmark artifacts, and local runtime receipts must not be
treated as authority merely because they are visible in the repo.

---

## 4. Repository band split

The active repo is organized into four bands:

### 4.1 Runtime / commit implementation

These zones hold the execution-bearing substrate and the bounded fixtures that
feed it:

- `fixtures/`
- `operators/`
- `runtime/`
- `test_signal/`

### 4.2 Read-side / control surfaces

These zones hold machine-facing receipt, wrapper, benchmark, validation, and
attachment surfaces that operate on explicit runtime-visible artifacts without
becoming runtime authority:

- `schemas/`
- `scripts/`
- `tests/`
- `Transformer/`

### 4.3 Morphogenesis / process-support surfaces

These zones hold architecture-shaping, governed-recursion, subject-surface, and
workflow-support surfaces that operate over bounded receipts and explicit process
law without becoming runtime / commit authority:

- `morphogenesis/`

### 4.4 Generated artifact surfaces

These zones hold emitted outputs from runtime, wrapper, or benchmark activity:

- `benchmarks/`
- `out_workbench/`
- `out_lm/`

These may be inspected, diffed, retained, benchmarked, or reconstructed.

They do not become authority merely by being produced.
---

## 5. Zone roles

### `fixtures/`
Deterministic input fixture builders only.

### `operators/`
Runtime operator implementation only.

### `runtime/`
Execution coordination, workbench assembly, cross-run observation, bounded
reconstruction support, and runtime-facing orchestration only.

### `schemas/`
Shape contracts and schema surfaces only.

### `scripts/`
Bounded helper runners, staging scripts, and machine-facing execution helpers only.

### `tests/`
Contract checks, runtime checks, wrapper checks, reconstruction checks, probe
checks, and benchmark checks only.

### `test_signal/`
Signal-side source material and replay-style signal checks only.

### `Transformer/`
Language-kernel attachment and related bounded downstream control surfaces only.

### `morphogenesis/`
Governed-recursion, architecture-shaping, subject-surface, workflow-support, and
implementation-ladder process surfaces only.

This zone is read-side / process-support posture.

It does not become runtime / commit authority by carrying live subject mutation.

#### `morphogenesis/architecture/`
Architecture seed and implementation-ladder trunk surfaces only.

#### `morphogenesis/workflow/`
Subject registry, cycle log, administrator note log, governed recursion contract,
appendices, and workflow law support surfaces only.

#### `morphogenesis/subject_surfaces/`
Live subject mutation surfaces opened from the architecture seed during bounded
morphogenesis only.

### `benchmarks/`
Benchmark receipts, summaries, and benchmark-run artifacts only.

### `out_workbench/`
Generated workbench and runtime-facing emitted artifacts only.

### `out_lm/`
Generated LM wrapper, prompt, staged input, and LM output artifacts only.

### `README.md`
Public/self-description and repo posture only.

### `ARCHITECTURE.md`
Compact architectural basis and development-front description only.
---

## 6. Placement rules

### Rule 1
Runtime operators stay in `operators/`.

### Rule 2
Execution coordination, workbench assembly, runtime read-side exposure,
cross-run observation, and bounded runtime reconstruction support stay in `runtime/`.

### Rule 3
Shape contracts and JSON schemas stay in `schemas/`.

### Rule 4
Helper runners and machine-facing execution scripts stay in `scripts/`.

### Rule 5
Contract, wrapper, runtime, reconstruction, and benchmark tests stay in `tests/`.

### Rule 6
Fixture builders stay in `fixtures/`.

### Rule 7
Signal-side fixture material stays in `test_signal/`.

### Rule 8
Language-kernel attachment and related bounded downstream kernel surfaces stay in
`Transformer/`.

### Rule 9
Morphogenesis architecture, workflow, and subject-surface process files stay in
`morphogenesis/`.

### Rule 10
Architecture seed and implementation-ladder trunk surfaces stay in
`morphogenesis/architecture/`.

### Rule 11
Subject registry, cycle log, administrator note log, governed recursion entry
contract, appendices, and workflow-support surfaces stay in
`morphogenesis/workflow/`.

### Rule 12
Released or actively mutated narrower live subject surfaces stay in
`morphogenesis/subject_surfaces/`.

### Rule 13
Benchmark-run artifacts stay in `benchmarks/`.

### Rule 14
Generated workbench artifacts stay in `out_workbench/`.

### Rule 15
Generated LM staging / output artifacts stay in `out_lm/`.

### Rule 16
Root posture and architecture statements stay in `README.md` and `ARCHITECTURE.md`.
---

## 7. Authority-bearing vs generated surfaces

Formation must preserve distinction between:

- execution-bearing implementation
- read-side / control surfaces
- generated artifact surfaces
- root authority documents
- root orientation documents

Generated artifacts may support:

- inspection
- diffing
- benchmarking
- retention
- reconstruction
- downstream attachment

Generated artifacts may not by themselves settle:

- runtime authority
- structural authority
- canon
- truth
- promotion

---

## 8. Formation separation rule

Formation must preserve distinction between:

- runtime operators
- execution coordination
- schema contracts
- helper runners
- tests
- fixture builders
- language-kernel attachment surfaces
- generated artifacts
- root orientation / matrix surfaces

A file may not silently carry multiple structural roles merely for convenience.

If a file or folder becomes mixed-role, that mixed role must be made explicit and
should be split when lawful.

---

## 9. Active reality rule

This document describes current ExecutionSurface repo reality, not ideal future layout.

If a folder is planned but not present, it is not active formation reality.

If a folder remains present but no longer carries active role, that must be
stated elsewhere and should eventually be cleaned up.

The repo’s live executable structure is upstream of discussion about preferred
future layout.

---

## 10. Formation invariant

Formation must externalize execution-bearing and read-side structure in a way
that preserves identity-bearing distinction without silently importing movement,
judgment, canon, or ontology into placement.

Placement may support:

- runtime clarity
- read-side clarity
- benchmark clarity
- workflow clarity

Placement may not settle authority by itself.

---

## 11. One-line summary

Formation Matrix defines the current structural placement grammar of the active
ExecutionSurface development front, preserves distinction between runtime /
commit implementation, read-side / control surfaces, and generated artifacts,
and prevents emitted outputs from silently becoming runtime authority.