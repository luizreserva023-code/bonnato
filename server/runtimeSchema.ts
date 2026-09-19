export function shouldRunRuntimeSchemaMigrations() {
  // Schema changes must run through the migration command, never on a request.
  // This avoids table locks and cold-start timeouts when local previews share a database.
  return process.env.RUNTIME_SCHEMA_MIGRATIONS === "true";
}
