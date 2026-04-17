# ExecutionSurface

`ExecutionSurface` is the trimmed deterministic basis of the DME runtime.

This repo is not trying to present the whole symbolic architecture, a finished
V2 shell, or a canon system. Its current job is simpler and more valuable:
preserve a lawful execution spine, keep provenance visible, expose bounded JSON
surfaces, and give us something we can actually test before we widen autonomy.

## Active Development Front

`ExecutionSurface` is now the active use-oriented foundation for real DME v2 development.

For current development purposes, this repo is the live home of:

- deterministic executive runtime work
- provenance-first receipt design
- bounded language-kernel attachment
- benchmark and audit harness development
- workflow and morphogenesis process support built on explicit runtime receipts

This does **not** mean every future DME layer is already active here.

It means current DME v2 development should start from this repo’s executable reality and widen lawfully from this base, rather than treating it as a sidecar to a separate “real” runtime.

If we do this well, this becomes the stable executive substrate we can later
bolt language kernels, JSON handoff schemas, audit gates, and runtime ecology
onto without turning the project into prose drift.

## Current Posture

The repo should be described publicly as:

**A deterministic executive surface for provenance-first structural memory with
JSON-facing runtime receipts.**

That framing matters. It helps with support recruitment because it invites the
right kind of collaborators:

- people interested in runtime integrity
- people interested in deterministic replay and provenance
- people who can help with validation, schemas, runners, and test harnesses
- people who understand bounded orchestration and disciplined interfaces

It also filters out the wrong expectation set. This repository is not yet:

- a general-purpose agent platform
- a full autonomous recursion engine
- a polished product shell
- a proof of ontology or symbolic closure

Keeping that boundary explicit will make GitHub sharing healthier and keep
contributors aligned with what the code actually does today.

## Repository Shape

The active repository shape is now best understood as three coordinated bands.

### Runtime / commit implementation

These directories hold the execution-bearing substrate and the bounded fixtures that feed it:

- `fixtures/`: deterministic input fixtures and test data builders
- `operators/`: bounded transformation and memory operators
- `runtime/`: orchestration, workbench assembly, cross-run observation, and reconstruction-adjacent runtime support
- `test_signal/`: signal material used by fixtures and replay-style checks

### Read-side / control surfaces

These directories hold the machine-facing receipt, wrapper, benchmark, and validation surfaces that attach to the executive substrate without bypassing it:

- `schemas/`: JSON schema layer for bounded receipts, wrapper inputs/outputs, and process surfaces
- `scripts/`: machine-facing runners that emit JSON artifacts, staging surfaces, and benchmark outputs
- `tests/`: contract, runtime, reconstruction, wrapper, and benchmark checks
- `Transformer/LanguageKernel/`: early kernel attachment surface and schema-adjacent materials

### Repo-level orientation surfaces

These files define the current self-description and development posture of the repo:

- `README.md`
- `ARCHITECTURE.md`

## Runtime / commit authority

The runtime / commit authority of this repo is the narrowest execution-bearing path that transforms admitted input and lawfully commits bounded state into substrate continuity.

The active runtime / commit spine is:

1. `IngestOp`
2. `ClockAlignOp`
3. `WindowOp`
4. `TransformOp`
5. `CompressOp`
6. `AnomalyOp`
7. `MemorySubstrate.commit(...)`

This path is authoritative only for:

- deterministic transformation of admitted inputs
- policy-bounded state transition
- preservation of declared lineage and policy anchors
- lawful commit into substrate continuity

## Read-side / observation and control band

Everything downstream of commit that exposes, compares, reconstructs, summarizes, stages, validates, or benchmarks runtime-visible state belongs to the read-side / observation and control band.

This includes:

- bounded read-side substrate access
- `MergeOp`
- `ReconstructOp`
- `QueryOp`
- trajectory and cross-run observation
- `runtime/DoorOneWorkbench.js`
- LM wrapper / staged invocation surfaces
- benchmark and validation surfaces
- workflow and morphogenesis process-support surfaces built on explicit receipts

These surfaces are useful and often essential, but they are not the same thing as runtime / commit authority.

They must not silently promote themselves into:

- substrate authority
- canon authority
- truth authority
- symbolic closure
- unrestricted runtime mutation

## Key runtime entry points

The main coordination surfaces are:

- `runtime/DoorOneOrchestrator.js`
- `runtime/DoorOneExecutiveLane.js`
- `runtime/DoorOneWorkbench.js`

These coordinate runtime execution and read-side exposure, but they do not erase the distinction between the runtime / commit spine and the downstream read-side / control band.

## Key runner entry points

The primary machine-facing entry points remain:

- `scripts/run_pipeline_substrate.js`
- `scripts/run_door_one_live.js`
- `scripts/run_door_one_workbench.js`
- `scripts/run_door_one_provenance_digest.js`

Preferred posture:

- kernels read bounded JSON receipts and summaries
- kernels emit advisory or separately gated outputs only
- kernels do not bypass operators or mutate substrate authority
- workflow and process-support layers ride on explicit receipts, not prose improvisation

## Supporting documents

Supporting orientation surfaces include:

- `ARCHITECTURE.md`: compact statement of the present architectural basis
- `tests/test_manifest.json`: explicit classification of active tests into `core`, `reconstruction`, `probe`, and `legacy_hold`
- `schemas/`: JSON schema layer for compact runtime receipts, LM wrapper contracts, benchmark receipts, and process-support surfaces

These surfaces support the repo’s use-oriented development posture, but they do not outrank executable runtime reality.

## Authority Boundaries

The code in this repo is authoritative only within the runtime / commit spine and the truthful read-side exposure of what that spine actually produced.

