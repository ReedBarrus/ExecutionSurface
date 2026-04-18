# ExecutionSurface Runtime Implementation Bridge

## Status

This document bridges the active runtime grammar corpus to concrete
implementation order and proof posture.

It is an operational companion surface within the runtime grammar corpus.

It does not replace the broader implementation ladder.

## Purpose

The runtime grammar corpus defines what the runtime should be.

This bridge defines:

- which tightening moves come first
- what code surfaces each move touches
- what proof each move requires

## Sequencing Rule

Implementation should follow this order:

1. remove unlawful default dependencies
2. introduce bounded structural-support descriptors
3. rebuild read-side integration surfaces on those descriptors
4. retune LM-facing surfaces
5. retune tests and benchmarks

## Current Bridge Rungs

## Seam-Driven Implementation Map

This bridge now follows the seam-by-seam emission map from the runtime
authority grammar.

Each high-priority seam should be tightened by answering four questions:

1. what descriptor family should this seam expose
2. what subordinate receipt may remain
3. what current emission must be removed
4. what proof closes the correction

| Seam | Descriptor Family Target | Subordinate Surface Allowed | Remove / Replace | Proof Target |
| --- | --- | --- | --- | --- |
| `Orchestrator result assembly seam` | `State support descriptor`, `Trajectory support descriptor`, `Query support descriptor`, `Replay support descriptor` when present | `runtime_receipt` | remove `semantic_overlay` and top-level `interpretation`; replace count-led exposure with descriptor-led sections | assembled result remains lawful and useful without semantic overlay |
| `Workbench runtime section seam` | `State support descriptor`, `Basin support descriptor`, `Trajectory support descriptor`, `Query support descriptor`, `Replay support descriptor` when present | `workbench_receipt` | replace count-heavy convenience packet with descriptor-led integration view | workbench remains bounded and more informative than count-only packet |
| `Workbench compatibility alias seam` | none | none | remove `compatibility_aliases` and mirrored `interpretation` entirely | downstream surfaces no longer depend on alias duplication |
| `Cross-run session admission seam` | descriptor-capable runtime section admission | admission receipt if needed | remove interpretive-overlay admission requirement | successful runs admit on structural-support basis alone |
| `Cross-run report seam` | `State support descriptor`, `Basin support descriptor`, `Trajectory support descriptor`, `Query support descriptor` when present | comparison receipts | replace interpretive label comparison with descriptor comparison | pairwise and reproducibility outputs become evidence-led in implementation, not just prose |
| `LM wrapper extraction seam` | `State support descriptor`, `Trajectory support descriptor`, `Query support descriptor` when present, `Replay support descriptor` when present | bounded receipts when helpful | replace count-heavy packet as final target | LM packet remains bounded while giving richer support composition |
| `Reconstruction runtime support collection seam` | `Replay support descriptor`, `State support descriptor` when needed | reconstruction receipts | remove interpretive support dependence | reconstruction support basis remains structural/support only |

### Rung 1 - Remove default semantic authority from runtime assembly

Primary targets:

- `runtime/DoorOneOrchestrator.js`
- tests that require `semantic_overlay` or top-level `interpretation`

Proof target:

- runtime result remains lawful without semantic overlay
- core operator and substrate tests still pass on structural-support grounds

### Rung 2 - Define compact support descriptor surfaces

Primary targets:

- support-descriptor contracts for `H1`
- support-descriptor contracts for `M1`
- trajectory descriptor contract
- basin descriptor view
- query descriptor view
- replay descriptor view

Proof target:

- downstream read-side surfaces can consume descriptors without collapsing to
  count-only packets

### Rung 3 - Rebuild workbench around support descriptors

Primary targets:

- `runtime/DoorOneWorkbench.js`
- workbench validators
- workbench tests

Proof target:

- workbench stays bounded, diffable, and read-side-only
- workbench no longer requires compatibility aliases
- workbench descriptor sections become the primary runtime-facing integration view

### Rung 4 - Re-derive cross-run comparison

Primary targets:

- `runtime/CrossRunSession.js`
- `runtime/CrossRunDynamicsReport.js`

Proof target:

- cross-run admission no longer requires interpretation overlays
- comparisons are driven by structural-support evidence
- descriptor comparison remains deterministic and source-traceable

### Rung 5 - Rebuild reconstruction support staging

Primary targets:

- `runtime/reconstruction/`

Proof target:

- interpretive support no longer appears as a required or default support basis
- replay support basis remains explicit and bounded

### Rung 6 - Upgrade LM-facing packet

Primary targets:

- `runtime/lm/WorkbenchLmWrapper.js`
- LM input/output schemas
- benchmark harness

Proof target:

- bounded LM packet remains schema-stable
- packet becomes more informative than count-only receipt exposure
- packet remains read-side only and non-authoritative despite richer descriptor input

### Rung 7 - Retune tests and benchmark receipts

Primary targets:

- orchestrator tests
- workbench tests
- cross-run tests
- reconstruction tests
- local LM benchmark tests

Proof target:

- tests prove structure/support law directly
- tests no longer defend semantic default packaging
- tests prove descriptor routing seam by seam

## Bridge Discipline

Do not start by widening platform behavior.

The first work is subtraction and tightening:

- remove default semantic dependence
- sharpen object surfaces
- sharpen read-side exposure

## One-Line Summary

The runtime implementation bridge turns the runtime grammar corpus into a coding
order: remove default semantic dependence first, introduce support descriptors
next, then rebuild workbench, cross-run, reconstruction, LM input, and tests on
that cleaner basis.
