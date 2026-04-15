function makeResult(errors) {
    return {
        ok: errors.length === 0,
        errors,
    };
}

function pushError(errors, path, message) {
    errors.push(`${path}: ${message}`);
}

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(errors, path, value) {
    if (!isObject(value)) {
        pushError(errors, path, "expected object");
        return false;
    }
    return true;
}

function requireString(errors, path, value, { allowNull = false, minLength = 0 } = {}) {
    if (value === null && allowNull) return true;
    if (typeof value !== "string") {
        pushError(errors, path, allowNull ? "expected string or null" : "expected string");
        return false;
    }
    if (value.length < minLength) {
        pushError(errors, path, `expected string length >= ${minLength}`);
        return false;
    }
    return true;
}

function requireBoolean(errors, path, value) {
    if (typeof value !== "boolean") {
        pushError(errors, path, "expected boolean");
        return false;
    }
    return true;
}

function requireInteger(errors, path, value, { allowNull = false, min = 0 } = {}) {
    if (value === null && allowNull) return true;
    if (!Number.isInteger(value)) {
        pushError(errors, path, allowNull ? "expected integer or null" : "expected integer");
        return false;
    }
    if (value < min) {
        pushError(errors, path, `expected integer >= ${min}`);
        return false;
    }
    return true;
}

function requireConst(errors, path, value, expected) {
    if (value !== expected) {
        pushError(errors, path, `expected ${JSON.stringify(expected)}`);
        return false;
    }
    return true;
}

function requireEnum(errors, path, value, allowed, { allowNull = false } = {}) {
    if (value === null && allowNull) return true;
    if (!allowed.includes(value)) {
        pushError(errors, path, `expected one of ${allowed.map((v) => JSON.stringify(v)).join(", ")}`);
        return false;
    }
    return true;
}

export function validateDoorOneOrchestratorReceipt(receipt) {
    const errors = [];
    if (!requireObject(errors, "receipt", receipt)) return makeResult(errors);

    requireConst(errors, "receipt.receipt_type", receipt.receipt_type, "runtime:door_one_orchestrator_receipt");
    requireString(errors, "receipt.stream_id", receipt.stream_id, { allowNull: true });
    requireString(errors, "receipt.source_id", receipt.source_id, { allowNull: true });
    for (const field of [
        "state_count",
        "basin_count",
        "segment_count",
        "trajectory_frames",
        "segment_transition_count",
        "h1_count",
        "m1_count",
        "anomaly_count",
        "skipped_window_count",
        "merge_failure_count",
    ]) {
        requireInteger(errors, `receipt.${field}`, receipt[field], { min: 0 });
    }
    requireBoolean(errors, "receipt.query_present", receipt.query_present);
    return makeResult(errors);
}

export function validateDoorOneWorkbenchReceipt(receipt) {
    const errors = [];
    if (!requireObject(errors, "receipt", receipt)) return makeResult(errors);

    requireConst(errors, "receipt.receipt_type", receipt.receipt_type, "runtime:door_one_workbench_receipt");
    requireString(errors, "receipt.stream_id", receipt.stream_id, { allowNull: true });
    requireString(errors, "receipt.source_id", receipt.source_id, { allowNull: true });
    requireInteger(errors, "receipt.segment_count", receipt.segment_count, { min: 0 });
    requireInteger(errors, "receipt.state_count", receipt.state_count, { min: 0 });
    requireInteger(errors, "receipt.basin_count", receipt.basin_count, { min: 0 });
    requireBoolean(errors, "receipt.query_present", receipt.query_present);
    requireBoolean(errors, "receipt.cross_run_available", receipt.cross_run_available);
    requireInteger(errors, "receipt.cross_run_run_count", receipt.cross_run_run_count, { min: 0 });
    return makeResult(errors);
}

export function validateDoorOneLiveProvenanceReceipt(receipt) {
    const errors = [];
    if (!requireObject(errors, "receipt", receipt)) return makeResult(errors);

    requireConst(errors, "receipt.receipt_type", receipt.receipt_type, "runtime:door_one_live_provenance_receipt");
    requireConst(errors, "receipt.receipt_version", receipt.receipt_version, "0.1.0");
    requireString(errors, "receipt.generated_from", receipt.generated_from, { minLength: 1 });
    requireString(errors, "receipt.written_at", receipt.written_at, { minLength: 1 });

    if (requireObject(errors, "receipt.cycle", receipt.cycle)) {
        requireString(errors, "receipt.cycle.cycle_dir", receipt.cycle.cycle_dir, { minLength: 1 });
        requireInteger(errors, "receipt.cycle.cycle_index", receipt.cycle.cycle_index, { allowNull: true, min: 0 });
        requireString(errors, "receipt.cycle.run_label", receipt.cycle.run_label, { allowNull: true });
    }

    if (requireObject(errors, "receipt.scope", receipt.scope)) {
        requireString(errors, "receipt.scope.stream_id", receipt.scope.stream_id, { allowNull: true });
        requireString(errors, "receipt.scope.source_mode", receipt.scope.source_mode, { allowNull: true });
        requireString(errors, "receipt.scope.source_id", receipt.scope.source_id, { allowNull: true });
        requireString(errors, "receipt.scope.channel", receipt.scope.channel, { allowNull: true });
        requireString(errors, "receipt.scope.modality", receipt.scope.modality, { allowNull: true });
    }

    if (requireObject(errors, "receipt.structural_summary", receipt.structural_summary)) {
        for (const field of ["state_count", "basin_count", "segment_count"]) {
            requireInteger(errors, `receipt.structural_summary.${field}`, receipt.structural_summary[field], { min: 0 });
        }
        for (const field of ["convergence", "motion", "occupancy", "recurrence", "continuity"]) {
            requireString(errors, `receipt.structural_summary.${field}`, receipt.structural_summary[field], { minLength: 1 });
        }
    }

    if (requireObject(errors, "receipt.cross_run_context", receipt.cross_run_context)) {
        requireBoolean(errors, "receipt.cross_run_context.available", receipt.cross_run_context.available);
        requireInteger(errors, "receipt.cross_run_context.run_count", receipt.cross_run_context.run_count, { min: 0 });
    }

    if (requireObject(errors, "receipt.references", receipt.references)) {
        for (const field of [
            "live_cycle_dir",
            "latest_workbench",
            "latest_run_result",
            "latest_cross_run_report",
            "latest_session_summary",
        ]) {
            requireString(errors, `receipt.references.${field}`, receipt.references[field], { minLength: 1 });
        }
    }

    return makeResult(errors);
}

