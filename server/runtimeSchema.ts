export function shouldRunRuntimeSchemaMigrations() {
  return process.env.NODE_ENV !== "production" || process.env.RUNTIME_SCHEMA_MIGRATIONS === "true";
}
