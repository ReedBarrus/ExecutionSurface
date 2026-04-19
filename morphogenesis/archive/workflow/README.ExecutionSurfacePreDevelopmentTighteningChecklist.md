# ExecutionSurface Pre-Development Tightening Checklist

## Status

This document tracks bounded cleanup before wider development resumes.

It is a workflow support surface, not an implementation contract.

## Working rule

Only tighten what improves:

- deterministic execution
- direct object exposure
- provenance clarity
- schema and runner coherence
- benchmark usefulness

Do not use this checklist to smuggle in speculative layers.

## Phase 1 - artifact and residue hygiene

- [x] Decide which generated outputs are disposable and regenerable.
- [x] Ignore generated output directories by default.
- [x] Untrack transient LM/workbench output surfaces.
- [x] Remove drifting prompt duplicates and stale generated residue.

## Phase 2 - semantic residue removal

- [x] Remove default runtime semantic overlays and compatibility aliases.
- [x] Remove interpretation helper modules from active runtime.
- [x] Remove interpretation-dependent tests from active runners.
- [x] Delete probe tests that require interpretation as positive contract.
- [ ] Sweep remaining docs for descriptor-first or receipt-first language.

## Phase 3 - object-first doctrine hardening

- [ ] Keep direct structural/support object exposure explicit in repo-level docs.
- [ ] Mark typed refs as the first fallback when direct object drag-forward is too coupled.
- [ ] Mark bounded packaging as second fallback only.
- [ ] Mark receipts as subordinate audit surfaces only.
- [ ] Keep read-side projections explicitly non-authoritative.

## Phase 4 - lawful compression seam review

- [ ] Tighten `runtime/lm/WorkbenchLmWrapper.js` toward typed refs or bounded object cards.
- [ ] Recheck `runtime/CrossRunDynamicsReport.js` so comparison vectors stay clearly derived from direct objects.
- [ ] Recheck live provenance and digest scripts so structural markers remain explicitly secondary.
- [ ] Identify any remaining read-side surface that still acts as if counts alone are meaningful runtime truth.

## Phase 5 - benchmark and runner coherence

- [ ] Keep the active test manifest aligned with the reduced probe band.
- [ ] Keep benchmark outputs compact, diffable, and non-authoritative.
- [ ] Make the supported LM invocation path explicit and boring.
- [ ] Preserve only benchmark fixtures that are intentionally kept.

## Phase 6 - next development gate

This tightening pass is complete enough when:

- direct object exposure is the documented default
- semantic residue is removed from active runtime and stale probes
- lawful compression seams are clearly identified as fallback transport/comparison layers
- the path is clear for object-facing LM packets and stronger read-side graph/projection work

At that point cleanup should stop and active bounded development should resume.
