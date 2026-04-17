# ExecutionSurface — Seam Discipline Contract

Live Repo State:
https://github.com/ReedBarrus/ExecutionSurface

## Status

This document governs seam discipline for bounded code-touch passes inside the
active ExecutionSurface development front.

It exists to minimize:

- drift
- churn
- mixed-role edits
- premature diagnosis
- silent scope widening
- unnecessary multi-seam mutation

It does not override:

- `README.EX.ConstraintMatrix.md`
- `README.EX.FormationMatrix.md`
- `README.EX.DecisionMatrix.md`
- `README.EX.EvaluationMatrix.md`
- `README.EX.MemoryMatrix.md`

It is a seam-local contract under the active matrix authority stack.

It inherits thread-class, role, packet, and macro-verb law from the Decision Matrix.

This contract only tightens code-touch behavior at the active seam.

---

## 1. Contract function

This contract exists only to answer:

- how an active code-touch seam is bounded before mutation
- how diagnosis is verified before edits are proposed
- how file scope is constrained
- how changes remain small and reversible
- how reporting stays explicit
- how drift and churn are reduced during collaborative code work

Nothing else belongs here.

---

## 2. Core seam invariant

No code-touch pass may:

- silently widen the active seam
- mix structural roles for convenience
- inflate the authority of the touched surface
- mutate neighboring seams opportunistically
- convert diagnosis into redesign without explicit escalation

At minimum, a code-touch pass must preserve:

- active seam clarity
- current repo reality
- constraint-bearing identity
- class separation
- explicit non-claims
- bounded acceptance target

---

## 3. Scope of this contract

This contract applies directly to:

- `seam_repair` thread class
- code-touch `implementation_mutation` thread class

It does not by itself govern:

- morphogenesis thread behavior
- live subject-surface mutation in architecture threads
- evaluation closure
- memory retention / reconstruction posture
- repo placement law

Morphogenesis may touch text surfaces under Decision Matrix law, but that is not
the primary concern of this contract.

This contract is specifically for implementation-facing seam mutation.

---

## 4. One-seam rule

Only one seam may be active per pass.

Every code-touch pass must declare:

- thread class
- active seam
- active macro verb
- primary role
- files in scope
- non-goals
- expected emitted object
- acceptance target

If the seam cannot be named clearly, the pass is not ready.

If more than one seam is required, the pass must stop, hand off, or escalate.

---

## 5. Full-chain verification first

Before projecting a fault location, proposing a fix, or asking the operator to
inspect a seam, the full active executable chain that is accessible must be checked.

Minimum chain check:

- source generator / fixture seam
- runtime / orchestrator seam
- emitted runtime artifact seam
- wrapper / extraction seam
- staged input seam
- consuming invocation / benchmark seam

Only then may the narrowest demonstrated failure point be named.

No diagnosis may be stated as confirmed until:

- checked seams are stated
- demonstrated failure point is stated
- unverified seams are explicitly named

If the full chain cannot be checked, that limitation must be stated explicitly
before a diagnosis is proposed.

---

## 6. File-scope rule

Every code-touch pass must name exact files in scope.

A pass may:

- edit only files in scope
- create bounded support files in scope
- repair lawful local references in scope
- adjust immediate local tests or fixtures in scope when explicitly declared

A pass may not:

- widen to neighboring seams silently
- refactor unrelated files opportunistically
- bundle architecture redesign with local seam repair
- mutate runtime, wrapper, validator, benchmark, and documentation layers together unless that mixed touch is explicitly declared and justified
- preserve a mixed-role file merely because it is convenient

---

## 7. Smallest lawful edit rule

Prefer the smallest reversible change that resolves the demonstrated seam failure.

Preferred order:

1. config / policy correction
2. validator / contract correction
3. local seam repair
4. bounded extraction / wrapper repair
5. broader restructuring only when smaller seams are proven insufficient

Do not widen the active seam until the current seam is demonstrated insufficient.

Do not perform a larger edit merely because it feels cleaner unless the smaller
lawful edit has been ruled out explicitly.

---

## 8. Structural separation rule

A code-touch pass must preserve distinction between:

- runtime operators
- execution coordination seams
- validators
- shape definitions
- read-side projections
- helper scripts
- generated artifacts
- documentation

Mixed-role edits must be explicit and should be split when lawful.

If a pass touches more than one class boundary, that must be declared before mutation.

---

## 9. Generated artifact rule

Generated artifacts may be used as evidence, comparison material, or acceptance proof.

Generated artifacts include, for example:

- `out_workbench/`
- `out_lm/`
- `benchmarks/`

Generated artifacts may support:

- diagnosis
- diffing
- replay checks
- wrapper comparison
- benchmark comparison

Generated artifacts may not by themselves settle:

- runtime authority
- structural authority
- canon
- truth
- promotion

No code-touch pass may silently treat emitted artifacts as if they outrank runtime reality.

---

## 10. Reporting rule

After each code-touch pass, report only:

- thread class
- active seam
- files checked
- files changed
- what was confirmed
- what remains unverified
- narrowest demonstrated failure point
- emitted object or explicit block
- next smallest legal move

Do not report guessed causes as confirmed causes.

Do not report future redesign as if it were completed work.

Do not compress unresolved uncertainty into confidence.

---

## 11. Stop conditions

Stop and re-bound when:

- more than one seam becomes active
- file scope grows during the pass
- class boundaries become unclear
- diagnosis depends on unverified seams
- the pass begins proposing architecture instead of resolving the active seam
- the pass silently changes thread class
- ambiguity increases rather than decreases

If ambiguity increased, compression failed and the pass is incomplete.

---

## 12. Acceptance rule

A code-touch pass is complete only when one of the following is true:

- the active seam produced its expected emitted object
- the acceptance target was met
- the pass blocked honestly with the demonstrated reason
- the pass lawfully escalated or handed off with preserved scope

A pass is not complete merely because code changed.

A pass is not complete merely because the model produced a plausible explanation.

---

## 13. Handoff and escalation rule

If the active seam cannot be resolved inside its declared thread class and file scope:

- hand off
- escalate
- or defer

Do not silently convert:

- `seam_repair` into `implementation_mutation`
- `implementation_mutation` into architecture redesign
- local repair into repo-wide cleanup

Handoff must preserve:

- thread class
- active seam
- active macro verb
- scoped files
- governing constraint posture
- current emitted-object status

Escalation must state exactly why the active thread class is insufficient.

---

## 14. Minimal packet for code-touch passes

Before any code-touch request, the initiating packet should provide at minimum:

- thread class
- active seam
- files in scope
- expected emitted object
- current artifact or test proving need
- non-goals
- acceptance target

A stronger packet also includes:

- active macro verb
- primary role
- checked chain
- what is already ruled out

If this packet is missing, the pass is not ready.

---

## 15. Response shape for code-touch assistance

For bounded code-touch help, the preferred response shape is:

- checked chain
- demonstrated failure point
- exact edit target
- exact replacement scope
- non-claims

This shape is not sovereign workflow law by itself.

It is the preferred local assistance format under this seam contract.

---

## 16. One-line review question

Did this code-touch pass verify the full active executable chain before diagnosis,
touch only one declared seam in exact file scope, make the smallest lawful edit,
preserve structural role separation, and report only what was actually demonstrated?

---

## 17. One-line summary

Touch one seam at a time, verify the full active chain before diagnosis, mutate
only exact file scope inside the declared code-touch thread class, preserve class
separation and non-claims, and complete the pass only by demonstrated repair,
honest block, or lawful handoff.