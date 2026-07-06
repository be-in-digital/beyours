"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAffiliateAuth } from "@/lib/affiliate-store";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function InscriptionPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const createAfterSignup = useMutation(api.affiliateUsers.createAfterSignup);
  const generateCode = useMutation(api.referralCodes.generateMyCode);
  const { isSubmitting, setIsSubmitting, error, setError } =
    useAffiliateAuth();
  const router = useRouter();
  const hasCreated = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const signupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (signupTimeout.current) clearTimeout(signupTimeout.current);
    };
  }, []);

  // Après auth réussie → créer le profil affilié + code → contrat
  useEffect(() => {
    if (isAuthenticated && !hasCreated.current) {
      if (signupTimeout.current) clearTimeout(signupTimeout.current);
      hasCreated.current = true;
      (async () => {
        try {
          await createAfterSignup();
          await generateCode();
          router.push("/parrainage/contrat");
        } catch (err) {
          console.error("Post-signup error:", err);
          router.push("/parrainage/contrat");
        }
      })();
    }
  }, [isAuthenticated, createAfterSignup, generateCode, router]);

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

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      setIsSubmitting(false);
      return;
    }

    // Safety net: si l'auth ne complète pas en 15s, débloquer le bouton
    signupTimeout.current = setTimeout(() => {
      setError("L'inscription prend trop de temps. Rechargez la page et réessayez, ou essayez de vous connecter.");
      setIsSubmitting(false);
    }, 15000);

    try {
      await signIn("password", { email, password, flow: "signUp" });
      // signIn résout quand le compte est créé et la session active
      // isAuthenticated passera à true via useConvexAuth, déclenchant le useEffect
    } catch (err) {
      if (signupTimeout.current) clearTimeout(signupTimeout.current);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("already exists")) {
        setError("Cet email est déjà utilisé. Essayez de vous connecter.");
      } else {
        setError("Erreur lors de l'inscription. Veuillez réessayer.");
      }
      setIsSubmitting(false);
    }
  }

  if (isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="animate-pulse text-muted-foreground">
          Configuration de votre compte...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 sm:py-24">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Créer votre compte</h1>
        <p className="text-sm text-muted-foreground">
          Devenez apporteur d&apos;affaires Be in Digital
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
            className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
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
              autoComplete="new-password"
              minLength={8}
              placeholder="8 caractères minimum"
              className="w-full h-11 px-4 pr-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
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
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Inscription en cours..." : "Créer mon compte"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link
          href="/parrainage/connexion"
          className="text-primary hover:text-primary/80 transition-colors"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
