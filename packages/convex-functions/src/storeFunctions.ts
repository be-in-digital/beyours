/**
 * Deep auth seam for admin-facing Convex functions — shared by every app.
 *
 * Every store-scoped wrapper used to hand-roll the same prelude — identity
 * check, store lookup, access check. These builders absorb that policy behind
 * one narrow interface:
 *
 *   export const create = storeMutation({
 *     args: defs.create.args,
 *     handler: (ctx, args) => defs.create.handler(ctx, args),
 *   })
 *
 *   export const update = storeMutation({
 *     args: defs.update.args,
 *     storeIdFrom: storeIdFromDocument("Menu not found"),
 *     handler: async (ctx, args) => { ... },
 *   })
 *
 * - `storeIdFrom` defaults to `args.storeId`; use `storeIdFromDocument` when
 *   the store is reached through a document id.
 * - `permission` upgrades the check to RBAC (`requireStorePermission`).
 * - `authedQuery`/`authedMutation` only require authentication and hand the
 *   identity to the handler.
 *
 * WHY THIS IS A FACTORY: the builders need each app's generated `query` and
 * `mutation`, which live in that app's `convex/_generated/`. The seam used to
 * exist only inside `apps/reference/convex/lib/` — so `apps/themes`, the
 * template cloned for every client, had no seam at all and hand-rolled inline
 * guards instead. The engine's authorisation policy has to ship with the
 * engine, not with its test bench.
 *
 * Each app instantiates it once:
 *
 *   // convex/lib/storeFunctions.ts
 *   export const { storeQuery, storeMutation, ... } =
 *     createStoreFunctions<QueryCtx, MutationCtx>({ query, mutation })
 */

import type { GenericId, ObjectType, PropertyValidators } from "convex/values"
import type {
  RegisteredMutation,
  RegisteredQuery,
  UserIdentity,
} from "convex/server"
import { requireStoreAccess, requireStorePermission } from "./auth"
import type { Permission } from "@be-in-digital/core"

/**
 * The slice of a Convex context this seam actually touches. Declared
 * structurally so an app's generated `QueryCtx` satisfies it without the
 * package having to know that app's data model. The `any` mirrors the rest of
 * this package, where handlers take `ctx: any` for the same reason.
 */
export interface SeamQueryCtx {
  auth: { getUserIdentity: () => Promise<UserIdentity | null> }
  db: { get: (id: any) => Promise<any> }
}

export type StoreIdResolver<Ctx, Args> = (
  ctx: Ctx,
  args: Args
) => Promise<GenericId<"stores">>

export interface StoreFunctionSpec<Ctx, Args extends PropertyValidators, Output> {
  args: Args
  /** Defaults to `args.storeId`. */
  storeIdFrom?: StoreIdResolver<Ctx, ObjectType<Args>>
  /** When set, checks RBAC on top of store membership. */
  permission?: Permission
  handler: (
    ctx: Ctx,
    args: ObjectType<Args>,
    identity: UserIdentity
  ) => Promise<Output>
}

export interface AuthedFunctionSpec<Ctx, Args extends PropertyValidators, Output> {
  args: Args
  handler: (
    ctx: Ctx,
    args: ObjectType<Args>,
    identity: UserIdentity
  ) => Promise<Output>
}

/** The generated `query` / `mutation` builders an app hands to the factory. */
export interface ConvexBuilders {
  query: (spec: any) => any
  mutation: (spec: any) => any
}

async function authorize<Ctx extends SeamQueryCtx>(
  ctx: Ctx,
  args: Record<string, unknown>,
  spec: {
    storeIdFrom?: StoreIdResolver<Ctx, never>
    permission?: Permission
  }
): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("Not authenticated")

  const storeId = spec.storeIdFrom
    ? await spec.storeIdFrom(ctx, args as never)
    : (args as { storeId: GenericId<"stores"> }).storeId

  if (spec.permission) {
    await requireStorePermission(ctx, storeId, spec.permission)
  } else {
    await requireStoreAccess(ctx, storeId)
  }
  return identity
}

/**
 * Build the store-scoped function constructors for one app.
 *
 * `QCtx` / `MCtx` are the app's own generated contexts, so handlers keep full
 * access to that app's typed `db` — the factory only fixes the ctx types, the
 * returned builders stay generic in their arguments and output.
 */