This repo is authoritative for:

- deterministic transformation of admitted input
- policy-bounded commits into substrate continuity
- provenance-preserving receipts
- truthful bounded read-side summaries over runtime-visible state
- explicit JSON-facing attachment surfaces for kernels, wrappers, and benchmark harnesses

This repo is not authoritative for:

- canon decisions
- symbolic truth claims
- promotion or publication readiness
- unconstrained agentic orchestration
- language-model judgments that bypass runtime receipts
- workflow or morphogenesis claims that outrun executable repo reality

That boundary matters because the next build phases will continue adding control and process layers on top of these receipts.

If authority is not kept narrow here, the language and workflow layers will start pretending to be the substrate instead of remaining attached to it lawfully.

## What Was Intentionally Trimmed

The current basis was deliberately reduced to protect the executive core.

Removed or de-emphasized surfaces include:

- promotion-readiness packaging
- canon-candidate packaging
- consensus and consultation layers
- door-two runners
- archive and pin-packet publication paths
- review-heavy replay surfaces that depended on the removed packaging layer

What remains is the part we can reasonably stabilize and verify.

## Contribution Posture

If you want help from outside contributors, the most useful posture is:

1. recruit support for determinism, validation, and runtime hardening first
2. recruit schema and harness help second
3. recruit broader language-kernel experimentation only after the runtime receipts are stable

In practice, good contribution targets right now are:

- tightening operator contracts
- replay and provenance verification
- runner cleanup
- failure fencing and invariant checks
- JSON schema scaffolding
- benchmark harnesses for audit and gate behavior

Less helpful right now:

- adding broad philosophical layers
- reintroducing review/canon stacks
- multiplying agent surfaces before the receipts are trustworthy
- letting multiple writers mutate the same live artifact without hard boundaries

The repo will stay healthier if we preserve a simple rule:

**one authoritative writer on the execution surface at a time, with every other
lane restricted to advisory or read-side output until the protocol layer is
formalized.**

## Testing Program

The immediate testing goal is not "maximum breadth." It is confidence that the
remaining runtime basis is stable enough to become the anchor for JSON
execution contracts.

### Tier 1: Core Determinism

These tests should stay green on every structural change:

- substrate contracts
- orchestrator contracts
- door-one workbench contracts
- executive lane contracts
- cross-run session behavior
- provenance digest behavior

Today, the core command is:

```bash
npm run test:core
```

This is the minimum keep-green bar for the repo.

The active structural surface can be checked with:

```bash
npm run test:active
```

That adds the bounded reconstruction tests on top of the core runtime bar.

Schema and receipt contract checks now ride inside the active surface:

```bash
npm run test:receipt-schemas
```

### Tier 2: Provenance Retention

We should confirm that repeated runs preserve the right receipts and do not lose
lineage when state changes, merges, or bounded summaries occur.

Focus areas:

- stable retention of run receipts
- correct cycle-to-cycle deltas
- cross-run summary continuity
- no silent mutation of prior provenance artifacts

### Tier 3: Fencing And Failure Discipline

Before widening automation, the runtime should prove it fails cleanly.

Focus areas:

- anomaly and merge fencing
- ingest hardening
- invalid input rejection
- policy mismatch handling
- reconstruction failure surfaces that stay truthful instead of fabricating support

### Tier 4: Replay Stability

This layer checks that deterministic re-execution stays meaningfully stable.

Focus areas:

- same input, same structural output
- bounded tolerance where floating or windowing details require it
- no drift in retained summaries
- no cross-run contamination from stale artifacts

### Tier 5: Soak And Continuity Runs

Once the core is tighter, we should run longer repeated-cycle executions to
check whether the executive lane remains legible over time.

Focus areas:

- accumulation stability over many cycles
- recurrence and convergence behavior
- source switching behavior
- output directory hygiene
- artifact retention policies

## Recommended Stability Gates

Before we start serious JSON runtime ecology work, I would use these gates:

1. `npm run test:core` passes consistently after cleanup changes.
2. The exploratory tests we keep are clearly labeled as either contract, probe, or reconstruction checks.
3. The runtime can replay fixed fixtures without unexplained output drift.
4. Provenance artifacts remain diffable and structurally small enough to inspect.
5. Reconstruction surfaces either conform to the new structural basis or are explicitly quarantined.

That last point matters. Right now `runtime/reconstruction/` is still a bridge
surface. It is useful, but it should be tightened against the trimmed runtime so
it does not quietly carry assumptions from the removed review stack.

## Near-Term Reconstruction Work

The best energy next is probably not adding more conceptual surface area. It is
tightening the remaining basis so the later JSON layer has a stable host.

Recommended order:

1. classify the surviving tests into `core`, `probe`, `reconstruction`, and `legacy-hold`
2. tighten `runtime/reconstruction/` to the new structural-only workbench contract
3. remove or quarantine any read-side code that still assumes promotion, canon, or consensus layers
4. normalize output artifact shapes so JSON receipts are small, explicit, and diffable
5. only then begin the formal handoff schemas and execution protocol runner

## What Comes After This

Once the runtime basis is tight, the next phase can be intentionally small:

- JSON handoff envelopes
- schema validators
- cycle logs
- active subject registers
- role response contracts
- benchmarked audit and gate decisions

That gives us a path toward a mechanized recursion loop without asking the
language layer to improvise state management in prose.

## Working Rule

If there is a choice between:

- adding expressive surface area
- making runtime state, provenance, and contracts more explicit

pick the second one.

That is the move most likely to make this repo stable, shareable, and actually
usable as the executive basis for the next stage.
