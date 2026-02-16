"use client"

import { useState } from "react"
import Link from "next/link"

interface ResetPasswordFormProps {
  token: string | null
  onSubmit: (newPassword: string, token: string) => Promise<{ error?: string }>
  signInHref?: string
  forgotPasswordHref?: string
}

/**
 * Reset password form component with token validation.
 * Includes password confirmation and matches sign-in page styling.
 */
export function ResetPasswordForm({
  token,
  onSubmit,
  signInHref = "/sign-in",
  forgotPasswordHref = "/forgot-password",
}: ResetPasswordFormProps) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Handle invalid or missing token
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Lien invalide
          </h1>
          <p className="mb-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Ce lien de réinitialisation est invalide ou a expiré.
          </p>
          <div className="flex flex-col items-center gap-2">
            <Link
              href={forgotPasswordHref}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Demander un nouveau lien
            </Link>
            <Link
              href={signInHref}
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
            >
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validate password length
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères")
      return
    }

    // Validate password match
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      return
    }

    setLoading(true)

    try {
      const result = await onSubmit(password, token)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    } catch {
      setError("Une erreur inattendue est survenue")
    } finally {
      setLoading(false)
    }
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Mot de passe réinitialisé
          </h1>
          <div className="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
            Votre mot de passe a été réinitialisé avec succès.
          </div>
          <p className="text-center">
            <Link
              href={signInHref}
              className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Réinitialiser le mot de passe
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Entrez votre nouveau mot de passe ci-dessous.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nouveau mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Min. 6 caractères"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Confirmer le mot de passe
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Confirmez votre mot de passe"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Réinitialisation..." : "Réinitialiser le mot de passe"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href={signInHref}
            className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}
