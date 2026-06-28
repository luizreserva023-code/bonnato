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
  expiresAt: number;
}

interface StoreContextValue {
  selectedStore: SelectedStore | null;
  setSelectedStore: (store: SelectedStore) => void;
  clearStore: () => void;
  isLoading: boolean;
  stores: SelectedStore[];
  showCityModal: boolean;
  setShowCityModal: (v: boolean) => void;
  requireStore: () => boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);
const STORAGE_KEY = "bonatto_selected_store_v2";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
  const [selectedStore, setSelectedStoreState] = useState<SelectedStore | null>(() => loadFromStorage());
  const [showCityModal, setShowCityModal] = useState(false);

  const { data: stores = [], isLoading } = trpc.stores.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (isLoading || stores.length === 0) return;
    if (selectedStore) return;

    if (stores.length === 1) {
      const store = stores[0];
      setSelectedStoreState(store);
      saveToStorage(store);
    } else {
      const defaultStore = stores.find((store) => store.isDefault) ?? stores[0];
      if (defaultStore) {
        setSelectedStoreState(defaultStore);
        saveToStorage(defaultStore);
      }
    }
  }, [isLoading, selectedStore, stores]);

  const setSelectedStore = useCallback((store: SelectedStore) => {
    setSelectedStoreState(store);
    saveToStorage(store);
    setShowCityModal(false);
  }, []);

  const clearStore = useCallback(() => {
    setSelectedStoreState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const requireStore = useCallback(() => {
    if (selectedStore) return true;
    if (stores.length > 1) setShowCityModal(true);
    return false;
  }, [selectedStore, stores]);

  return (
    <StoreContext.Provider
      value={{
        selectedStore,
        setSelectedStore,
        clearStore,
        isLoading,
        stores,
        showCityModal,
        setShowCityModal,
        requireStore,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
