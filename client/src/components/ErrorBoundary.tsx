import { cn } from "@/lib/utils";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: "" };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    const componentStack = info.componentStack ?? "";
    this.setState({ componentStack });
    console.error("[BonattoErrorBoundary]", {
      message: error.message,
      stack: error.stack,
      componentStack,
      pathname: window.location.pathname,
      search: window.location.search,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle size={28} aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-semibold">Não foi possível carregar esta tela</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Ocorreu uma falha inesperada. Seus dados não foram alterados por esta mensagem de erro.
              Tente recarregar a página ou volte para o painel.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
                  "bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = "/admin"; }}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium",
                  "bg-background hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <Home size={16} aria-hidden="true" />
                Ir para o Dashboard
              </button>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              Se o problema persistir, tente novamente mais tarde ou informe o suporte.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
