/**
 * StoreRibbon — barra discreta exibida abaixo da Navbar
 *
 * Aparece apenas quando há múltiplas lojas cadastradas.
 * Mostra a unidade selecionada e um botão "Trocar" para abrir o modal.
 * Não bloqueia o conteúdo da página.
 */
import { MapPin, ChevronDown } from "lucide-react";
import { useStore } from "@/contexts/StoreContext";

export function StoreRibbon() {
  const { stores, selectedStore, setShowCityModal } = useStore();

  // Só exibe se há mais de uma loja
  if (stores.length <= 1) return null;

  return (
    <div
      className="w-full flex items-center justify-center gap-2 py-1.5 px-4 text-xs"
      style={{
        background: "linear-gradient(90deg, #fdf5f5 0%, #fce8e8 50%, #fdf5f5 100%)",
        borderBottom: "1px solid #f9d0d0",
      }}
    >
      <MapPin className="w-3 h-3 text-[#6E0D12] shrink-0" />
      <span className="text-[#5a0a0f]">
        Você está vendo a unidade{" "}
        <strong className="font-semibold text-[#6E0D12]">
          {selectedStore?.city ?? "—"}
        </strong>
      </span>
      <button
        onClick={() => setShowCityModal(true)}
        className="flex items-center gap-0.5 text-[#6E0D12] font-semibold hover:underline underline-offset-2 transition-all ml-1"
      >
        Trocar
        <ChevronDown className="w-3 h-3" />
      </button>
    </div>
  );
}
