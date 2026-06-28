import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const ADMIN_STORE_STORAGE_KEY = "bonatto_admin_selected_store";

interface AdminStoreContextValue {
  selectedStoreId: number | undefined;
  setSelectedStoreId: (id: number | undefined) => void;
  selectedStoreName: string;
  selectedStoreSlug?: string;
  isManager: boolean;
  stores: Array<{ id: number; name: string; slug: string; city: string }>;
  isLoading: boolean;
}

const AdminStoreContext = createContext<AdminStoreContextValue>({
  selectedStoreId: undefined,
  setSelectedStoreId: () => undefined,
  selectedStoreName: "Todas as lojas",
  selectedStoreSlug: undefined,
  isManager: false,
  stores: [],
  isLoading: false,
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

  const { data: myStore, isLoading: loadingMyStore } = trpc.stores.myStore.useQuery(undefined, {
    enabled: isManager,
  });

  useEffect(() => {
    if (isManager && myStore) {
      setSelectedStoreId(myStore.id);
    }
  }, [isManager, myStore]);

  useEffect(() => {
    if (typeof window === "undefined" || isManager) return;
    if (selectedStoreId == null) {
      window.localStorage.removeItem(ADMIN_STORE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(ADMIN_STORE_STORAGE_KEY, String(selectedStoreId));
  }, [isManager, selectedStoreId]);

  useEffect(() => {
    if (isManager || !allStores?.length || selectedStoreId == null) return;
    const exists = allStores.some((store: { id: number }) => store.id === selectedStoreId);
    if (!exists) {
      setSelectedStoreId(undefined);
    }
  }, [allStores, isManager, selectedStoreId]);

  const stores = allStores ?? [];
  const selectedStore = stores.find((store: { id: number }) => store.id === selectedStoreId);
  const selectedStoreName = isManager
    ? (myStore?.name ?? "Minha Loja")
    : selectedStoreId
      ? (selectedStore?.name ?? "Loja")
      : "Todas as lojas";
  const selectedStoreSlug = isManager ? myStore?.slug ?? undefined : selectedStore?.slug;

  return (
    <AdminStoreContext.Provider
      value={{
        selectedStoreId,
        setSelectedStoreId: isManager ? () => undefined : setSelectedStoreId,
        selectedStoreName,
        selectedStoreSlug,
        isManager,
        stores,
        isLoading: loadingStores || loadingMyStore,
      }}
    >
      {children}
    </AdminStoreContext.Provider>
  );
}

export function useAdminStore() {
  return useContext(AdminStoreContext);
}
