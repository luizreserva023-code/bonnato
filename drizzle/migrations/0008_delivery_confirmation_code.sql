ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS "deliveryConfirmationCode" varchar(4);

UPDATE orders
SET "deliveryConfirmationCode" = LPAD(FLOOR(random() * 10000)::int::text, 4, '0')
WHERE "serviceType" = 'delivery'
  AND "deliveryConfirmationCode" IS NULL
  AND status NOT IN ('delivered', 'cancelled');
