import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { DEFAULT_TENANT_CONFIG, type TenantRuntimeConfig } from "@/shared/tenant/tenant-config";

const ADMIN_STORE_STORAGE_KEY = "bonatto_admin_selected_store";

interface AdminStoreContextValue {
  selectedStoreId: number | undefined;
  setSelectedStoreId: (id: number | undefined) => void;
  selectedStoreName: string;
  selectedStoreSlug?: string;
  isManager: boolean;
  stores: Array<{ id: number; name: string; slug: string; city: string }>;
  isLoading: boolean;
  tenantConfig: TenantRuntimeConfig;
}

const AdminStoreContext = createContext<AdminStoreContextValue>({
  selectedStoreId: undefined,
  setSelectedStoreId: () => undefined,
  selectedStoreName: "Todas as lojas",
  selectedStoreSlug: undefined,
  isManager: false,
  stores: [],
  isLoading: false,
  tenantConfig: DEFAULT_TENANT_CONFIG,
});

export function AdminStoreProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const isManager = !loading && user?.role === "manager";
  const isAdmin = !loading && user?.role === "admin";
  const [selectedStoreId, setSelectedStoreId] = useState<number | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const raw = window.localStorage.getItem(ADMIN_STORE_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  });

  const { data: allStores, isLoading: loadingStores } = trpc.stores.listAll.useQuery(undefined, {
    enabled: isAdmin,
  });

  const { data: myStores, isLoading: loadingMyStores } = trpc.stores.myStores.useQuery(undefined, {
    enabled: isManager,
  });

  useEffect(() => {
    if (!isManager || !myStores?.length) return;
    const canAccessSelected = myStores.some((store) => store.id === selectedStoreId);
    if (!canAccessSelected) {
      setSelectedStoreId(myStores[0].id);
    }
  }, [isManager, myStores, selectedStoreId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedStoreId == null) {
      window.localStorage.removeItem(ADMIN_STORE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(ADMIN_STORE_STORAGE_KEY, String(selectedStoreId));
  }, [selectedStoreId]);

  useEffect(() => {
    if (isManager || !allStores?.length) return;
    if (selectedStoreId == null) {
      setSelectedStoreId(allStores[0].id);
      return;
    }
    const exists = allStores.some((store: { id: number }) => store.id === selectedStoreId);
    if (!exists) {
      setSelectedStoreId(undefined);
    }
  }, [allStores, isManager, selectedStoreId]);

  const stores = isManager ? (myStores ?? []) : (allStores ?? []);
  const selectedStore = stores.find((store: { id: number }) => store.id === selectedStoreId);
  const selectedStoreName = selectedStoreId ? (selectedStore?.name ?? "Loja") : "Todas as lojas";
  const selectedStoreSlug = selectedStore?.slug;
  const { data: selectedTenant, isLoading: loadingTenant } = trpc.stores.whiteLabelConfig.useQuery(
    { storeId: selectedStoreId ?? 0 },
    { enabled: Boolean(selectedStoreId) && (isAdmin || isManager), staleTime: 5 * 60 * 1000 },
  );
  const tenantConfig = selectedTenant ?? DEFAULT_TENANT_CONFIG;

  return (
    <AdminStoreContext.Provider
      value={{
        selectedStoreId,
        setSelectedStoreId,
        selectedStoreName,
        selectedStoreSlug,
        isManager,
        stores,
        isLoading: loadingStores || loadingMyStores || loadingTenant,
        tenantConfig,
      }}
    >
      {children}
    </AdminStoreContext.Provider>
  );
}

export function useAdminStore() {
  return useContext(AdminStoreContext);
}
