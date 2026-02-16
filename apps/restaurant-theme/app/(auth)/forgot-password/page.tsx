"use client"

import { ForgotPasswordForm } from "@beindigital-engine/admin"
import { authClient } from "@/lib/auth-client"

export default function ForgotPasswordPage() {
  return (
    <ForgotPasswordForm
      onSubmit={async (email) => {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: "/reset-password",
        })
        if (result.error) return { error: result.error.message }
        return {}
      }}
    />
  )
}
