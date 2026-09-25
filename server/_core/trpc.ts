import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.ts";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context.ts";
import { authorizeStaffProcedure, hasActiveStaffAccess } from "../accessControl.ts";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;

const requestObservability = t.middleware(async (opts) => {
  const startedAt = Date.now();
  try {
    return await opts.next();
  } catch (error) {
    const code = error instanceof TRPCError ? error.code : "INTERNAL_SERVER_ERROR";
    console.error(JSON.stringify({
      level: "error",
      event: "trpc_error",
      requestId: opts.ctx.requestId,
      path: opts.path,
      type: opts.type,
      userId: opts.ctx.user?.id ?? null,
      code,
      durationMs: Date.now() - startedAt,
    }));
    if (!(error instanceof TRPCError) && error instanceof Error) {
      console.error(error.stack ?? error.message);
    }
    throw error;
  }
});

const observedProcedure = t.procedure.use(requestObservability);
export const publicProcedure = observedProcedure;

function isPlatformAdmin(role?: string | null) {
  return role === "admin";
}

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = observedProcedure.use(requireUser);

export const adminProcedure = observedProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || !isPlatformAdmin(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// Platform operations are intentionally isolated from tenant administration.
// Keeping a separate procedure makes accidental exposure during future router
// refactors much harder than repeating role checks inside every resolver.
export const platformAdminProcedure = observedProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || !isPlatformAdmin(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        isPlatformAdmin: true as const,
      },
    });
  }),
);

// staffProcedure: aceita admin (ve tudo) ou manager (ve apenas sua loja)
export const staffProcedure = observedProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    if (!isPlatformAdmin(ctx.user.role) && ctx.user.role !== "manager") {
      if (!await hasActiveStaffAccess(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      }
      await authorizeStaffProcedure({
        user: ctx.user,
        path: opts.path,
        type: opts.type,
        rawInput: await opts.getRawInput(),
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        isOwner: isPlatformAdmin(ctx.user.role),
      },
    });
  }),
);
