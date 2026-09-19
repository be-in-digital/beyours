"use client"

/**
 * A Convex query that a role without the permission never mounts (#522).
 *
 * WHY A HELPER AND NOT A TERNARY. `kitchen` and `delivery` hold `orders:read`,
 * so « Commandes » is drawn for them and every row links to `/orders/[orderId]`
 * — a page that mounted `payments.getByOrder`, which their role may not run.
 * Convex rethrows a refusal out of `useQuery` DURING RENDER, so that is not an
 * empty panel but an error page, on a screen the role was invited to open.
 *
 * Passing `"skip"` from a ternary fixes the behaviour and nothing else:
 * `nav-permission-surface.test.ts` reads SOURCE, because `packages/admin`
 * receives the Convex API as `api: any` and no type connects a screen to the
 * function it calls. A gate expressed as an argument is invisible to it, so the
 * guard would keep reporting a defect that had been fixed — and the next one
 * would be indistinguishable from the noise.
 *
 * So the gate is a name the sweep can see. The permission is a literal here,
 * beside the call it guards, and the test reads it out of the source.
 *
 * `useQuery` is still called unconditionally, which the rules of hooks require;
 * only its argument changes.
 */

import { useQuery } from "convex/react"
import { hasPermission, type Permission, type Role } from "@be-yours/core"

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * @param role       the signed-in member's role, as the admin auth store holds it
 * @param permission what the query's Convex wrapper enforces
 * @param reference  the Convex function reference off the injected API object,
 *                   or a falsy value before that object has arrived. Written
 *                   without an example of the dotted form on purpose:
 *                   `refund-surface.test.ts` scans source for such references
 *                   and checks each one exists, and a specimen in a comment
 *                   reads to it as a call to a function nothing declares.
 * @param args       the arguments, or `"skip"` for the caller's own reasons
 *
 * Returns `undefined` when the role lacks the permission — the same value
 * `useQuery` gives while a query is in flight, so a caller that already handles
 * "not loaded yet" handles "not allowed" without a second branch.
 */
export function usePermittedQuery<T>(
  role: Role | string | null | undefined,
  permission: Permission,
  reference: any,
  args: any
): T | undefined {
  const allowed = hasPermission(role as Role, permission)
  return useQuery(
    reference ?? ("skip" as never),
    allowed ? args : "skip"
  ) as T | undefined
}
