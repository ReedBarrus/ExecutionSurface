import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HANDOFF_SCHEMA_ROOT = path.resolve(__dirname, "../../schemas/handoff");
const schemaCache = new Map();

function makeResult(errors) {
    return {
        ok: errors.length === 0,
        errors,
    };
}

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pushError(errors, pathLabel, message) {
    errors.push(`${pathLabel}: ${message}`);
}

async function loadSchemaByAbsolutePath(schemaPath) {
    if (!schemaCache.has(schemaPath)) {
        const raw = await readFile(schemaPath, "utf8");
        schemaCache.set(schemaPath, JSON.parse(raw));
    }
    return schemaCache.get(schemaPath);
}

async function resolveSchema(schemaRef, baseSchemaPath = null) {
    const absolutePath = path.isAbsolute(schemaRef)
        ? schemaRef
        : baseSchemaPath
            ? path.resolve(path.dirname(baseSchemaPath), schemaRef)
            : path.resolve(HANDOFF_SCHEMA_ROOT, schemaRef);
    const schema = await loadSchemaByAbsolutePath(absolutePath);
    return { schema, schemaPath: absolutePath };
}

function matchesType(expectedType, value) {
    if (expectedType === "null") return value === null;
    if (expectedType === "array") return Array.isArray(value);
    if (expectedType === "object") return isObject(value);
    return typeof value === expectedType;
}

async function validateValue(schema, value, ctx) {
    const { errors, pathLabel, schemaPath } = ctx;

    if (schema.$ref) {
        const { schema: refSchema, schemaPath: refSchemaPath } = await resolveSchema(schema.$ref, schemaPath);
        await validateValue(refSchema, value, {
            errors,
            pathLabel,
            schemaPath: refSchemaPath,
        });
        return;
    }

    if (schema.const !== undefined && value !== schema.const) {
        pushError(errors, pathLabel, `expected ${JSON.stringify(schema.const)}`);
        return;
    }

    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
        pushError(errors, pathLabel, `expected one of ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}`);
        return;
    }

    if (schema.type !== undefined) {
        const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
        const typeMatch = allowedTypes.some((entry) => matchesType(entry, value));
        if (!typeMatch) {
            pushError(errors, pathLabel, `expected type ${allowedTypes.join(" | ")}`);
            return;
        }
    }

    if (typeof value === "string" && Number.isInteger(schema.minLength) && value.length < schema.minLength) {
        pushError(errors, pathLabel, `expected string length >= ${schema.minLength}`);
    }

    if (Array.isArray(value)) {
        if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
            pushError(errors, pathLabel, `expected array length >= ${schema.minItems}`);
        }
        if (schema.items) {
            for (let index = 0; index < value.length; index += 1) {
                await validateValue(schema.items, value[index], {
                    errors,
                    pathLabel: `${pathLabel}[${index}]`,
                    schemaPath,
                });
            }
        }
        return;
    }

    if (!isObject(value)) return;

    const properties = schema.properties ?? {};
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const requiredKey of required) {
        if (!(requiredKey in value)) {
            pushError(errors, `${pathLabel}.${requiredKey}`, "is required");
        }
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
        if (!(key in value)) continue;
        await validateValue(propertySchema, value[key], {
            errors,
            pathLabel: `${pathLabel}.${key}`,
            schemaPath,
        });
    }

    if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
            if (!(key in properties)) {
                pushError(errors, `${pathLabel}.${key}`, "additional property is not allowed");
            }
        }
    }
}

export async function validateHandoffPayload(schemaFileName, payload) {
    const { schema, schemaPath } = await resolveSchema(schemaFileName);
    const errors = [];
    await validateValue(schema, payload, {
        errors,
        pathLabel: "payload",
        schemaPath,
    });
    return makeResult(errors);
}

export async function validatePassRequest(payload) {
    return validateHandoffPayload("pass_request.schema.json", payload);
}

export async function validateRoleResponse(payload) {
    return validateHandoffPayload("role_response.schema.json", payload);
}

export async function validateGateDecision(payload) {
    return validateHandoffPayload("gate_decision.schema.json", payload);
}

export async function validateCycleLogEntry(payload) {
    return validateHandoffPayload("cycle_log_entry.schema.json", payload);
}

export async function validateSubjectRegisterEntry(payload) {
    return validateHandoffPayload("subject_register_entry.schema.json", payload);
}
