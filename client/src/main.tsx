import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { toast } from "sonner";
import App from "./App";
const CitySelectModal = lazy(() =>
  import("./components/CitySelectModal").then((module) => ({ default: module.CitySelectModal })),
);
import { StoreProvider } from "./contexts/StoreContext";
import { logApiError, redirectToLoginIfUnauthorized, shouldToastGlobalApiError } from "./shared/lib/api-error-handling";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (error instanceof TRPCClientError) {
          const code = (error.data as { code?: string } | undefined)?.code;
          if (
            code === "UNAUTHORIZED"
            || code === "FORBIDDEN"
            || code === "BAD_REQUEST"
            || code === "TOO_MANY_REQUESTS"
          ) {
            return false;
          }
        }
        return failureCount < 1;
      },
    },
  },
});

const showFriendlyErrorToast = (error: unknown, source: "Query" | "Mutation") => {
  if (!shouldToastGlobalApiError(error, source)) return;
  const rawMessage = error instanceof TRPCClientError ? error.message : "";
  const exposesInternalDetails = /failed query|insert into|select .* from|information_schema|params:|credentials missing|built_in_[a-z_]+|storage (?:proxy|upload) failed/i.test(rawMessage);
  const message = exposesInternalDetails
    ? "Nao foi possivel concluir a operacao. Tente novamente em instantes."
    : rawMessage || "Algo deu errado. Tente novamente.";
  toast.error(message);
};

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    showFriendlyErrorToast(error, "Query");
    logApiError(error, "Query");
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    showFriendlyErrorToast(error, "Mutation");
    logApiError(error, "Mutation");
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
  const loadExternalAnalytics = () => {
    if (document.querySelector('script[data-bonatto-analytics="umami"]')) return;
    const analyticsScript = document.createElement("script");
    analyticsScript.defer = true;
    analyticsScript.src = `${analyticsEndpoint}/umami`;
    analyticsScript.dataset.websiteId = analyticsWebsiteId;
    analyticsScript.dataset.bonattoAnalytics = "umami";
    document.body.appendChild(analyticsScript);
  };

  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };
  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(loadExternalAnalytics, { timeout: 3_000 });
  } else {
    window.setTimeout(loadExternalAnalytics, 1_500);
  }
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <App />
        <Suspense fallback={null}><CitySelectModal /></Suspense>
      </StoreProvider>
    </QueryClientProvider>
  </trpc.Provider>,
);
