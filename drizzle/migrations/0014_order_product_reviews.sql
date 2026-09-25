CREATE TABLE IF NOT EXISTS "order_reviews" (
  "id" serial PRIMARY KEY,
  "orderId" integer NOT NULL UNIQUE,
  "storeId" integer NOT NULL,
  "userId" integer NOT NULL,
  "rating" integer NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "order_reviews_store_idx"
  ON "order_reviews" ("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "order_reviews_user_idx"
  ON "order_reviews" ("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "product_reviews" (
  "id" serial PRIMARY KEY,
  "orderReviewId" integer NOT NULL,
  "orderId" integer NOT NULL,
  "orderItemId" integer NOT NULL,
  "storeId" integer NOT NULL,
  "userId" integer NOT NULL,
  "productId" integer NOT NULL,
  "productName" varchar(200) NOT NULL,
  "rating" integer NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_reviews_order_item_uq"
  ON "product_reviews" ("orderId", "orderItemId");
CREATE INDEX IF NOT EXISTS "product_reviews_store_idx"
  ON "product_reviews" ("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "product_reviews_product_idx"
  ON "product_reviews" ("productId", "createdAt");
