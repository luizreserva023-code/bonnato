import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, CircleHelp, Command, Settings2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const RESTART_ADMIN_ONBOARDING_EVENT = "bonatto:restart-admin-onboarding";
const STORAGE_KEY = "bonatto_admin_onboarding_v1_done";

const steps = [
  {
    icon: Store,
    title: "Escolha a unidade",
    description: "O seletor de loja define o contexto de pedidos, cardápio, clientes e relatórios. Suas permissões também são aplicadas por unidade.",
  },
  {
    icon: Command,
    title: "Use Ctrl + K",
    description: "Abra a busca global de qualquer tela para localizar pedidos e clientes ou navegar rapidamente pelo painel.",
  },
  {
    icon: Bell,
    title: "Acompanhe o que exige atenção",
    description: "Pedidos, notificações e indicadores mostram apenas o que precisa de ação. Badges não são apenas decorativos.",
  },
  {
    icon: Settings2,
    title: "Ajuste a interface",
    description: "Altere a densidade e recolha a barra lateral quando precisar de mais espaço para trabalhar.",
  },
  {
    icon: CircleHelp,
    title: "Use a Central de Ajuda",
    description: "O botão Ajuda explica a tela atual, permite pesquisar funções, ativa o Modo Ajuda para entender controles sem executá-los e oferece o tutorial completo do sistema.",
  },
];

export function AdminOnboarding() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) !== "true";
  });
  const [index, setIndex] = useState(0);
  const step = useMemo(() => steps[index], [index]);
  const Icon = step.icon;

  useEffect(() => {
    const restart = () => {
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener(RESTART_ADMIN_ONBOARDING_EVENT, restart);
    return () => window.removeEventListener(RESTART_ADMIN_ONBOARDING_EVENT, restart);
  }, []);

  function finish() {
    try { window.localStorage.setItem(STORAGE_KEY, "true"); } catch {}
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) finish(); else setOpen(true); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span>Primeiro acesso</span>
            <span className="ml-auto">{index + 1} de {steps.length}</span>
          </div>
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <DialogTitle>{step.title}</DialogTitle>
          <DialogDescription className="leading-6">{step.description}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1.5" aria-label="Progresso do tutorial">
          {steps.map((item, stepIndex) => (
            <span
              key={item.title}
              className={stepIndex <= index ? "h-1.5 flex-1 rounded-full bg-primary" : "h-1.5 flex-1 rounded-full bg-muted"}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={finish}>Pular</Button>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
              Voltar
            </Button>
            {index < steps.length - 1 ? (
              <Button type="button" onClick={() => setIndex((value) => Math.min(steps.length - 1, value + 1))}>Próximo</Button>
            ) : (
              <Button type="button" className="gap-2" onClick={finish}><CheckCircle2 className="h-4 w-4" /> Concluir</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
