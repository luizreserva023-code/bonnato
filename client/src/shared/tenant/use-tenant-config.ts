import { useMemo } from "react";

import { resolveTenantConfig } from "@/shared/tenant/tenant-config";

export function useTenantConfig(tenantKey?: string | null) {
  return useMemo(() => resolveTenantConfig(tenantKey), [tenantKey]);
}
