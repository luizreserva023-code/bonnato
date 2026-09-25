import { useStore } from "@/contexts/StoreContext";

export function useBonattoConfig() {
  return useStore().bonattoConfig;
}