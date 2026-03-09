"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { useCmsPage } from "@/lib/cms"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const { block } = useCmsPage("forgot-password")
  const form = block("form")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      })
      if (result.error) {
        setError(
          "Impossible d'envoyer le lien de réinitialisation. Veuillez vérifier votre adresse email.",
        )
        toast.error(
          "Impossible d'envoyer le lien. Veuillez vérifier votre adresse email.",
        )
      } else {
        setSubmitted(true)
        toast.success("Lien de réinitialisation envoyé")
      }
    } catch {
      setError("Une erreur inattendue est survenue")
      toast.error("Une erreur inattendue est survenue")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {form.field("heading").text ?? "Mot de passe oublié"}
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {form.field("description").text ??
            "Entrez votre email pour recevoir un lien de réinitialisation."}
        </p>

        {submitted ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              Si un compte existe avec cet email, vous recevrez un lien de
              réinitialisation sous peu.
            </div>
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              <Link
                href="/sign-in"
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
              >
                {form.field("signinLink").text ?? "Retour à la connexion"}
              </Link>
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="jean@exemple.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {loading
                  ? "Envoi en cours..."
                  : (form.field("submitLabel").text ?? "Envoyer le lien")}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
              <Link
                href="/sign-in"
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
              >
                {form.field("signinLink").text ?? "Retour à la connexion"}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
