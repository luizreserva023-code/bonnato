import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { BONATTO_CONFIG, BONATTO_HEADER_COLOR, type BonattoRuntimeConfig } from "@/config/bonatto";

export interface SelectedStore {
  id: number; name: string; slug: string; city: string; address?: string | null; phone?: string | null;
  isDefault?: boolean; productCount?: number; hasCatalog?: boolean;
}

interface StoredData { store: SelectedStore; expiresAt: number; }
type StoreSwitchOptions = {
  skipCartConfirmation?: boolean;
  destinationPath?: string;
};

interface StoreContextValue {
  selectedStore: SelectedStore | null;
  setSelectedStore: (store: SelectedStore, options?: StoreSwitchOptions) => void;
  clearStore: () => void;
  isLoading: boolean;
  stores: SelectedStore[];
  showCityModal: boolean;
  setShowCityModal: (value: boolean) => void;
  requireStore: () => boolean;
  bonattoConfig: BonattoRuntimeConfig;
}

const StoreContext = createContext<StoreContextValue | null>(null);
const STORAGE_KEY = "bonatto_selected_store_v3";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STORE_SCOPED_PATH = /^\/(?:cardapio|checkout|meus-pedidos|minha-conta|termos-de-uso|politica-de-privacidade|clube)(?:\/|$)|^\/rastrear\/|^\/pagamento\//;

function loadFromStorage(): SelectedStore | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: StoredData = JSON.parse(raw);
    if (Date.now() > data.expiresAt) { localStorage.removeItem(STORAGE_KEY); return null; }
    return data.store;
  } catch { return null; }
}

function saveToStorage(store: SelectedStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ store, expiresAt: Date.now() + TTL_MS } satisfies StoredData));
}

function getRouteStoreSlug(pathname: string, stores: SelectedStore[]) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return stores.some((store) => store.slug === firstSegment) ? firstSegment : null;
}

function stripStoreSlug(pathname: string, stores: SelectedStore[]) {
  const slug = getRouteStoreSlug(pathname, stores);
  if (!slug) return pathname;
  const suffix = pathname.slice(slug.length + 1);
  return suffix || "/";
}
function isStoreScopedPath(pathname: string) {
  return pathname === "/" || STORE_SCOPED_PATH.test(pathname);
}

function canonicalPathForStore(store: SelectedStore, pathname: string, stores: SelectedStore[]) {
  const suffix = stripStoreSlug(pathname, stores);
  if (!isStoreScopedPath(suffix)) return pathname;
  return suffix === "/" ? `/${store.slug}` : `/${store.slug}${suffix}`;
}

function replaceBrowserPath(pathname: string) {
  if (window.location.pathname === pathname) return;
  window.history.replaceState(window.history.state, "", `${pathname}${window.location.search}${window.location.hash}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [selectedStore, setSelectedStoreState] = useState<SelectedStore | null>(() => loadFromStorage());
  const [showCityModal, setShowCityModal] = useState(false);
  const { data: stores = [], isLoading } = trpc.stores.list.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const availableStores = useMemo(() => {
    const withCatalog = stores.filter((store) => store.hasCatalog !== false);
    return withCatalog.length ? withCatalog : stores;
  }, [stores]);
  useEffect(() => {
    if (isLoading || availableStores.length === 0) return;

    const routeSlug = getRouteStoreSlug(window.location.pathname, availableStores);
    const routeStore = routeSlug ? availableStores.find((store) => store.slug === routeSlug) : null;
    if (routeStore) {
      if (selectedStore?.id !== routeStore.id) {
        setSelectedStoreState(routeStore);
        saveToStorage(routeStore);
      }
      return;
    }

    const selectedStillExists = selectedStore && availableStores.some((store) => store.id === selectedStore.id);
    const nextStore = selectedStillExists
      ? selectedStore
      : (availableStores.find((store) => store.isDefault) ?? availableStores[0]);

    if (!nextStore) return;
    if (!selectedStillExists) {
      setSelectedStoreState(nextStore);
      saveToStorage(nextStore);
    }
    replaceBrowserPath(canonicalPathForStore(nextStore, window.location.pathname, availableStores));
  }, [availableStores, isLoading, selectedStore]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--bonatto-primary", BONATTO_CONFIG.brand.colors.primary);
    root.style.setProperty("--bonatto-primary-dark", BONATTO_CONFIG.brand.colors.primaryDark);
    root.style.setProperty("--bonatto-header", BONATTO_HEADER_COLOR);
    root.style.setProperty("--bonatto-accent", BONATTO_CONFIG.brand.colors.accent);
    root.style.setProperty("--bonatto-background", BONATTO_CONFIG.brand.colors.background);
    root.style.setProperty("--bonatto-text", BONATTO_CONFIG.brand.colors.text);
    document.title = selectedStore
      ? `${BONATTO_CONFIG.brand.name} — ${selectedStore.city}`
      : `${BONATTO_CONFIG.brand.name} - Pedidos online`;
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon && BONATTO_CONFIG.brand.logos.favicon) favicon.href = BONATTO_CONFIG.brand.logos.favicon;
  }, [selectedStore]);

  const setSelectedStore = useCallback((store: SelectedStore, options?: StoreSwitchOptions) => {
    const isChangingStore = Boolean(selectedStore && selectedStore.id !== store.id);
    if (isChangingStore) {
      let hasCartItems = false;
      try {
        const storedCart = JSON.parse(localStorage.getItem("bonatto_cart") ?? "[]");
        hasCartItems = Array.isArray(storedCart) && storedCart.length > 0;
      } catch {
        hasCartItems = false;
      }
      if (hasCartItems && !options?.skipCartConfirmation) {
        const confirmed = window.confirm(
          `Você está mudando para Bonatto ${store.city}. O carrinho da unidade anterior será limpo. Deseja continuar?`,
        );
        if (!confirmed) return;
      }
      localStorage.removeItem("bonatto_cart");
      window.dispatchEvent(new CustomEvent("cart:clear", { detail: { reason: "store-change" } }));
    }
    saveToStorage(store);
    setSelectedStoreState(store);
    setShowCityModal(false);

    const destinationPath = options?.destinationPath
      ? `/${store.slug}${options.destinationPath.startsWith("/") ? options.destinationPath : `/${options.destinationPath}`}`
      : canonicalPathForStore(store, window.location.pathname, availableStores);

    replaceBrowserPath(destinationPath);
  }, [availableStores, selectedStore]);

  const clearStore = useCallback(() => {
    setSelectedStoreState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);
  const requireStore = useCallback(() => {
    if (selectedStore) return true;
    if (availableStores.length > 1) setShowCityModal(true);
    return false;
  }, [availableStores, selectedStore]);

  return <StoreContext.Provider value={{
    selectedStore, setSelectedStore, clearStore, isLoading, stores: availableStores,
    showCityModal, setShowCityModal, requireStore, bonattoConfig: BONATTO_CONFIG,
  }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
}
