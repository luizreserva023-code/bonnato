ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "sessionInvalidBefore" timestamp,
  ADD COLUMN IF NOT EXISTS "totpSecretEncrypted" text,
  ADD COLUMN IF NOT EXISTS "totpPendingSecretEncrypted" text,
  ADD COLUMN IF NOT EXISTS "totpEnabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "totpConfirmedAt" timestamp;

CREATE TABLE IF NOT EXISTS "two_factor_challenges" (
  "id" varchar(64) PRIMARY KEY,
  "tokenHash" varchar(64) NOT NULL UNIQUE,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "consumedAt" timestamp
);

CREATE INDEX IF NOT EXISTS "two_factor_challenges_user_idx"
  ON "two_factor_challenges" ("userId", "expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "two_factor_challenges_token_uq"
  ON "two_factor_challenges" ("tokenHash");
