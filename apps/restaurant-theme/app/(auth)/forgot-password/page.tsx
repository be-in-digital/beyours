"use client"

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Forgot Password</h1>
        <p className="text-muted-foreground">
          Enter your email to receive a password reset link.
        </p>
      </div>
      {/* Form will be implemented with Better Auth */}
      <div className="rounded-lg border p-6 bg-card">
        <p className="text-sm text-muted-foreground text-center">
          Password reset form coming soon.
        </p>
      </div>
    </div>
  )
}
