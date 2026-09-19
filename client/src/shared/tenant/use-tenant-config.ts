import { useStore } from "@/contexts/StoreContext";

export function useTenantConfig(_tenantKey?: string | null) {
  return useStore().tenantConfig;
}
