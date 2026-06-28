import { getCurrentReturnPath, getLoginUrl } from "@/const";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { TRPCClientError } from "@trpc/client";

let authRedirectInFlight = false;

export function isTrpcAuthError(error: unknown) {
  if (!(error instanceof TRPCClientError)) return false;
  const code = (error.data as { code?: string } | undefined)?.code;
  return error.message === UNAUTHED_ERR_MSG || code === "UNAUTHORIZED";
}

export function getTrpcErrorCode(error: unknown) {
  if (!(error instanceof TRPCClientError)) return undefined;
  return (error.data as { code?: string } | undefined)?.code;
}

export function redirectToLoginIfUnauthorized(error: unknown) {
  if (!isTrpcAuthError(error)) return;
  if (typeof window === "undefined" || authRedirectInFlight) return;

  authRedirectInFlight = true;
  window.location.replace(getLoginUrl(getCurrentReturnPath()));
}

export function shouldToastGlobalApiError(error: unknown, source: "Query" | "Mutation") {
  const code = getTrpcErrorCode(error);
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return false;
  if (source === "Query") return false;
  return error instanceof TRPCClientError;
}

export function logApiError(error: unknown, source: "Query" | "Mutation") {
  if (!import.meta.env.DEV) return;
  if (!(error instanceof TRPCClientError)) return;
  console.error(`[API ${source} Error]`, error);
}
