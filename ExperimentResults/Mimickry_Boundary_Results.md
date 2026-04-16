Mimickry boundary

lm_prompt:
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

lm_input:
{
  "input_type": "door_one_workbench_lm_view",
  "workbench_type": "runtime:door_one_workbench",
  "scope": {
    "stream_id": "STR:synthetic_workbench_rough_v1:ch0:voltage:arb:256",
    "source_id": "synthetic_workbench_rough_v1",
    "segment_ids": [
      "seg:STR:synthetic_workbench_rough_v1:ch0:voltage:arb:256:0",
      "seg:STR:synthetic_workbench_rough_v1:ch0:voltage:arb:256:1",
      "seg:STR:synthetic_workbench_rough_v1:ch0:voltage:arb:256:2",
      "seg:STR:synthetic_workbench_rough_v1:ch0:voltage:arb:256:3",
      "seg:STR:synthetic_workbench_rough_v1:ch0:voltage:arb:256:4",
      "seg:STR:synthetic_workbench_rough_v1:ch0:voltage:arb:256:5"
    ],
    "cross_run_available": true,
    "run_count": 3
  },
  "runtime_receipt": {
    "state_count": 22,
    "basin_count": 8,
    "segment_count": 5,
    "trajectory_frames": 22,
    "segment_transition_count": 5,
    "h1_count": 15,
    "m1_count": 7,
    "anomaly_count": 10,
    "query_present": true,
    "skipped_window_count": 2,
    "merge_failure_count": 0
  },
  "claim_posture": {
    "authority": "read_side_only",
    "forbidden": [
      "canon",
      "truth",
      "same_object_closure",
      "identity_closure",
      "promotion",
      "runtime_writeback"
    ]
  }
}

Responses:

Qwen-2.5 VL 7B
{
  "response_type": "door_one_workbench_lm_response",
  "input_stream_id": "STR:synthetic_workbench_rough_v1:ch0:voltage:arb:256",
  "observations": [
    ""
  ],
  "questions": [
    ""
  ],
  "non_claims": [
    ""
  ],
  "authority_posture": {
    read_side_only: true,
    canon_authority: false,
    runtime_authority: false,
    truth_closure: false,
    identity_closure: false,
    same_object_closure: false,
    promotion_authority: false
  }
}

Phi 4
```json
{
  "response_type": "door_one_workbench_lm_response",
  "input_stream_id": "STR:synthetic_workbench_rough_v1:ch0:voltage:arb:256",
  "observations": [
    "The input type is door_one_workbench_lm_view.",
    "The workbench type specified is runtime:door_one_workbench.",
    "The stream ID provided is STR:synthetic_workbench_rough_v1:ch0:voltage:arb:256.",
    "There are six segment IDs listed in the scope.",
    "Cross-run availability is set to true, indicating data across multiple runs can be accessed.",
    "A total of 3 runs are specified within the scope.",
    "The runtime receipt includes a state count of 22 and a basin count of 8.",
    "There are 5 segments counted in the runtime receipt.",
    "Trajectory frames amount to 22 as per the runtime receipt.",
    "Segment transitions have occurred 5 times according to the data.",
    "H1 events number at 15, while M1 events are recorded at 7.",
    "Anomalies detected total 10 based on the runtime receipt.",
    "Query presence is confirmed with a boolean value of true.",
    "The skipped window count stands at 2, suggesting some data windows were omitted.",
    "There have been no merge failures as indicated by the merge failure count of 0."
  ],
  "questions": [
    "What specific details are contained within each segment ID?",
    "How does cross-run availability influence data analysis?"
  ],
  "non_claims": [
    "This response only observes and reports on the provided input without making any additional claims.",
    "No assertions about canon, runtime, or identity authority are made."
  ],
  "authority_posture": {
    "read_side_only": true,
    "canon_authority": false,
    "runtime_authority": false,
    "truth_closure": false,
    "identity_closure": false,
    "same_object_closure": false,
    "promotion_authority": false
  }
}
```

Hermes-3-llama-3.2-3B
{
  "response_type": "door_one_workbench_lm_response",
  "input_stream_id": "STR:synthetic_workbench_rough_v1:ch0:voltage:arb:256",
  "observations": [
    ""
  ],
  "questions": [
    ""
  ],
  "non_claims": [
    ""
  ],
  "authority_posture": {
    "read_side_only": true,
    "canon_authority": false,
    "runtime_authority": false,
    "truth_closure": false,
    "identity_closure": false,
    "same_object_closure": false,
    "promotion_authority": false
  }
}

meta-llama-3.1-8b-instruct
{
  "response_type": "door_one_workbench_lm_response",
  "input_stream_id": "STR:synthetic_workbench_rough_v1:ch0:voltage:arb:256",
  "observations": [
    ""
  ],
  "questions": [
    ""
  ],
  "non_claims": [
    ""
  ],
  "authority_posture": {
    read_side_only: true,
    canon_authority: false,
    runtime_authority: false,
    truth_closure: false,
    identity_closure: false,
    same_object_closure: false,
    promotion_authority: false
  }
}