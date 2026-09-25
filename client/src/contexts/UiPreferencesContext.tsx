import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type InterfaceDensity = "comfortable" | "compact";

type UiPreferencesContextValue = {
  density: InterfaceDensity;
  setDensity: (density: InterfaceDensity) => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
};

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);
const DENSITY_KEY = "bonatto_ui_density";
const HAPTICS_KEY = "bonatto_ui_haptics";

export function UiPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<InterfaceDensity>(() => {
    if (typeof window === "undefined") return "comfortable";
    return window.localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable";
  });
  const [hapticsEnabled, setHapticsEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(HAPTICS_KEY) !== "false";
  });

  useEffect(() => {
    document.documentElement.dataset.density = density;
    try { window.localStorage.setItem(DENSITY_KEY, density); } catch {}
  }, [density]);

  useEffect(() => {
    try { window.localStorage.setItem(HAPTICS_KEY, String(hapticsEnabled)); } catch {}
  }, [hapticsEnabled]);

  const value = useMemo(() => ({
    density,
    setDensity: setDensityState,
    hapticsEnabled,
    setHapticsEnabled: setHapticsEnabledState,
  }), [density, hapticsEnabled]);

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences() {
  const value = useContext(UiPreferencesContext);
  if (!value) throw new Error("useUiPreferences must be used within UiPreferencesProvider");
  return value;
}
