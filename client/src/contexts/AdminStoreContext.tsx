import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { BONATTO_CONFIG, type BonattoRuntimeConfig } from "@/config/bonatto";
import { permissionsForRole, type StoreAccessRole, type StorePermission } from "@shared/permissions";

const ADMIN_STORE_STORAGE_KEY = "bonatto_admin_selected_store";

interface AdminStoreContextValue {
  selectedStoreId: number | undefined;
  setSelectedStoreId: (id: number | undefined) => void;
  selectedStoreName: string;
  selectedStoreSlug?: string;
  isManager: boolean;
  isStaff: boolean;
  isPlatformAdmin: boolean;
  accessRole?: StoreAccessRole;
  permissions: StorePermission[];
  can: (permission: StorePermission) => boolean;
  stores: Array<{ id: number; name: string; slug: string; city: string }>;
  isLoading: boolean;
  bonattoConfig: BonattoRuntimeConfig;
}

const AdminStoreContext = createContext<AdminStoreContextValue>({
  selectedStoreId: undefined,
  setSelectedStoreId: () => undefined,
  selectedStoreName: "Todas as lojas",
  selectedStoreSlug: undefined,
  isManager: false,
  isStaff: false,
  isPlatformAdmin: false,
  permissions: [],
  can: () => false,
  stores: [],
  isLoading: false,
  bonattoConfig: BONATTO_CONFIG,
});

export function AdminStoreProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const isPlatformAdmin = !loading && user?.role === "admin";
  const isManager = !loading && user?.role === "manager";
  const authenticated = !loading && Boolean(user);

  const [selectedStoreId, setSelectedStoreId] = useState<number | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const parsed = Number(window.localStorage.getItem(ADMIN_STORE_STORAGE_KEY));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  });

  const { data: accessContext, isLoading: loadingAccess } = trpc.stores.myAccessContext.useQuery(undefined, {
    enabled: authenticated,
    staleTime: 60_000,
  });
  const { data: allStores, isLoading: loadingStores } = trpc.stores.listAll.useQuery(undefined, {
    enabled: isPlatformAdmin,
    staleTime: 60_000,
  });
  const { data: myStores, isLoading: loadingMyStores } = trpc.stores.myStores.useQuery(undefined, {
    enabled: authenticated && !isPlatformAdmin,
    staleTime: 60_000,
  });

  const stores = isPlatformAdmin ? (allStores ?? []) : (myStores ?? []);
  const isStaff = Boolean(isPlatformAdmin || isManager || accessContext?.isStaff);

  useEffect(() => {
    if (!stores.length) return;
    if (!selectedStoreId || !stores.some((store) => store.id === selectedStoreId)) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedStoreId == null) window.localStorage.removeItem(ADMIN_STORE_STORAGE_KEY);
    else window.localStorage.setItem(ADMIN_STORE_STORAGE_KEY, String(selectedStoreId));
  }, [selectedStoreId]);

  const selectedStore = stores.find((store) => store.id === selectedStoreId);
  const selectedAccess = accessContext?.stores?.find((store) => store.storeId === selectedStoreId);
  const accessRole = isPlatformAdmin ? "admin" : isManager ? "manager" : selectedAccess?.role;
  const permissions = useMemo<StorePermission[]>(() => {
    if (isPlatformAdmin) return permissionsForRole("admin");
    if (isManager) return permissionsForRole("manager");
    return (selectedAccess?.permissions ?? []) as StorePermission[];
  }, [isPlatformAdmin, isManager, selectedAccess?.permissions]);
  const permissionSet = useMemo(() => new Set<StorePermission>(permissions), [permissions]);

  return (
    <AdminStoreContext.Provider value={{
      selectedStoreId,
      setSelectedStoreId,
      selectedStoreName: selectedStore?.name ?? "Todas as lojas",
      selectedStoreSlug: selectedStore?.slug,
      isManager,
      isStaff,
      isPlatformAdmin,
      accessRole,
      permissions,
      can: (permission) => permissionSet.has(permission),
      stores,
      isLoading: loading || (authenticated && loadingAccess) || (isPlatformAdmin ? loadingStores : authenticated && loadingMyStores),
      bonattoConfig: BONATTO_CONFIG,
    }}>
      {children}
    </AdminStoreContext.Provider>
  );
}

export function useAdminStore() {
  return useContext(AdminStoreContext);
}
