CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" varchar(64) PRIMARY KEY,
  "userId" integer NOT NULL,
  "ipAddress" varchar(64),
  "userAgent" text,
  "deviceLabel" varchar(180),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "lastSeenAt" timestamp DEFAULT now() NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "revokedAt" timestamp,
  "revokedReason" varchar(80),
  CONSTRAINT "auth_sessions_userId_users_id_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "auth_sessions_user_active_idx"
  ON "auth_sessions" ("userId", "revokedAt", "lastSeenAt");

CREATE INDEX IF NOT EXISTS "auth_sessions_expires_idx"
  ON "auth_sessions" ("expiresAt");
