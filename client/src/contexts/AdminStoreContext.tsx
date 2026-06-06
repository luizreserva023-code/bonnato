/**
 * AdminStoreContext
 *
 * Gerencia a loja selecionada no painel admin:
 * - Admin: pode selecionar qualquer loja ou "Todas as lojas" (undefined)
 * - Manager: fixado na sua loja (não pode trocar)
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface AdminStoreContextValue {
  /** ID da loja selecionada. undefined = todas as lojas (apenas para admin) */
  selectedStoreId: number | undefined;
  setSelectedStoreId: (id: number | undefined) => void;
  /** Nome da loja selecionada para exibição */
  selectedStoreName: string;
  /** true se o usuário é manager (não pode trocar de loja) */
  isManager: boolean;
  /** Lista de lojas disponíveis (apenas para admin) */
  stores: Array<{ id: number; name: string; city: string }>;
  isLoading: boolean;
}

const AdminStoreContext = createContext<AdminStoreContextValue>({
  selectedStoreId: undefined,
  setSelectedStoreId: () => {},
  selectedStoreName: "Todas as lojas",
  isManager: false,
  stores: [],
  isLoading: false,
});

export function AdminStoreProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const isManager = !loading && user?.role === "manager";
  const isAdmin = !loading && user?.role === "admin";

  const [selectedStoreId, setSelectedStoreId] = useState<number | undefined>(undefined);

  // Admin: busca todas as lojas para o seletor
  const { data: allStores, isLoading: loadingStores } = trpc.stores.listAll.useQuery(undefined, {
    enabled: isAdmin,
  });

  // Manager: busca a loja dele automaticamente
  const { data: myStore, isLoading: loadingMyStore } = trpc.stores.myStore.useQuery(undefined, {
    enabled: isManager,
  });

  // Manager: fixa o storeId na loja dele
  useEffect(() => {
    if (isManager && myStore) {
      setSelectedStoreId(myStore.id);
    }
  }, [isManager, myStore]);

  const stores = allStores ?? [];
  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const selectedStoreName = isManager
    ? (myStore?.name ?? "Minha Loja")
    : selectedStoreId
    ? (selectedStore?.name ?? "Loja")
    : "Todas as lojas";

  return (
    <AdminStoreContext.Provider
      value={{
        selectedStoreId,
        setSelectedStoreId: isManager ? () => {} : setSelectedStoreId,
        selectedStoreName,
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
