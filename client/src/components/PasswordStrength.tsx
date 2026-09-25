import { Check, Circle } from "lucide-react";
import { evaluatePassword } from "@/lib/form-utils";
import { cn } from "@/lib/utils";

export function PasswordStrength({ password, className }: { password: string; className?: string }) {
  const result = evaluatePassword(password);
  const rows = [
    ["length", "8 caracteres"],
    ["uppercase", "letra maiúscula"],
    ["lowercase", "letra minúscula"],
    ["number", "número"],
    ["special", "caractere especial"],
  ] as const;

  return (
    <div className={cn("space-y-2 rounded-xl border bg-muted/30 p-3", className)} aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold">Força da senha</span>
        <span className="text-muted-foreground">{result.label}</span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {rows.map(([key, label]) => {
          const ok = result.criteria[key];
          return (
            <div key={key} className="flex items-center gap-2 text-xs">
              {ok ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Circle className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />}
              <span className={ok ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
              <span className="sr-only">{ok ? "atendido" : "pendente"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
