INSERT INTO "stores" ("name", "slug", "city", "active", "status", "isDefault", "createdAt", "updatedAt")
VALUES
  ('Bonatto Pizza - Mateus Leme', 'mateus-leme', 'Mateus Leme', true, 'active', true, now(), now()),
  ('Bonatto Pizza - Itauna', 'itauna', 'Itauna', true, 'active', false, now(), now()),
  ('Bonatto Pizza - Juatuba', 'juatuba', 'Juatuba', true, 'active', false, now(), now())
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "city" = EXCLUDED."city",
  "active" = true,
  "status" = 'active',
  "isDefault" = EXCLUDED."isDefault",
  "updatedAt" = now();
