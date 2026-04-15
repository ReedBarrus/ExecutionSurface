import {
    deriveReplayThresholdPosture,
    deriveReplayFidelityPosture,
} from "../../../runtime/reconstruction/ReplaySupportPosture.js";

let PASS = 0;
let FAIL = 0;

function section(title) {
    console.log(`\n-- ${title} --`);
}

function ok(condition, label) {
    if (condition) {
        PASS += 1;
        console.log(`  ok ${label}`);
    } else {
        FAIL += 1;
        console.error(`  not ok ${label}`);
    }
}

function eq(actual, expected, label) {
    ok(
        Object.is(actual, expected),
        `${label}${Object.is(actual, expected) ? "" : ` (expected ${expected}, got ${actual})`}`
    );
}

function includes(text, pattern, label) {
    ok(String(text).includes(pattern), label);
}

function finish() {
    console.log(`\n${PASS} passed   ${FAIL} failed`);
    if (FAIL > 0) process.exit(1);
}

const DEGRADED_REPLAY = {
    request_status: "prepared",
    reconstruction_status: "downgraded",
    retained_tier_used: { tier_used: 1, tier_label: "Tier 1 - durable receipts" },
    replay_fidelity_record_v0: {
        mechanization_status: "partially_mechanized",
        threshold_outcome: "support_unresolved",
        downgrade_posture: "support_degraded",
        fidelity_posture: "support-trace class - degraded continuity",
    },
};

const INSUFFICIENT_REPLAY = {
    request_status: "prepared",
    reconstruction_status: "downgraded",
    retained_tier_used: { tier_used: 3, tier_label: "Tier 3 - pinned packet" },
    replay_fidelity_record_v0: {
        mechanization_status: "partially_mechanized",
        threshold_outcome: "support_unresolved",
        downgrade_posture: "retained_tier_insufficient",
        fidelity_posture: "support-trace class - declared tier insufficient",
    },
};

const UNRESOLVED_REPLAY = {
    request_status: "prepared",
    reconstruction_status: "prepared",
    retained_tier_used: { tier_used: 0, tier_label: "Tier 0 - live working state" },
    replay_fidelity_record_v0: {
        mechanization_status: "partially_mechanized",
        threshold_outcome: "support_unresolved",
        downgrade_posture: "",
        fidelity_posture: "support-trace class - unresolved support question",
    },
};

section("A. degraded / insufficient / unresolved stay distinct");
{
    const degradedThreshold = deriveReplayThresholdPosture(DEGRADED_REPLAY);
    const insufficientThreshold = deriveReplayThresholdPosture(INSUFFICIENT_REPLAY);
    const unresolvedThreshold = deriveReplayThresholdPosture(UNRESOLVED_REPLAY);

    eq(degradedThreshold.classCode, "degraded", "A1: support_degraded maps to degraded");
    eq(insufficientThreshold.classCode, "insufficient", "A2: retained_tier_insufficient maps to insufficient");
    eq(unresolvedThreshold.classCode, "unresolved", "A3: support_unresolved without downgrade maps to unresolved");
    ok(degradedThreshold.classCode !== insufficientThreshold.classCode, "A4: degraded stays distinct from insufficient");
    ok(insufficientThreshold.classCode !== unresolvedThreshold.classCode, "A5: insufficient stays distinct from unresolved");
    ok(degradedThreshold.classCode !== unresolvedThreshold.classCode, "A6: degraded stays distinct from unresolved");
    includes(degradedThreshold.note, "degraded relative to the declared replay question", "A7: degraded note stays specific");
    includes(insufficientThreshold.note, "does not justify lawful replay legitimacy", "A8: insufficient note stays specific");
    includes(unresolvedThreshold.note, "remains open at this seam", "A9: unresolved note stays specific");
}

section("B. fidelity distinction follows threshold distinction without becoming a score");
{
    const degradedFidelity = deriveReplayFidelityPosture(DEGRADED_REPLAY);
    const insufficientFidelity = deriveReplayFidelityPosture(INSUFFICIENT_REPLAY);
    const unresolvedFidelity = deriveReplayFidelityPosture(UNRESOLVED_REPLAY);

    eq(degradedFidelity.classCode, "degraded_support_trace", "B1: degraded threshold maps to degraded support-trace fidelity");
    eq(insufficientFidelity.classCode, "insufficient_support_trace", "B2: insufficient threshold maps to insufficient support-trace fidelity");
    eq(unresolvedFidelity.classCode, "unresolved_support_trace", "B3: unresolved threshold maps to unresolved support-trace fidelity");
    includes(degradedFidelity.note, "degraded remains distinct from insufficient and unresolved", "B4: degraded fidelity note stays distinct");
    includes(insufficientFidelity.note, "not enough to justify lawful replay / reconstruction quality", "B5: insufficient fidelity note stays bounded");
    includes(unresolvedFidelity.note, "unresolved is distinct from degraded and insufficient", "B6: unresolved fidelity note stays bounded");
}

finish();
