# DME Language Kernel Early Operation Posture v0

## Status

This note defines the bounded early-operation posture for current local-model Language Kernel work.

It sits below:

* `README.LanguageKernelContract.v0.md`
* `README.LanguageKernelBenchmarkContract.v0.md`
* `README.SemanticOverlayContract.v0.md`

It does not widen authority.

Its purpose is narrower:

* normalize first-turn operation modes,
* define current conformance outcome vocabulary,
* preserve explicit downgrade/abort posture for nonconformant local-model output,
* and bound the current two-model panel used for early contract hardening.

---

## 1. Current seam inventory

The active Language Kernel packet zone currently contains:

* contract/spec files in `README/Transformer/LanguageKernel/`
* validator logic in `Transformer/LanguageKernel/validator/`
* benchmark runner logic in `Transformer/LanguageKernel/benchmarks/`
* fixture/example/output artifacts in `Transformer/LanguageKernel/`
* manual-loop prompt/export/raw-response artifacts in `Transformer/LanguageKernel/outputs/`

This is enough to support bounded local-model conformance hardening without widening into runtime, HUD, canon, or orchestration layers.

---

## 2. Early operation modes

Three early operation modes are recognized.

### 2.1 `contract_conformance_mode`

This is the active first goal.

It is used when the question is:

**Can the model produce at least one lawful first-turn reasoning frame from a valid export packet?**

Required posture:

* JSON only
* no prose outside JSON
* top-level `language_frames` array only
* at least one full reasoning frame on first turn when export packet exists
* fixed `legal_claim` exactness
* fixed `what_next` exactness
* no metadata-summary pseudo-frame substitution

### 2.2 `bounded_review_mode`

This is the active fallback mode when strict first-turn conformance is not yet attained but the response is still usefully classable.

It is used when the question is:

**What bounded downgrade posture best describes the current failure or partial-conformance state?**

Required posture:

* explicit classification, not silent repair
* preserve raw-response evidence
* preserve export-packet grounding
* preserve exact detection of missing or substituted fields
* produce downgraded or aborted artifacts honestly

### 2.3 `recursive_continuity_mode`

This mode is deferred.

It belongs to later work only after first-turn contract conformance is stable enough to support lawful recursion pressure testing.

It must not be treated as active just because the model can emit frame-like JSON.

---

## 3. Current conformance outcome vocabulary

The current normalized outcome vocabulary is:

* `contract_conformant`
* `downgraded_conformance_gap`
* `aborted_contract_failure`
* `aborted_empty_first_turn_output`
* `aborted_empty_first_turn_frame_list`
* `aborted_nested_wrong_shape_output`
* `aborted_metadata_summary_pseudo_frame`
* `aborted_extra_prose_leakage`
* `aborted_fixed_string_failure`
* `downgraded_partial_frame_conformance`
* `downgraded_near_valid_incomplete_frame`

These labels are:

* response-receipt and benchmark-facing evaluation labels,
* review artifacts only,
* not readiness labels,
* not canon labels,
* and not proof of stronger memory, identity, or intelligence posture.

---

## 4. Failure-class intent

The currently observed manual-loop failures should map as follows:

* empty output -> `aborted_empty_first_turn_output`
* empty `language_frames` on usable first turn -> `aborted_empty_first_turn_frame_list`
* `language_frames.frames` or other nested wrong-shape envelope -> `aborted_nested_wrong_shape_output`
* export-packet or receipt summary posing as a frame -> `aborted_metadata_summary_pseudo_frame`
* prose before/after JSON -> `aborted_extra_prose_leakage`
* paraphrased or substituted fixed strings -> `aborted_fixed_string_failure`
* incomplete frame missing multiple required contract fields -> `downgraded_partial_frame_conformance`
* near-valid frame preserving exact literals but missing required contract fields -> `downgraded_near_valid_incomplete_frame`

When multiple failures appear at once, the primary outcome should prefer the most structurally informative contract failure, while secondary facts remain visible through receiver flags and notes.

---

## 5. Two-model panel posture

Current local-model panel work is explicitly bounded to:

* `Hermes 3 Llama 3.2 3B`
* `Meta Llama 3.1 8B Instruct`

This panel is:

* comparative only,
* bounded to early contract hardening,
* below any readiness or promotion posture,
* and not a general model leaderboard.

No additional models should be added to the current panel inside this packet.

---

## 6. Prompt hardening posture

The active first-turn prompt should:

* instruct first-turn frame emission explicitly,
* forbid empty frame lists when export packet is usable,
* forbid metadata-summary pseudo-frames,
* forbid extra prose outside JSON,
* require the exact fixed strings,
* and keep recursion explicit-only.

If the model still fails, the seam should classify that failure honestly rather than smoothing it into apparently valid output.
