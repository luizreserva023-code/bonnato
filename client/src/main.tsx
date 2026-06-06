import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { toast } from "sonner";
import App from "./App";
import { getLoginUrl } from "./const";
import { StoreProvider } from "./contexts/StoreContext";
import { CitySelectModal } from "./components/CitySelectModal";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Evita rajadas de refetch em foco de janela somadas a polling manual
      // das telas Admin (`refetchInterval`). Cada tela pode sobrescrever.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof TRPCClientError) {
          const code = (error.data as { code?: string } | undefined)?.code;
          if (code === "UNAUTHORIZED" || code === "FORBIDDEN" || code === "BAD_REQUEST") {
            return false;
          }
        }
        return failureCount < 2;
      },
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized =
    error.message === UNAUTHED_ERR_MSG ||
    (error.data as { code?: string } | undefined)?.code === "UNAUTHORIZED";

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

const showFriendlyErrorToast = (error: unknown, source: "Query" | "Mutation") => {
  if (!(error instanceof TRPCClientError)) return;
  const code = (error.data as { code?: string } | undefined)?.code;
  // Não exibir toast para estados de auth/permissão — o fluxo já redireciona ou
  // os próprios componentes tratam. Evita spam em carregamentos iniciais.
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return;
  if (source === "Query") return; // queries silenciosas; apenas mutations exibem toast
  const message = error.message || "Algo deu errado. Tente novamente.";
  toast.error(message);
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    showFriendlyErrorToast(error, "Query");
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    showFriendlyErrorToast(error, "Mutation");
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: (() => {
        const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
        return baseUrl ? `${baseUrl}/api/trpc` : "/api/trpc";
      })(),
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT?.replace(/\/$/, "");
const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;

if (analyticsEndpoint && analyticsWebsiteId && typeof document !== "undefined") {
  const analyticsScript = document.createElement("script");
  analyticsScript.defer = true;
  analyticsScript.src = `${analyticsEndpoint}/umami`;
  analyticsScript.dataset.websiteId = analyticsWebsiteId;
  document.body.appendChild(analyticsScript);
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <App />
        <CitySelectModal />
      </StoreProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
