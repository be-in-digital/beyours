"use client"

import { useEffect } from "react"
import { useQuery } from "convex/react"
import { usePathname, useRouter } from "next/navigation"
import { useAdminAuthStore } from "../stores/admin-auth-store"
import { useAdminApiStore } from "../stores/admin-api-store"
import { Skeleton } from "@be-in-digital/ui"

interface AuthGuardProps {
  children: React.ReactNode
}

/** Where a visitor with no business here is sent. */
const STOREFRONT = "/menu"

/**
 * Route protection for the admin.
 *
 * It used to check authentication and nothing else, and that was enough to
 * break the app: a signed-in CUSTOMER reaching `/dashboard` was let through,
 * `StoreGuard` then fired `stores.listAll` — which is gated on `requireStaff` —
 * and `useQuery` rethrew the refusal DURING RENDER. Same outcome for a staff
 * member opening a page above their role, and for an owner whose `userProfiles`
 * row had never been provisioned. The permission system was right; the UI
 * turned every one of its answers into a crash.
 *
 * So the role is checked HERE, before any child mounts a query that can be
 * refused. The profile is read through the injected api rather than the auth
 * store because the two answers differ: the store flattens "customer" and "no
 * profile at all" into the same role, and those two people need to be told
 * completely different things.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const isLoading = useAdminAuthStore((s) => s.isLoading)
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex API is injected at runtime
  const api = useAdminApiStore((s) => s.api) as Record<string, Record<string, unknown>> | null
  const profile = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic query reference
    (api?.userProfiles?.getMyProfile ?? "skip") as any,
    isAuthenticated ? {} : "skip"
  ) as { role?: string } | null | undefined

  // Whether this deployment has an administrator at all. It is what separates
  // the two people who arrive here with no profile: a visitor who typed the
  // URL, and the restaurateur of a deployment nobody has finished setting up.
  // Sign-up provisions no profile, so on a fresh deployment EVERY account looks
  // like the second one — and telling a customer to go and configure the
  // backend is worse than saying nothing.
  const bootstrap = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic query reference
    (api?.userProfiles?.bootstrapStatus ?? "skip") as any,
    isAuthenticated ? {} : "skip"
  ) as { claimed?: boolean } | undefined

  // Not signed in at all: back to sign-in, remembering where they were headed
  // so they are not dropped on the storefront holding a link they have to find
  // again.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/sign-in?redirect=${encodeURIComponent(pathname)}`)
    }
  }, [isLoading, isAuthenticated, pathname, router])

  const profilePending =
    isAuthenticated && (api === null || profile === undefined || bootstrap === undefined)

  // No rights, whichever way the profile says so: an explicit `customer` row,
  // or no row at all.
  const hasNoRights = profile === null || profile?.role === "customer"
  // …and the deployment is already set up, so there is nothing for this person
  // to configure. They simply do not belong here.
  const isVisitor = hasNoRights && bootstrap?.claimed === true
  const setupUnfinished = hasNoRights && bootstrap?.claimed === false

  // Redirect rather than render an explanation nobody asked for — they were
  // not looking for the back office.
  useEffect(() => {
    if (isVisitor) router.replace(STOREFRONT)
  }, [isVisitor, router])

  if (isLoading || profilePending) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="w-full max-w-sm space-y-4 p-8">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-10 w-full mt-6" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated || isVisitor) {
    return null
  }

  // Signed in, no rights, and this deployment has no administrator yet. Every
  // admin screen used to answer "User profile not found", which reads as a
  // broken product rather than an unfinished installation. Say which it is,
  // and where the door is.
  if (setupUnfinished) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center px-6">
        <div className="max-w-md space-y-5 text-center" data-testid="setup-unfinished">
          <h1 className="text-xl font-semibold tracking-tight">
            Ce déploiement n&apos;a pas encore d&apos;administrateur
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Personne ne détient le siège d&apos;administrateur, donc aucun écran
            de gestion n&apos;est accessible. Si vous installez ce déploiement,
            désignez le premier administrateur.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm">
            <a href="/setup" className="font-medium text-primary underline underline-offset-4">
              Configurer le déploiement
            </a>
            <a href={STOREFRONT} className="text-muted-foreground underline underline-offset-4">
              Retour au site
            </a>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
