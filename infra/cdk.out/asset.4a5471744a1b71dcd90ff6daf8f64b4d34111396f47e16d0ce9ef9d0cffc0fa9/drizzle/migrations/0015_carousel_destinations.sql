ALTER TABLE "carousel_images"
  ADD COLUMN IF NOT EXISTS "destinationType" varchar(24) DEFAULT 'none' NOT NULL,
  ADD COLUMN IF NOT EXISTS "destinationValue" text;

UPDATE "carousel_images"
SET "destinationType" = 'none'
WHERE "destinationType" IS NULL OR trim("destinationType") = '';
