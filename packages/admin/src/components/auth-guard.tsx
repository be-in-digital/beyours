"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAdminAuthStore } from "../stores/admin-auth-store"
import { Skeleton } from "../ui/skeleton"

interface AuthGuardProps {
  children: React.ReactNode
}

/**
 * Route protection component for admin pages.
 * Redirects to /sign-in if the user is not authenticated.
 * Shows a full-page skeleton while loading auth state.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const isLoading = useAdminAuthStore((s) => s.isLoading)
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/sign-in")
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
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

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
