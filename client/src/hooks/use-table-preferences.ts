import { useCallback, useMemo } from "react";
import { usePersistentState } from "@/hooks/use-professional-ux";

export type TableColumnPreference = {
  id: string;
  label: string;
  hideable?: boolean;
};

type StoredTablePreferences = {
  hidden: string[];
  order: string[];
};

export function useTablePreferences(key: string, columns: readonly TableColumnPreference[]) {
  const defaultState = useMemo<StoredTablePreferences>(() => ({
    hidden: [],
    order: columns.map((column) => column.id),
  }), [columns]);
  const [preferences, setPreferences] = usePersistentState<StoredTablePreferences>(`bonatto_table_${key}`, defaultState);

  const orderedColumns = useMemo(() => {
    const byId = new Map(columns.map((column) => [column.id, column]));
    const ordered = preferences.order.map((id) => byId.get(id)).filter(Boolean) as TableColumnPreference[];
    for (const column of columns) if (!ordered.some((item) => item.id === column.id)) ordered.push(column);
    return ordered.filter((column) => !preferences.hidden.includes(column.id));
  }, [columns, preferences.hidden, preferences.order]);

  const toggleColumn = useCallback((id: string) => {
    const column = columns.find((item) => item.id === id);
    if (!column || column.hideable === false) return;
    setPreferences((current) => ({
      ...current,
      hidden: current.hidden.includes(id) ? current.hidden.filter((value) => value !== id) : [...current.hidden, id],
    }));
  }, [columns, setPreferences]);

  const moveColumn = useCallback((id: string, direction: -1 | 1) => {
    setPreferences((current) => {
      const order = [...current.order];
      const index = order.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= order.length) return current;
      [order[index], order[target]] = [order[target], order[index]];
      return { ...current, order };
    });
  }, [setPreferences]);

  const reset = useCallback(() => setPreferences(defaultState), [defaultState, setPreferences]);

  return {
    orderedColumns,
    preferences,
    toggleColumn,
    moveColumn,
    reset,
    isVisible: (id: string) => !preferences.hidden.includes(id),
  };
}
