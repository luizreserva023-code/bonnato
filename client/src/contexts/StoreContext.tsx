import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { resolveTenantHeaderColor } from "@/shared/tenant/tenant-config";
import { DEFAULT_TENANT_CONFIG, type TenantRuntimeConfig } from "@/shared/tenant/tenant-config";

export interface SelectedStore {
  id: number;
  tenantKey?: string;
  name: string;
  slug: string;
  city: string;
  address?: string | null;
  phone?: string | null;
  isDefault?: boolean;
  productCount?: number;
  hasCatalog?: boolean;
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
  tenantConfig: TenantRuntimeConfig;
  isTenantLocked: boolean;
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

  const host = typeof window === "undefined" ? undefined : window.location.hostname;
  const { data: stores = [], isLoading } = trpc.stores.list.useQuery({ host }, {
    staleTime: 5 * 60 * 1000,
  });
  const { data: hostTenant, isLoading: loadingTenant } = trpc.stores.resolveTenant.useQuery(
    { host },
    { staleTime: 5 * 60 * 1000 },
  );
  const isTenantLocked = hostTenant?.matchedBy === "domain" || hostTenant?.matchedBy === "subdomain";
  const { data: selectedTenant } = trpc.stores.resolveTenant.useQuery(
    { slug: selectedStore?.slug },
    { enabled: Boolean(selectedStore?.slug) && !isTenantLocked, staleTime: 5 * 60 * 1000 },
  );
  const tenantConfig = selectedTenant?.runtime ?? hostTenant?.runtime ?? DEFAULT_TENANT_CONFIG;
  const availableStores = useMemo(() => {
    const storesWithCatalog = stores.filter((store) => store.hasCatalog !== false);
    return storesWithCatalog.length ? storesWithCatalog : stores;
  }, [stores]);

  useEffect(() => {
    if (!isTenantLocked || availableStores.length !== 1) return;
    const tenantStore = availableStores[0];
    if (selectedStore?.id === tenantStore.id) return;
    setSelectedStoreState(tenantStore);
    saveToStorage(tenantStore);
    setShowCityModal(false);
  }, [availableStores, isTenantLocked, selectedStore?.id]);

  useEffect(() => {
    if (isLoading || loadingTenant || availableStores.length === 0) return;
    const catalogStores = availableStores.filter((store) => store.hasCatalog !== false);
    const selectedStoreIsAvailable = selectedStore && availableStores.some((store) => store.id === selectedStore.id && (store.hasCatalog !== false || catalogStores.length === 0));
    if (selectedStoreIsAvailable) return;

    const selectableStores = catalogStores.length ? catalogStores : availableStores;
    if (selectableStores.length === 1) {
      const store = selectableStores[0];
      setSelectedStoreState(store);
      saveToStorage(store);
    } else {
      const defaultStore = selectableStores.find((store) => store.isDefault) ?? selectableStores[0];
      if (defaultStore) {
        setSelectedStoreState(defaultStore);
        saveToStorage(defaultStore);
      }
    }
  }, [availableStores, isLoading, loadingTenant, selectedStore]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--tenant-primary", tenantConfig.brand.colors.primary);
    root.style.setProperty("--tenant-primary-dark", tenantConfig.brand.colors.primaryDark);
    root.style.setProperty("--tenant-header", resolveTenantHeaderColor(tenantConfig));
    root.style.setProperty("--tenant-accent", tenantConfig.brand.colors.accent);
    root.style.setProperty("--tenant-background", tenantConfig.brand.colors.background);
    root.style.setProperty("--tenant-text", tenantConfig.brand.colors.text);
    document.title = `${tenantConfig.brand.name} - Pedidos online`;
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon && tenantConfig.brand.logos.favicon) favicon.href = tenantConfig.brand.logos.favicon;
  }, [tenantConfig]);

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
    if (!isTenantLocked && availableStores.length > 1) setShowCityModal(true);
    return false;
  }, [availableStores, isTenantLocked, selectedStore]);

  return (
    <StoreContext.Provider
      value={{
        selectedStore,
        setSelectedStore,
        clearStore,
        isLoading: isLoading || loadingTenant,
        stores: availableStores,
        showCityModal,
        setShowCityModal,
        requireStore,
        tenantConfig,
        isTenantLocked,
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
