"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAffiliateAuth } from "@/lib/affiliate-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function ConnexionPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const affiliate = useQuery(
    api.affiliateUsers.me,
    isAuthenticated ? {} : "skip",
  );
  const { isSubmitting, setIsSubmitting, error, setError } =
    useAffiliateAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated && affiliate) {
      if (affiliate.contractStatus === "active") {
        router.push("/parrainage/dashboard");
      } else {
        router.push("/parrainage/contrat");
      }
    }
  }, [isAuthenticated, affiliate, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      setError("Email et mot de passe requis");
      setIsSubmitting(false);
      return;
    }

    try {
      await signIn("password", { email, password, flow: "signIn" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("not found") || message.includes("does not exist")) {
        setError("Aucun compte trouvé avec cet email.");
      } else if (message.includes("password") || message.includes("credentials")) {
        setError("Mot de passe incorrect.");
      } else {
        setError("Email ou mot de passe incorrect.");
      }
      setIsSubmitting(false);
    }
  }

  if (isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="animate-pulse text-muted-foreground">
          Redirection...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 sm:py-24">
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-bold mb-2">Connexion</h1>
        <p className="text-sm text-muted-foreground">
          Accédez à votre espace apporteur d&apos;affaires
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium mb-1.5"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="votre@email.com"
            className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium mb-1.5"
          >
            Mot de passe
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Votre mot de passe"
              className="w-full h-11 px-4 pr-11 rounded-xl bg-surface-1 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-danger-soft border border-danger-border text-danger-strong text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Connexion en cours..." : "Se connecter"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link
          href="/parrainage/inscription"
          className="text-primary hover:text-primary/80 transition-colors"
        >
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