export function validateProvenanceReconstructionReceipt(receipt) {
    const errors = [];
    if (!requireObject(errors, "receipt", receipt)) return makeResult(errors);

    requireConst(errors, "receipt.receipt_type", receipt.receipt_type, "runtime:provenance_reconstruction_receipt");
    requireString(errors, "receipt.replay_request_id", receipt.replay_request_id, { allowNull: true });
    requireString(errors, "receipt.replay_type", receipt.replay_type, { minLength: 1 });
    requireEnum(errors, "receipt.reconstruction_status", receipt.reconstruction_status, ["completed", "downgraded", "failed", "unknown"]);
    requireString(errors, "receipt.target_type", receipt.target_type, { allowNull: true });
    requireString(errors, "receipt.retained_tier", receipt.retained_tier, { minLength: 1 });
    requireInteger(errors, "receipt.support_basis_count", receipt.support_basis_count, { min: 0 });
    requireBoolean(errors, "receipt.runtime_support_available", receipt.runtime_support_available);
    requireBoolean(errors, "receipt.receipt_support_available", receipt.receipt_support_available);
    requireBoolean(errors, "receipt.interpretive_support_available", receipt.interpretive_support_available);
    requireString(errors, "receipt.threshold_outcome", receipt.threshold_outcome, { allowNull: true });
    requireString(errors, "receipt.downgrade_output", receipt.downgrade_output, { allowNull: true });
    requireEnum(
        errors,
        "receipt.mechanization_status",
        receipt.mechanization_status,
        ["mechanized", "partially_mechanized", "failed", "unknown"]
    );
    return makeResult(errors);
}

export function validateProbeReportReceipt(receipt) {
    const errors = [];
    if (!requireObject(errors, "receipt", receipt)) return makeResult(errors);

    requireConst(errors, "receipt.receipt_type", receipt.receipt_type, "runtime:probe_report_receipt");
    requireConst(errors, "receipt.receipt_version", receipt.receipt_version, "0.1.0");
    requireString(errors, "receipt.probe_type", receipt.probe_type, { minLength: 1 });

    if (requireObject(errors, "receipt.row_surface", receipt.row_surface)) {
        requireString(errors, "receipt.row_surface.path", receipt.row_surface.path, { minLength: 1 });
        requireInteger(errors, "receipt.row_surface.row_count", receipt.row_surface.row_count, { min: 0 });
    }

    if (requireObject(errors, "receipt.summary_surface", receipt.summary_surface)) {
        requireString(errors, "receipt.summary_surface.path", receipt.summary_surface.path, { minLength: 1 });
        requireBoolean(errors, "receipt.summary_surface.available", receipt.summary_surface.available);
    }

    if (requireObject(errors, "receipt.posture_flags", receipt.posture_flags)) {
        requireBoolean(errors, "receipt.posture_flags.has_constitutional_posture", receipt.posture_flags.has_constitutional_posture);
        requireBoolean(errors, "receipt.posture_flags.has_disclaimers", receipt.posture_flags.has_disclaimers);
        requireBoolean(errors, "receipt.posture_flags.not_canon_evidence", receipt.posture_flags.not_canon_evidence);
        requireBoolean(errors, "receipt.posture_flags.not_prediction_evidence", receipt.posture_flags.not_prediction_evidence);
    }

    if (requireObject(errors, "receipt.authority_posture", receipt.authority_posture)) {
        requireConst(errors, "receipt.authority_posture.advisory_only", receipt.authority_posture.advisory_only, true);
        requireConst(errors, "receipt.authority_posture.read_side_only", receipt.authority_posture.read_side_only, true);
        requireConst(errors, "receipt.authority_posture.runtime_authority", receipt.authority_posture.runtime_authority, false);
        requireConst(errors, "receipt.authority_posture.canon_authority", receipt.authority_posture.canon_authority, false);
    }

    if (requireObject(errors, "receipt.counts", receipt.counts)) {
        requireInteger(errors, "receipt.counts.comparison_count", receipt.counts.comparison_count, { min: 0 });
        requireInteger(errors, "receipt.counts.family_summary_count", receipt.counts.family_summary_count, { min: 0 });
    }

    if (requireObject(errors, "receipt.report_ref", receipt.report_ref)) {
        requireString(errors, "receipt.report_ref.report_path", receipt.report_ref.report_path, { allowNull: true });
    }

    return makeResult(errors);
}
