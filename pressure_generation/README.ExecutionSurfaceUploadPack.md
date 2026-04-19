# ExecutionSurface Upload Pack

## Status

This document defines the compact document pack for upload-limited contexts such
as a 25-file project limit.

It is a convenience surface.

It does not replace the underlying docs.

## Goal

Keep the upload set:

- under the file limit
- topology-first
- runtime-grounded
- light on historical residue

## Recommended upload pack

### Core repo posture

1. `README.md`
2. `ARCHITECTURE.md`

### Matrix authority

3. `README.EX.ConstraintMatrix.md`
4. `README.EX.FormationMatrix.md`
5. `README.EX.DecisionMatrix.md`
6. `README.EX.EvaluationMatrix.md`
7. `README.EX.MemoryMatrix.md`
8. `README.EX.SeamDisciplineContract.md`

### Runtime and architecture front

9. `pressure_generation/architecture/README.ExecutionSurfaceArchitectureSeed.md`
10. `pressure_generation/architecture/README.ExecutionSurfaceImplementationLadder.md`
11. `pressure_generation/architecture/runtime_grammar/README.RuntimeGrammarCompilation.md`
12. `pressure_generation/workflow/README.ExecutionSurfaceSubjectRegistry.md`
13. `pressure_generation/workflow/README.WorkflowCompilation.md`

### Optional add-ons when room remains

14. `pressure_generation/README.ExecutionSurfaceFutureDebateSurface.md`
15. `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceRuntimeGrammarCorpus.md`
16. `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceMemoryObjectEnvelope.md`
17. `pressure_generation/architecture/runtime_grammar/README.ExecutionSurfaceSubstrateTopology.md`

## Excluded by default

Do not upload by default:

- archived workflow history
- cycle logs
- transitional archive audits
- old support-band docs already extracted into the future-debate surface
- generated artifacts from `out_lm/` or `out_workbench/`

## One-line summary

This upload pack keeps the live `ExecutionSurface` architecture, workflow, and
runtime grammar under the file limit by using compilation docs for the workflow
and runtime-grammar bands while leaving the source docs intact in-repo.
