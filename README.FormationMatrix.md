# Dynamical Memory Engine — Formation Matrix

Live Repo State:
https://github.com/ReedBarrus/DynamicalMemoryEngine_V2

## Status

This document is the structure and placement authority for DME.

It governs only:

- current repo zones
- root authority files
- placement rules
- active-vs-non-active repo structure
- how structural objects are externalized and kept distinct

It does not govern:

- constitutional boundaries
- decision procedure
- evaluation procedure
- operator semantics by itself
- artifact meaning by itself

The live repo is the authority for current file and folder reality.

If this document and live repo state conflict about what currently exists, live repo state wins.

If formation and constraint conflict on boundary posture, constraint wins.

If formation and decision conflict on movement procedure, decision wins.

If formation and evaluation conflict on judgment or outcome routing, evaluation wins.

---

## 1. Formation function

This document exists only to answer:

- what top-level zones currently exist
- what each zone is for
- what root files are authoritative
- where new files should go
- what must not cohabit
- how identity-bearing structure is externalized in the repo

Nothing else belongs here.

---

## 2. Current top-level zones

Current top-level repo zones are:

- `.codex/`
- `.github/`
- `.local/`
- `README/`
- `app/`
- `execution/`
- `operators/`
- `planes/`
- `scripts/`
- `test_signal/`
- `types/`
- `validators/`

If a zone is not present in the live repo, it is not part of current formation reality.

---

## 3. Root authority files

Current root authority files are:

- `README.ConstraintMatrix.md`
- `README.FormationMatrix.md`
- `README.DecisionMatrix.md`
- `README.EvaluationMatrix.md`
- `README.MemoryMatrix.md`

Other root files may exist, but they are not root authority by default.

Archived, transitional, or redundant root files should not be treated as authority merely because they remain present.

---

## 4. Zone roles

### `README/`
Documentation bank only.

### `app/`
Browser-facing app shell only.

### `execution/`
Execution-facing runtime support only.

### `operators/`
Runtime operator implementation only.

### `planes/`
Read-side projection only.

### `types/`
Shape definitions only.

### `validators/`
Contract enforcement only.

### `scripts/`
Bounded helper scripts only.

### `test_signal/`
Input fixtures and source-side tests only.

### `.codex/`
Codex/tooling configuration only.

### `.github/`
GitHub automation/configuration only.

### `.local/`
Local machine artifacts only.
Not authority.
Not portable repo structure.

---

## 5. Placement rules

### Rule 1
Runtime operators stay in `operators/`.

### Rule 2
Read-side projections stay in `planes/`.

### Rule 3
Validators stay in `validators/`.

### Rule 4
Shared shapes stay in `types/`.

### Rule 5
Execution-facing seams stay in `execution/`.

### Rule 6
Browser-facing shell code stays in `app/`.

### Rule 7
Helper scripts stay in `scripts/`.

### Rule 8
Fixtures stay in `test_signal/`.

### Rule 9
Documentation stays in `README/`.

### Rule 10
Local machine artifacts do not become repo authority.

---

## 6. Formation separation rule

Formation must preserve distinction between:

- runtime operators
- read-side projections
- shape definitions
- validators
- execution seams
- helper scripts
- documentation
- local machine artifacts

A file may not silently carry multiple structural roles merely for convenience.

If a file or folder becomes mixed-role, that mixed role must be made explicit and should be split when lawful.

---

## 7. Root README regime split

Inside `README/`, the first classification question is:

- constraint
- formation
- decision
- evaluation
- memory

README branches should derive from one of these five root regimes unless explicitly mixed.

If a README is mixed, that mixed role must be explicit.

## 7.1 README field layout

The active `README/` field is organized by regime-support region:

- `README/Constraint/`
- `README/Formation/`
- `README/Decision/`
- `README/Evaluation/`
- `README/Memory/`
- `README/Operational/`

The first classification question remains matrix lineage.

Operational exists as a live accounting and migration region.

Archive posture inside README space is governed under memory-support surfaces rather than as a separate top-level README region.

## 7.2 README second-layer grammar

Within each active root README region, the next classification question is object class.

Approved second-layer grammar is:

### `README/Constraint/`

- `Law/`
- `Admission/`

Where lawful and meaningful, these may subclass by regime:

- `Shared/`
- `Temporal/`
- `Support/`
- `Symbolic/`

### `README/Formation/`

- `Architecture/`
- `Contracts/`
- `Mapping/`

Where lawful and meaningful, these may subclass by regime:

- `Shared/`
- `Temporal/`
- `Support/`
- `Symbolic/`

### `README/Decision/`

- `Roles/`
- `Packets/`
- `Procedure/`
- `Implementation/`

`Roles/` may remain flat or use `Shared/` if needed.

`Packets/`, `Procedure/`, and `Implementation/` may subclass by regime where lawful and meaningful:

- `Shared/`
- `Temporal/`
- `Support/`
- `Symbolic/`

### `README/Evaluation/`

- `Review/`
- `Diagnostics/`
- `Experiments/`

Where lawful and meaningful, these may subclass by regime:

- `Shared/`
- `Temporal/`
- `Support/`
- `Symbolic/`

### `README/Memory/`

- `Reference/`
- `Projection/`
- `Archive/`

`Reference/` and `Projection/` may subclass by regime where lawful and meaningful:

- `Shared/`
- `Temporal/`
- `Support/`
- `Symbolic/`

`Archive/` may additionally contain:

- `Old_DME/`

and may subclass by:

- `Shared/`
- `Temporal/`
- `Support/`
- `Symbolic/`

### `README/Operational/`

- `Accounting/`
- `Lineage/`

Operational does not require regime subclassing by default.

Accounting surfaces, seam records, and operational registry notes should live under `Accounting/`.

Packet history, lineage surfaces, and durable packet receipts should live under `Lineage/`.

## 7.3 Shared subclass rule

`Shared/` exists for artifacts that truthfully span more than one regime or whose governing role is cross-regime by nature.

`Shared/` must not be used as a convenience dump.

It should be used only when forcing `Temporal/`, `Support/`, or `Symbolic/` would be dishonest.

## 7.4 Rehome rule

Second-layer folders should be created only when they receive real artifacts.

Planned but empty folders are not active formation reality by default.

Classification should precede folder creation when lawful.

## 7.5 Compression and archive rule

Compression, merge, archive, and retirement work must follow object-class and regime classification rather than historical path alone.

Reference repair should normally follow final rehome, compression, and archive decisions rather than precede them.

---

## 8. Active reality rule

This document describes current repo reality, not ideal future layout.

If a folder is planned but not present, it is not active formation reality.

If a file remains present but no longer carries active authority, that must be stated elsewhere and should eventually be cleaned up.

---

## 9. Formation invariant

Formation must externalize structure in a way that preserves identity-bearing distinction without silently importing movement, judgment, or ontology into placement.

Placement may support identity clarity.

Placement may not settle identity meaning by itself.

---

## 10. One-line summary

Formation Matrix defines the current structural placement grammar of the live repo, preserves distinction between structural roles, and externalizes identity-bearing objects without letting placement silently become movement, judgment, or authority.