export function createStoreFunctions<
  QCtx extends SeamQueryCtx,
  MCtx extends SeamQueryCtx,
>(builders: ConvexBuilders) {
  const { query, mutation } = builders

  // The generic registration types of `query`/`mutation` reject structurally
  // identical generics (TS2719). The seam owns the ONE cast — callers get the
  // exact public type back — instead of ~192 scattered casts in the wrappers.

  /** Query gated on store access (membership, or RBAC via `permission`). */
  function storeQuery<Args extends PropertyValidators, Output>(
    spec: StoreFunctionSpec<QCtx, Args, Output>
  ): RegisteredQuery<"public", ObjectType<Args>, Promise<Output>> {
    return query({
      args: spec.args,
      handler: async (ctx: any, args: any) => {
        const identity = await authorize(ctx, args, spec)
        return spec.handler(ctx, args, identity)
      },
    }) as RegisteredQuery<"public", ObjectType<Args>, Promise<Output>>
  }

  /** Mutation gated on store access (membership, or RBAC via `permission`). */
  function storeMutation<Args extends PropertyValidators, Output>(
    spec: StoreFunctionSpec<MCtx, Args, Output>
  ): RegisteredMutation<"public", ObjectType<Args>, Promise<Output>> {
    return mutation({
      args: spec.args,
      handler: async (ctx: any, args: any) => {
        const identity = await authorize(ctx, args, spec)
        return spec.handler(ctx, args, identity)
      },
    }) as RegisteredMutation<"public", ObjectType<Args>, Promise<Output>>
  }

  /** Query that only requires an authenticated caller. */
  function authedQuery<Args extends PropertyValidators, Output>(
    spec: AuthedFunctionSpec<QCtx, Args, Output>
  ): RegisteredQuery<"public", ObjectType<Args>, Promise<Output>> {
    return query({
      args: spec.args,
      handler: async (ctx: any, args: any) => {
        const identity = await ctx.auth.getUserIdentity()
        if (!identity) throw new Error("Not authenticated")
        return spec.handler(ctx, args, identity)
      },
    }) as RegisteredQuery<"public", ObjectType<Args>, Promise<Output>>
  }

  /** Mutation that only requires an authenticated caller. */
  function authedMutation<Args extends PropertyValidators, Output>(
    spec: AuthedFunctionSpec<MCtx, Args, Output>
  ): RegisteredMutation<"public", ObjectType<Args>, Promise<Output>> {
    return mutation({
      args: spec.args,
      handler: async (ctx: any, args: any) => {
        const identity = await ctx.auth.getUserIdentity()
        if (!identity) throw new Error("Not authenticated")
        return spec.handler(ctx, args, identity)
      },
    }) as RegisteredMutation<"public", ObjectType<Args>, Promise<Output>>
  }

  /**
   * Resolve the store through a document referenced by `args.id`.
   * Throws `notFoundMessage` when the document (or its storeId) is missing.
   */
  function storeIdFromDocument(notFoundMessage: string) {
    return async (
      ctx: QCtx,
      args: { id: GenericId<string> }
    ): Promise<GenericId<"stores">> => {
      const doc = await ctx.db.get(args.id)
      const storeId = (doc as { storeId?: GenericId<"stores"> } | null)?.storeId
      if (!storeId) throw new Error(notFoundMessage)
      return storeId
    }
  }

  /**
   * Resolve the store through a document referenced by an arbitrary argument.
   *
   * `storeIdFromDocument` assumes the id arrives as `args.id`, which covers most
   * wrappers. Plenty reach their store through a differently named reference —
   * `orderId`, `articleId` — and those were exactly the ones left with an
   * auth-only guard because the seam had nothing to offer them.
   */
  function storeIdFromField<Field extends string>(
    field: Field,
    notFoundMessage: string
  ) {
    return async (
      ctx: QCtx,
      args: Record<Field, GenericId<string>>
    ): Promise<GenericId<"stores">> => {
      const doc = await ctx.db.get(args[field])
      const storeId = (doc as { storeId?: GenericId<"stores"> } | null)?.storeId
      if (!storeId) throw new Error(notFoundMessage)
      return storeId
    }
  }

  return {
    storeQuery,
    storeMutation,
    authedQuery,
    authedMutation,
    storeIdFromDocument,
    storeIdFromField,
  }
}
