/**
 * CitySelectModal — modal de seleção de unidade/cidade
 * Visual claro com identidade Bonatto (bordô + branco)
 */
import { MapPin, ChevronRight, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/contexts/StoreContext";
import { cn } from "@/lib/utils";

// Mesmas logos usadas no Navbar
const LOGO_PALMITO_URL = "/brand/palmito-2-circular.png";
const LOGO_TIPOGRAFICA_URL = "/brand/palmito-logo-tipografica.png";

export function CitySelectModal() {
  const { showCityModal, setShowCityModal, stores, selectedStore, setSelectedStore } = useStore();

  if (stores.length <= 1) return null;

  return (
    <Dialog open={showCityModal} onOpenChange={setShowCityModal}>
      <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-sm w-[92vw] overflow-visible">
        <DialogTitle className="sr-only">Escolha sua unidade</DialogTitle>
        <DialogDescription className="sr-only">
          Selecione a unidade Bonatto mais próxima para continuar navegando no cardápio.
        </DialogDescription>
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: "#fff",
            boxShadow: "0 24px 64px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)",
          }}
        >
          {/* Header bordô */}
          <div
            className="relative px-6 pt-7 pb-6 flex flex-col items-center text-center"
            style={{
              background: "linear-gradient(135deg, #9b1520 0%, #6E0D12 60%, #4a080c 100%)",
            }}
          >
            {/* Logos do Navbar lado a lado */}
            <div className="flex items-center gap-2 mb-4">
              <img
                src={LOGO_PALMITO_URL}
                alt="Bonatto"
                className="h-12 w-auto object-contain"
              />
              <img
                src={LOGO_TIPOGRAFICA_URL}
                alt="Bonatto Pizza"
                className="h-9 w-auto object-contain"
              />
            </div>

            <h2 className="text-white font-bold text-lg font-poppins leading-tight">
              Escolha sua unidade
            </h2>
            <p className="text-white/75 text-sm mt-1">
              Selecione a Bonatto Pizza mais próxima de você
            </p>

            {/* Ondinha decorativa na base do header */}
            <svg
              className="absolute bottom-0 left-0 w-full"
              viewBox="0 0 400 16"
              preserveAspectRatio="none"
              style={{ height: 16 }}
            >
              <path d="M0,16 C100,0 300,0 400,16 L400,16 L0,16 Z" fill="#fff" />
            </svg>
          </div>

          {/* Lista de lojas */}
          <div className="px-4 pt-4 pb-2 space-y-2.5">
            {stores.map((store) => {
              const isSelected = selectedStore?.id === store.id;
              return (
                <button
                  key={store.id}
                  onClick={() => setSelectedStore(store)}
                  className={cn(
                    "w-full flex items-center gap-3.5 p-4 rounded-xl border-2 transition-all duration-200 text-left group",
                    isSelected
                      ? "border-[#6E0D12] bg-[#6E0D12]/5"
                      : "border-gray-100 bg-gray-50 hover:border-[#6E0D12]/30 hover:bg-[#6E0D12]/3"
                  )}
                >
                  {/* Ícone */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                    style={{
                      background: isSelected
                        ? "linear-gradient(135deg, #6E0D12 0%, #9b1520 100%)"
                        : "#f3f4f6",
                      boxShadow: isSelected ? "0 4px 12px rgba(110,13,18,0.3)" : "none",
                    }}
                  >
                    <MapPin className={cn(
                      "w-5 h-5 transition-colors",
                      isSelected ? "text-white" : "text-gray-400 group-hover:text-[#6E0D12]"
                    )} />
                  </div>

                  {/* Texto */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-bold font-poppins text-sm truncate transition-colors",
                      isSelected ? "text-[#6E0D12]" : "text-gray-800 group-hover:text-[#6E0D12]"
                    )}>
                      {store.city}
                    </p>
                    {store.address && (
                      <p className="text-gray-400 text-xs truncate mt-0.5">
                        {store.address}
                      </p>
                    )}
                  </div>

                  {/* Indicador */}
                  <div className="flex-shrink-0">
                    {isSelected ? (
                      <CheckCircle2 className="w-5 h-5 text-[#6E0D12]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#6E0D12]/50 transition-colors" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <p className="text-center text-gray-400 text-xs py-4">
            Você pode trocar de unidade a qualquer momento
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
