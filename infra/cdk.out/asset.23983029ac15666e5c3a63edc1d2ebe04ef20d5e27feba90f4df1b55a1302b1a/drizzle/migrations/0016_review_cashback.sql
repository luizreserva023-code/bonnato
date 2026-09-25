ALTER TABLE "client_notifications"
  ADD COLUMN IF NOT EXISTS "url" text;

CREATE TABLE IF NOT EXISTS "review_reward_credits" (
  "id" serial PRIMARY KEY,
  "storeId" integer NOT NULL,
  "orderId" integer NOT NULL,
  "orderReviewId" integer NOT NULL,
  "userId" integer NOT NULL,
  "eligibleAmount" numeric(10,2) NOT NULL,
  "cashbackValue" numeric(10,2) NOT NULL,
  "rewardPercent" numeric(5,2) NOT NULL,
  "pointsPerReal" numeric(8,3) NOT NULL,
  "pointsAwarded" integer NOT NULL,
  "offerExpiresAt" timestamp,
  "configSnapshot" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "review_reward_credits_order_uq"
  ON "review_reward_credits" ("orderId");

CREATE UNIQUE INDEX IF NOT EXISTS "review_reward_credits_review_uq"
  ON "review_reward_credits" ("orderReviewId");

CREATE INDEX IF NOT EXISTS "review_reward_credits_store_created_idx"
  ON "review_reward_credits" ("storeId", "createdAt");

CREATE INDEX IF NOT EXISTS "review_reward_credits_user_created_idx"
  ON "review_reward_credits" ("userId", "createdAt");
