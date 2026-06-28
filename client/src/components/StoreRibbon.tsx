import { MapPin, ChevronDown } from "lucide-react";
import { useStore } from "@/contexts/StoreContext";

export function StoreRibbon() {
  const { stores, selectedStore, setShowCityModal } = useStore();

  if (stores.length <= 1) return null;

  return (
    <div
      className="w-full flex items-center justify-center gap-2 px-4 py-1.5 text-xs"
      style={{
        background: "linear-gradient(90deg, #fdf5f5 0%, #fce8e8 50%, #fdf5f5 100%)",
        borderBottom: "1px solid #f9d0d0",
      }}
    >
      <MapPin className="h-3 w-3 shrink-0 text-[#6E0D12]" />
      <span className="text-[#5a0a0f]">
        Você está vendo a unidade{" "}
        <strong className="font-semibold text-[#6E0D12]">{selectedStore?.city ?? "-"}</strong>
      </span>
      <button
        onClick={() => setShowCityModal(true)}
        className="ml-1 flex items-center gap-0.5 font-semibold text-[#6E0D12] transition-all hover:underline underline-offset-2"
      >
        Trocar
        <ChevronDown className="h-3 w-3" />
      </button>
    </div>
  );
}
