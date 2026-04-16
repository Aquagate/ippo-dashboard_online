/**
 * Browser-side schema validation helper for static hosting.
 * Local Ajv module is tried first; CDN is used as fallback.
 */
export async function loadAjv2020Class(options = {}) {
  const localModulePath = options.localModulePath || "./vendor/ajv2020.local.js";
  const cdnModulePath = options.cdnModulePath || "https://esm.sh/ajv@8.17.1/dist/2020";

  try {
    const local = await import(localModulePath);
    if (typeof local?.default === "function") {
      return { ctor: local.default, source: "local" };
    }
  } catch (error) {
    // Local module is optional.
  }

  const remote = await import(cdnModulePath);
  return { ctor: remote.default, source: "cdn" };
}

export function compileSchemaValidators(Ajv2020, schemas) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validators = {};

  Object.keys(schemas).forEach((key) => {
    validators[key] = ajv.compile(schemas[key]);
  });

  return validators;
}

export function validateWithSchema(validators, kind, payload) {
  const validator = validators[kind];
  if (!validator) {
    return { ok: false, message: `validator not found: ${kind}` };
  }

  const ok = validator(payload);
  if (ok) {
    return { ok: true, message: "ok" };
  }

  const details = (validator.errors || [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");

  return { ok: false, message: details || "schema validation failed" };
}
