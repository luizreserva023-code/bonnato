import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  switchable: boolean;
}

const STORAGE_KEY = "bonatto_theme";
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  switchable = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (!switchable || typeof window === "undefined") return defaultTheme;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : defaultTheme;
  });
  const [systemResolved, setSystemResolved] = useState<ResolvedTheme>(() => systemTheme());

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemResolved : theme;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemResolved(media.matches ? "dark" : "light");
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.dataset.theme = theme;
    root.dataset.resolvedTheme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
    document.body.dataset.resolvedTheme = resolvedTheme;
    try {
      if (switchable) window.localStorage.setItem(STORAGE_KEY, theme);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [theme, resolvedTheme, switchable]);

  const value = useMemo<ThemeContextType>(() => ({
    theme,
    resolvedTheme,
    switchable,
    setTheme: (next) => {
      if (!switchable) return;
      setThemeState(next);
    },
    toggleTheme: () => {
      if (!switchable) return;
      setThemeState((current) => current === "light" ? "dark" : current === "dark" ? "system" : "light");
    },
  }), [theme, resolvedTheme, switchable]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
