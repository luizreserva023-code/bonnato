import { afterEach, describe, expect, it } from "vitest";
import { shouldRunRuntimeSchemaMigrations } from "./runtimeSchema";

const originalNodeEnv = process.env.NODE_ENV;
const originalRuntimeMigrations = process.env.RUNTIME_SCHEMA_MIGRATIONS;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalRuntimeMigrations === undefined) delete process.env.RUNTIME_SCHEMA_MIGRATIONS;
  else process.env.RUNTIME_SCHEMA_MIGRATIONS = originalRuntimeMigrations;
});

describe("shouldRunRuntimeSchemaMigrations", () => {
  it("does not mutate a shared database during a local preview by default", () => {
    process.env.NODE_ENV = "development";
    delete process.env.RUNTIME_SCHEMA_MIGRATIONS;
    expect(shouldRunRuntimeSchemaMigrations()).toBe(false);
  });

  it("allows an explicit opt-out during local previews", () => {
    process.env.NODE_ENV = "development";
    process.env.RUNTIME_SCHEMA_MIGRATIONS = "false";
    expect(shouldRunRuntimeSchemaMigrations()).toBe(false);
  });

  it("requires an explicit opt-in in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.RUNTIME_SCHEMA_MIGRATIONS;
    expect(shouldRunRuntimeSchemaMigrations()).toBe(false);

    process.env.RUNTIME_SCHEMA_MIGRATIONS = "true";
    expect(shouldRunRuntimeSchemaMigrations()).toBe(true);
  });
});
