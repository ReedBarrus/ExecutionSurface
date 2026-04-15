import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LM_SCHEMA_ROOT = path.resolve(__dirname, "../../schemas/lm");
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

function matchesType(expectedType, value) {
    if (expectedType === "null") return value === null;
    if (expectedType === "array") return Array.isArray(value);
    if (expectedType === "object") return isObject(value);
    if (expectedType === "integer") return Number.isInteger(value);
    return typeof value === expectedType;
}

async function validateValue(schema, value, ctx) {
    const { errors, pathLabel } = ctx;

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

    if (schema.type === "integer" || (Array.isArray(schema.type) && schema.type.includes("integer"))) {
        if (!Number.isInteger(value)) {
            pushError(errors, pathLabel, "expected integer");
            return;
        }
        if (typeof schema.minimum === "number" && value < schema.minimum) {
            pushError(errors, pathLabel, `expected integer >= ${schema.minimum}`);
        }
    }

    if (typeof value === "number" && typeof schema.minimum === "number" && value < schema.minimum) {
        pushError(errors, pathLabel, `expected number >= ${schema.minimum}`);
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

async function validateLmPayload(schemaFileName, payload) {
    const schemaPath = path.resolve(LM_SCHEMA_ROOT, schemaFileName);
    const schema = await loadSchemaByAbsolutePath(schemaPath);
    const errors = [];
    await validateValue(schema, payload, {
        errors,
        pathLabel: "payload",
    });
    return makeResult(errors);
}

export async function validateWorkbenchLmInput(payload) {
    return validateLmPayload("workbench_lm_input.schema.json", payload);
}

export async function validateWorkbenchLmOutput(payload) {
    return validateLmPayload("workbench_lm_output.schema.json", payload);
}

export async function validateLocalLmBenchmarkReceipt(payload) {
    return validateLmPayload("local_lm_benchmark_receipt.schema.json", payload);
}
