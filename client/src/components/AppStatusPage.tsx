import { AlertTriangle, ArrowLeft, Home, ShieldX, Wrench } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type StatusKind = "forbidden" | "server" | "maintenance";

const COPY: Record<StatusKind, {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
}> = {
  forbidden: {
    eyebrow: "Acesso restrito",
    title: "Você não tem permissão para acessar esta área.",
    description: "Seu perfil não possui as permissões necessárias para este recurso.",
    icon: <ShieldX className="h-8 w-8" aria-hidden="true" />,
  },
  server: {
    eyebrow: "Falha temporária",
    title: "Não foi possível concluir esta solicitação.",
    description: "O sistema encontrou uma falha inesperada. Tente novamente sem reenviar ações críticas.",
    icon: <AlertTriangle className="h-8 w-8" aria-hidden="true" />,
  },
  maintenance: {
    eyebrow: "Indisponibilidade temporária",
    title: "Este recurso está temporariamente indisponível.",
    description: "Estamos preservando a estabilidade da operação. Tente acessar novamente em instantes.",
    icon: <Wrench className="h-8 w-8" aria-hidden="true" />,
  },
};

export function AppStatusPage({
  kind,
  onRetry,
}: {
  kind: StatusKind;
  onRetry?: () => void;
}) {
  const copy = COPY[kind];
  return (
    <div className="grid min-h-[70vh] place-items-center bg-background px-6 py-12 text-foreground">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-primary">
          {copy.icon}
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{copy.eyebrow}</p>
        <h1 className="mt-3 text-2xl font-semibold">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.description}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar
          </Button>
          <Button type="button" onClick={() => { window.location.href = "/admin"; }}>
            <Home className="h-4 w-4" aria-hidden="true" />
            Ir para o Dashboard
          </Button>
          {onRetry && (
            <Button type="button" variant="secondary" onClick={onRetry}>Tentar novamente</Button>
          )}
        </div>
      </div>
    </div>
  );
}
