ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS "driverAcceptedAt" timestamp;

CREATE INDEX IF NOT EXISTS orders_driver_acceptance_idx
  ON orders ("driverId", status, "driverAcceptedAt");
