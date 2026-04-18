# ExecutionSurface Pre-Development Tightening Checklist

## Status

This document is a bounded pre-development cleanup and tightening checklist for
the current `ExecutionSurface` repo.

It is a workflow support surface.

It is not an authority file, architectural subject release, or implementation
contract.

Its purpose is narrower:

- capture the current tightening backlog explicitly
- keep cleanup scoped to real blockers and friction points
- prevent repo hygiene work from turning into architecture drift
- give us an ordered burn-down list before wider substrate development resumes

---

## Working rule

Only tighten what improves:

- deterministic execution
- bounded read-side clarity
- artifact hygiene
- schema / runner coherence
- benchmark usefulness

Do not use this checklist to smuggle in:

- new autonomy layers
- broader orchestration
- speculative runtime architecture
- large refactors without a concrete bounded gain

---

## Phase 1 — Artifact hygiene

- [x] Decide which generated outputs are source-like fixtures versus disposable run artifacts.
- [x] Add explicit ignore posture for generated directories or files that should not live as default tracked state.
- [x] Separate canonical example artifacts from transient local run residue in `out_workbench/`.
- [x] Separate canonical example artifacts from transient local run residue in `out_lm/`.
- [x] Separate preserved benchmark exemplars from timestamped benchmark residue in `benchmarks/results/`.
- [x] Remove or archive stale run folders once exemplar fixtures have been preserved intentionally.
- [x] Eliminate duplicate or drifting prompt artifacts such as parallel `.txt` and `.md` prompt surfaces when only one should be live.

---

## Phase 2 — Surface contraction

- [ ] Decide whether top-level compatibility alias mirroring should remain in `runtime/DoorOneWorkbench.js` or be narrowed to `compatibility_aliases` only.
- [ ] If compatibility alias mirroring is narrowed, update tests and docs so downstream expectations stay explicit.
- [ ] Tighten the live LM-facing packet posture so it is clear which fields are durable contract and which are transitional bridge material.
- [ ] Mark any legacy-support or transitional surfaces explicitly so they stop competing with current runtime / LM attachment seams.

---

## Phase 3 — Runner and toolchain consolidation

- [ ] Decide whether `scripts/run_local_lm_benchmark_enumerated.js` is active, deferred, or removable.
- [ ] If kept, expose the enumerated benchmark runner through `package.json`, align its model default, and add at least one bounded test.
- [ ] If not kept, remove it before it becomes silent surface area.
- [ ] Normalize emitted benchmark receipt paths so path formatting is stable across generated artifacts.
- [ ] Review runner outputs for mixed manual / automated posture and make the current supported invocation path explicit.

---

## Phase 4 — Documentation posture cleanup

- [ ] Add a short ownership map naming which directories are source, fixtures, generated outputs, historical experiments, and transitional support surfaces.
- [ ] Keep `runtime/lm/` documented as the single active LM attachment lane so removed or historical side paths do not silently regrow.
- [ ] Reconcile `ExperimentResults/` with current repo posture so it is clear whether those files are historical notes, active benchmark evidence, or removable clutter.
- [ ] Update public-facing docs where generated outputs currently read as more authoritative than intended.

---

## Phase 5 — Benchmark basis tightening

- [ ] Preserve one or two benchmark runs intentionally as fixtures rather than treating all historical runs as equal source material.
- [ ] Keep `.json` contract obedience benchmarking intact while narrowing old residue that obscures what the current benchmark actually proves.
- [ ] Identify the minimal benchmark receipt set we want to keep under versioned inspection.
- [ ] Defer broader usefulness scoring changes until the object-facing LM packet surface is real enough to justify them.

---

## Phase 6 — Tightening target before new development

These are not cleanup patches by themselves, but they define what the cleanup is
clearing the path for.

- [ ] Move the next LM-facing read packet from count-heavy receipt exposure toward bounded object-facing exposure.
- [ ] Introduce typed object refs rather than relying on flat summary-only payloads.
- [ ] Introduce compact bounded object cards rather than raw substrate drag-forward.
- [ ] Keep declared lens, bounded evidence, and explicit non-claims first-class in the next packet shape.
- [ ] Use that object-facing packet as the basis for future usefulness, addressability, and reconstruction benchmarking.

---

## Completion posture

This tightening pass is complete enough when:

- generated artifact posture is explicit
- transitional surfaces are named and reduced
- runner entry points are coherent
- docs no longer blur source versus output versus history
- the path is clear for retained-object addressability, reconstruction export, and LM read-packet implementation work

At that point, cleanup should stop and active bounded development should resume.
