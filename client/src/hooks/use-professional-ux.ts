import { useCallback, useEffect, useRef, useState } from "react";

export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      return raw == null ? initialValue : JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}

export function usePersistentFilters<T extends Record<string, unknown>>(key: string, defaults: T) {
  const [filters, setFilters] = usePersistentState<T>(`bonatto_filters_${key}`, defaults);
  const clearFilters = useCallback(() => setFilters(defaults), [defaults, setFilters]);
  return { filters, setFilters, clearFilters };
}

export function useUnsavedChanges(isDirty: boolean, message = "Existem alterações não salvas. Deseja sair mesmo assim?") {
  useEffect(() => {
    if (!isDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  return useCallback(() => !isDirty || window.confirm(message), [isDirty, message]);
}

export function useAutosaveDraft<T>(
  key: string,
  value: T,
  options?: { enabled?: boolean; delay?: number },
) {
  const { enabled = true, delay = 700 } = options ?? {};
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const first = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("saving");
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(`bonatto_draft_${key}`, JSON.stringify(value));
        setStatus("saved");
      } catch {
        setStatus("idle");
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [delay, enabled, key, value]);

  const restore = useCallback((): T | null => {
    try {
      const raw = window.localStorage.getItem(`bonatto_draft_${key}`);
      return raw ? JSON.parse(raw) as T : null;
    } catch {
      return null;
    }
  }, [key]);

  const clear = useCallback(() => {
    try { window.localStorage.removeItem(`bonatto_draft_${key}`); } catch {}
    setStatus("idle");
  }, [key]);

  return { status, restore, clear };
}

export function triggerHaptic(pattern: number | number[] = 10) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    if (window.localStorage.getItem("bonatto_ui_haptics") === "false") return;
    navigator.vibrate(pattern);
  } catch {}
}
