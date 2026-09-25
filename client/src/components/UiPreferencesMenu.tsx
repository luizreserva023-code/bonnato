import { BookOpen, Command, Rows3, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUiPreferences } from "@/contexts/UiPreferencesContext";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/GlobalCommandPalette";
import { RESTART_ADMIN_ONBOARDING_EVENT } from "@/components/AdminOnboarding";
import { openAdminHelp } from "@/components/admin/AdminHelpCenter";

export function UiPreferencesMenu({ compact = false }: { compact?: boolean }) {
  const { density, setDensity } = useUiPreferences();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          data-help-id="settings.interface"
          type="button"
          variant="outline"
          size={compact ? "icon" : "sm"}
          className={compact ? "h-8 w-8" : "h-9 gap-2"}
          aria-label="Preferências da interface"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {!compact && <span>Interface</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Interface</DropdownMenuLabel>
        <DropdownMenuLabel className="pt-1 text-[11px] font-normal text-muted-foreground">
          Aparência fixa no modo claro
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Densidade</DropdownMenuLabel>
        <DropdownMenuItem data-help-id="settings.densityComfortable" onClick={() => setDensity("comfortable")} className={density === "comfortable" ? "font-semibold" : ""}>
          <Rows3 className="h-4 w-4" /> Confortável {density === "comfortable" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem data-help-id="settings.densityCompact" onClick={() => setDensity("compact")} className={density === "compact" ? "font-semibold" : ""}>
          <Rows3 className="h-4 w-4" /> Compacta {density === "compact" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-help-id="common.commandPalette" onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}>
          <Command className="h-4 w-4" /> Busca e comandos
          <span className="ml-auto text-xs text-muted-foreground">Ctrl K</span>
        </DropdownMenuItem>
        <DropdownMenuItem data-help-id="common.fullTutorial" onClick={() => openAdminHelp("tutorial")}>
          <BookOpen className="h-4 w-4" /> Tutorial completo
        </DropdownMenuItem>
        <DropdownMenuItem data-help-id="common.introduction" onClick={() => window.dispatchEvent(new Event(RESTART_ADMIN_ONBOARDING_EVENT))}>
          <Command className="h-4 w-4" /> Rever introdução
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
