# ExecutionSurface Runtime Implementation Bridge

## Status

This bridge translates the runtime grammar corpus into implementation order.

It does not replace the broader implementation ladder.

## Core rule

Implementation should now follow this order:

1. remove unlawful semantic or receipt-led defaults
2. preserve direct structural/support object carriage wherever the seam can bear it
3. add typed refs where full drag-forward is too coupled
4. add bounded object cards or compact projections only where direct objects or refs fail
5. keep receipts subordinate
6. retune read-side transport and benchmarks around that object-first posture

## Active correction corridor

The main bridge no longer starts from descriptor-family rollout.

It starts from proving and hardening direct object exposure.

### Rung 1 - keep runtime assembly direct

Primary targets:

- `runtime/DoorOneOrchestrator.js`
- `runtime/DoorOneWorkbench.js`
- core orchestrator/workbench tests

Proof target:

- operator artifacts remain directly exposed
- substrate state remains directly exposed
- semantic overlay does not re-enter
- receipts stay subordinate

### Rung 2 - keep substrate and read-side seams object-bearing

Primary targets:

- `operators/substrate/MemorySubstrate.js`
- query/replay seams
- basin/trajectory exposure paths

Proof target:

- commit uses direct support objects
- retrieval returns direct objects or safe copies
- no seam above `H1` is forced into receipt-only shape

### Rung 3 - tighten lawful compression seams

Primary targets:

- `runtime/CrossRunDynamicsReport.js`
- `scripts/run_door_one_live.js`
- `scripts/run_door_one_provenance_digest.js`

Proof target:

- derived projections are explicitly secondary
- inputs remain traceable to upstream objects
- projections do not become authority carriers

### Rung 4 - retune LM staging

Primary targets:

- `runtime/lm/WorkbenchLmWrapper.js`
- LM schemas
- LM benchmark harness

Proof target:

- LM packets stop pretending receipt counts are enough
- packet remains bounded and non-authoritative
- next packet shape prefers typed refs or bounded object cards over flat summaries

### Rung 5 - only then consider helper packaging

If a seam still cannot function lawfully on direct objects or typed refs, add the
smallest bounded helper packaging that solves that local problem.

Packaging is a fallback, not the implementation center.

## Current read on the repo

The runtime has already moved farther than the older bridge assumed:

- orchestrator is object-first
- workbench is object-first
- interpretation seams are removed from active runtime

The main remaining work is not descriptor construction.

It is:

- hardening object-first doctrine in docs and tests
- reducing stale probe expectations
- retuning LM and comparison seams so their compression remains explicitly secondary

## One-line summary

The implementation bridge now starts by preserving direct object truth, uses
typed refs before packaging, and treats any bounded projection as a local
fallback rather than the runtime’s primary expression.
