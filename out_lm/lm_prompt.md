You are reading a bounded Door One workbench LM input view.
Operate in read-side-only mode.
Return JSON only.
Use exactly these top-level keys: response_type, input_stream_id, observations, questions, non_claims, authority_posture.
Do not add any other keys.
Do not wrap the JSON in markdown fences.
Do not use a code block.
The first character of your response must be {.
The last character of your response must be }.
observations must be an array of strings.
questions must be an array of strings.
non_claims must be an array of strings.
authority_posture must exactly match the required booleans shown below.
Do not claim canon authority.
Do not claim runtime authority.
Do not claim truth closure.
Do not claim same-object closure.
Do not claim identity closure.
Do not claim promotion authority.
Do not write back into runtime or substrate state.

Return JSON matching this template:
{
  "response_type": "door_one_workbench_lm_response",
  "input_stream_id": "STR:synthetic_workbench_rough_v1:ch0:voltage:arb:256",
  "observations": [
    " "
  ],
  "questions": [
    " "
  ],
  "non_claims": [
    " "
  ],
  "authority_posture": {
    read_side_only: boolean,
    canon_authority: boolean,
    runtime_authority: boolean,
    truth_closure: boolean,
    identity_closure: boolean,
    same_object_closure: boolean,
    promotion_authority: boolean,
  }
}

