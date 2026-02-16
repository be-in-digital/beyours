"use client"

import { Suspense } from "react"
import { ResetPasswordForm } from "@beindigital-engine/admin"
import { authClient } from "@/lib/auth-client"
import { useSearchParams } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"

function ResetPasswordSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <Skeleton className="mx-auto mb-2 h-8 w-48" />
        <Skeleton className="mx-auto mb-6 h-4 w-64" />
        <div className="space-y-4">
          <div>
            <Skeleton className="mb-1 h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="mb-1 h-4 w-36" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="mx-auto mt-4 h-4 w-28" />
      </div>
    </div>
  )
}

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  return (
    <ResetPasswordForm
      token={token}
      onSubmit={async (newPassword, token) => {
        const result = await authClient.resetPassword({ newPassword, token })
        if (result.error) return { error: result.error.message }
        return {}
      }}
    />
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordSkeleton />}>
      <ResetPasswordContent />
    </Suspense>
  )
}
