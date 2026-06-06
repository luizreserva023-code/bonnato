/**
 * StoreContext — contexto da loja selecionada pelo cliente
 *
 * Comportamento:
 * - Persiste no localStorage como "bonatto_selected_store" por 30 dias
 * - Se já tem loja salva (e não expirou), NÃO mostra o modal automaticamente
 * - Se não tem loja salva, seleciona a padrão silenciosamente mas NÃO abre o modal
 * - O modal só abre quando o usuário tentar acessar o cardápio/checkout sem loja,
 *   ou quando clicar manualmente no seletor da Navbar
 * - Expõe `requireStore()` para páginas que precisam de loja selecionada
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";

export interface SelectedStore {
  id: number;
  name: string;
  slug: string;
  city: string;
  address?: string | null;
  phone?: string | null;
  isDefault?: boolean;
}

interface StoredData {
  store: SelectedStore;
  expiresAt: number; // timestamp ms
}

interface StoreContextValue {
  selectedStore: SelectedStore | null;
  setSelectedStore: (store: SelectedStore) => void;
  clearStore: () => void;
  isLoading: boolean;
  stores: SelectedStore[];
  showCityModal: boolean;
  setShowCityModal: (v: boolean) => void;
  /** Abre o modal se não há loja selecionada; retorna true se já tem loja */
  requireStore: () => boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);
const STORAGE_KEY = "bonatto_selected_store_v2";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function loadFromStorage(): SelectedStore | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: StoredData = JSON.parse(raw);
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data.store;
  } catch {
    return null;
  }
}

function saveToStorage(store: SelectedStore) {
  const data: StoredData = { store, expiresAt: Date.now() + TTL_MS };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [selectedStore, setSelectedStoreState] = useState<SelectedStore | null>(
    () => loadFromStorage()
  );
  const [showCityModal, setShowCityModal] = useState(false);

  const { data: stores = [], isLoading } = trpc.stores.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // Quando as lojas carregam, garantir que há uma seleção silenciosa (sem abrir modal)
  useEffect(() => {
    if (isLoading || stores.length === 0) return;

    // Já tem loja salva e válida → não fazer nada
    if (selectedStore) return;

    if (stores.length === 1) {
      // Só uma loja → selecionar automaticamente e silenciosamente
      const store = stores[0];
      setSelectedStoreState(store);
      saveToStorage(store);
    } else {
      // Múltiplas lojas → selecionar a padrão silenciosamente, mas NÃO abrir modal
      const defaultStore = stores.find(s => s.isDefault) ?? stores[0];
      if (defaultStore) {
        setSelectedStoreState(defaultStore);
        saveToStorage(defaultStore);
      }
      // Modal NÃO é aberto aqui — só abre via requireStore() ou clique manual
    }
  }, [isLoading, stores, selectedStore]);

  const setSelectedStore = useCallback((store: SelectedStore) => {
    setSelectedStoreState(store);
    saveToStorage(store);
    setShowCityModal(false);
  }, []);

  const clearStore = useCallback(() => {
    setSelectedStoreState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  /**
   * Usado por páginas que precisam de loja (Cardápio, Checkout).
   * Retorna true se já tem loja; false e abre o modal se não tem.
   */
  const requireStore = useCallback((): boolean => {
    if (selectedStore) return true;
    if (stores.length > 1) setShowCityModal(true);
    return false;
  }, [selectedStore, stores]);

  return (
    <StoreContext.Provider value={{
      selectedStore,
      setSelectedStore,
      clearStore,
      isLoading,
      stores,
      showCityModal,
      setShowCityModal,
      requireStore,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
