import { config as loadEnv } from "dotenv";

// Load shared defaults first, then local overrides for dev/server execution.
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });
