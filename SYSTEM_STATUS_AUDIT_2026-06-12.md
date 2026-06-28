# System Status Audit - 2026-06-12

## Scope completed

- Removed the active `super_admin` layer from app routes, guards, admin filters, runtime schema bootstrap, and database schema definitions.
- Cleaned the production MySQL database to remove leftover multi-tenant/superadmin structures.
- Published a fresh production deploy on Vercel.

Production URL:

- `https://bonnato-one.vercel.app`

## Database cleanup executed

Production MySQL cleanup confirmed:

- Converted `1` remaining `super_admin` user to `admin`
- Dropped tables:
  - `audit_logs`
  - `store_features`
  - `store_themes`
  - `user_store_roles`
- Dropped store columns:
  - `domain`
  - `subdomain`
  - `plan`
- Dropped store indexes:
  - `stores_domain_idx`
  - `stores_subdomain_idx`

Current core counts after cleanup:

- Users: `20017`
- Orders: `1012`
- Products: `39`
- Stores: `6`
- Dining tables: `103`
- Table sessions: `104`

## Confirmed working

- `npm run build:web` passes locally
- `npm run build:vercel:function` passes locally
- Production deploy completed successfully and alias points to the new build
- Public pages respond in production:
  - `/`
  - `/login`
  - `/admin`
- API health responds in production through tRPC when called with the expected `Origin` header:
  - `/api/trpc/system.health`
- `/superadmin` no longer exposes the removed UI content
- No live source references remain to:
  - `tenantTheme`
  - `isTenantLocked`
  - `super_admin`
    Note: a historical migration file still contains the old term by design, and a new reversal migration was added.

## Confirmed not working or still needing attention

- `npm run check` does **not** pass right now
  - There are many pre-existing TypeScript issues across admin, CRM, automations, storage, and dashboard files
  - This is the main code health gap left in the project
- Local app was not running during this audit
  - `http://localhost:3000` and related routes were offline at the time of verification
- `/superadmin` still returns HTTP `200` in production because the SPA fallback serves `index.html`
  - The page content is gone, but the route is not a hard 404
- Frontend bundle is still heavy
  - Vite reports chunks above `500 kB`
- This pass did **not** fully re-run end-to-end business flows
  - account creation
  - email login
  - social login
  - checkout
  - order creation
  - table/comanda closure
  - push notification delivery
  - maps flow

## Files added for cleanup continuity

- [drizzle/0044_remove_superadmin_multitenancy.sql](/C:/Users/luisg/Documents/New%20project/bonatto-mobile-app/drizzle/0044_remove_superadmin_multitenancy.sql)
- [SYSTEM_STATUS_AUDIT_2026-06-12.md](/C:/Users/luisg/Documents/New%20project/bonatto-mobile-app/SYSTEM_STATUS_AUDIT_2026-06-12.md)

## Recommended next focus

1. Fix the failing `npm run check` TypeScript errors.
2. Run a real end-to-end validation pass for login, register, order, table session, and admin updates.
3. Add an explicit not-found or redirect rule for `/superadmin` if you want that URL to stop returning the SPA shell.
4. Split large frontend bundles before the next major production push.
