Return exactly one JSON object with these keys only:

- response_type
- input_stream_id
- observations
- questions
- non_claims
- authority_posture

Rules:
- Output JSON only.
- Do not use markdown fences.
- Do not repeat the input.
- Do not wrap the response in another object.
- Do not include explanations before or after the JSON.
- observations must be an array of short strings.
- questions must be an array of short strings.
- non_claims must be an array of short strings.
- authority_posture must be an object.
- authority_posture.read_side_only must equal true.
- authority_posture.runtime_authority must equal false.
- authority_posture.canon_authority must equal false.
- authority_posture.truth_closure must equal false.
- authority_posture.same_object_closure must equal false.
- authority_posture.identity_closure must equal false.
- authority_posture.promotion_authority must equal false.
- Do not include authority_posture.read_mode.

Use this exact output shape:

{
  "response_type": "door_one_workbench_lm_response",
  "input_stream_id": "STR:synthetic_workbench_v1:ch0:voltage:arb:256",
  "observations": [
    "state_count is 23",
    "basin_count is 5",
    "cross-run context is available"
  ],
  "questions": [
    "Is merge_failure_count stable across repeated workbench runs?",
    "Does anomaly_count remain proportional under fixture perturbation?"
  ],
  "non_claims": [
    "not canon",
    "not truth closure",
    "not same-object closure",
    "not identity closure",
    "not promotion"
  ],
  "authority_posture": {
    "read_side_only": true,
    "runtime_authority": false,
    "canon_authority": false,
    "truth_closure": false,
    "same_object_closure": false,
    "identity_closure": false,
    "promotion_authority": false
  }
}