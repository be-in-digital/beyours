"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

/**
 * Connexion back-office (Convex Auth, provider Password).
 *
 * Un compte créé (sign-up) sans rôle n'a AUCUN accès : l'activation se fait par
 * un owner via `users.grantAccess`. UI volontairement minimale — les écrans
 * designés (DESIGN.md, dark/mint) viendront avec les vrais modules.
 */
export default function SignInPage() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("flow", flow);
    try {
      await signIn("password", formData);
      window.location.href = "/back-office";
    } catch {
      setError(
        flow === "signIn"
          ? "Identifiants invalides."
          : "Impossible de créer le compte (email déjà utilisé ?).",
      );
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white/5 p-8">
        <h1 className="text-lg font-medium">Back-office</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {flow === "signIn"
            ? "Connexion à l'espace agence."
            : "Créer un compte (accès activé ensuite par un owner)."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm text-muted-foreground">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                flow === "signIn" ? "current-password" : "new-password"
              }
              required
              minLength={8}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending
              ? "…"
              : flow === "signIn"
                ? "Se connecter"
                : "Créer le compte"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setFlow(flow === "signIn" ? "signUp" : "signIn");
            setError(null);
          }}
          className="mt-4 text-xs text-muted-foreground underline underline-offset-4"
        >
          {flow === "signIn"
            ? "Pas encore de compte ? En créer un"
            : "Déjà un compte ? Se connecter"}
        </button>
      </div>
    </main>
  );
}
