"use client";

import { useConvexAuth, useQuery, useMutation, useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { validateSiret } from "@/lib/siret";

export default function ProfilPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const affiliate = useQuery(
    api.affiliateUsers.me,
    isAuthenticated ? {} : "skip",
  );
  const signedContract = useQuery(
    api.contractSignatures.getSignedContractUrl,
    isAuthenticated ? {} : "skip",
  );
  const completeProfile = useMutation(api.affiliateUsers.completeProfile);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [siret, setSiret] = useState("");
  const createAccountLink = useAction(api.stripeConnect.createAccountLink);
  const checkAccountStatus = useAction(api.stripeConnect.checkAccountStatus);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/parrainage/connexion");
    }
  }, [isLoading, isAuthenticated, router]);

  // Guard: redirect if contract not signed
  useEffect(() => {
    if (
      affiliate &&
      affiliate.contractStatus !== "active"
    ) {
      router.push("/parrainage/contrat");
    }
  }, [affiliate, router]);

  // Auto-check Stripe status on return from onboarding (and sync profile)
  useEffect(() => {
    if (
      affiliate?.stripeConnectStatus === "pending" ||
      affiliate?.stripeConnectAccountId
    ) {
      checkAccountStatus({}).catch(() => {});
    }
  }, [affiliate?.stripeConnectStatus, affiliate?.stripeConnectAccountId]);

  // Pre-fill form when data loads
  useEffect(() => {
    if (affiliate) {
      setFirstName(affiliate.firstName ?? "");
      setLastName(affiliate.lastName ?? "");
      setPhone(affiliate.phone ?? "");
      setSiret(affiliate.siret ?? "");
    }
  }, [affiliate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const siretDigits = siret.replace(/\s/g, "");
    if (!validateSiret(siretDigits)) {
      setError("Numéro SIRET invalide (14 chiffres).");
      setSaving(false);
      return;
    }

    try {
      await completeProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        siret: siretDigits,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push("/parrainage");
  }

  if (isLoading || !isAuthenticated || affiliate === undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="animate-pulse text-muted-foreground text-center">
          Chargement...
        </div>
      </div>
    );
  }

  const stripeStatus = affiliate?.stripeConnectStatus ?? "not_started";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Back link */}
      <Link
        href="/parrainage/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Retour au dashboard
      </Link>

      <h1 className="font-display text-2xl font-bold mb-8">Mon profil</h1>

      {/* Signed contract */}
      {signedContract?.url && (
        <div className="p-6 rounded-2xl bg-surface-1 border border-border mb-6">
          <h2 className="text-base font-semibold mb-1">Mon contrat signé</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {signedContract.signedAt
              ? `Signé le ${new Date(signedContract.signedAt).toLocaleDateString("fr-FR")} — signature électronique simple, horodatée.`
              : "Contrat d'apporteur d'affaires signé électroniquement."}
          </p>
          <a
            href={signedContract.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-secondary border border-border text-sm font-medium hover:bg-surface-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Télécharger le PDF
          </a>
        </div>
      )}

      {/* Personal info form */}
      <div className="p-6 rounded-2xl bg-surface-1 border border-border mb-6">
        <h2 className="text-base font-semibold mb-4">
          Informations personnelles
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium mb-1.5"
              >
                Prénom
              </label>
              <input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>
            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium mb-1.5"
              >
                Nom
              </label>
              <input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              value={affiliate?.email ?? ""}
              disabled
              className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium mb-1.5"
            >
              Téléphone
            </label>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>

          <div>
            <label
              htmlFor="siret"
              className="block text-sm font-medium mb-1.5"
            >
              N° SIRET
            </label>
            <input
              id="siret"
              value={siret}
              onChange={(e) => setSiret(e.target.value)}
              required
              inputMode="numeric"
              placeholder="123 456 789 00012"
              className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Requis pour percevoir vos commissions (programme réservé aux
              professionnels).
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-danger-soft border border-danger-border text-danger-strong text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-success-soft border border-success-border text-success-strong text-sm">
              Profil mis à jour avec succès
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Sauvegarde..." : "Mettre à jour"}
          </button>
        </form>
      </div>

      {/* Stripe Connect section */}
      <div className="p-6 rounded-2xl bg-surface-1 border border-border mb-6">
        <h2 className="text-base font-semibold mb-4">Compte de paiement</h2>

        {stripeError && (
          <div className="mb-4 p-3 rounded-xl bg-danger-soft border border-danger-border text-danger-strong text-sm">
            {stripeError}
          </div>
        )}

        {stripeStatus === "not_started" && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Configurez votre compte de paiement pour recevoir vos commissions
              automatiquement par virement.
            </p>
            <button
              onClick={async () => {
                setStripeLoading(true);
                setStripeError(null);
                try {
                  const result = await createAccountLink({
                    returnUrl: `${window.location.origin}/parrainage/dashboard/profil`,
                    refreshUrl: `${window.location.origin}/parrainage/dashboard/profil`,
                  });
                  if (result.testMode) {
                    window.location.reload();
                  } else if (result.url) {
                    window.location.href = result.url;
                  }
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err);
                  if (msg.includes("STRIPE_CONNECT_NOT_ENABLED")) {
                    setStripeError(
                      "Le système de paiement est en cours de configuration par l'administrateur. Vous pourrez configurer votre compte de paiement très prochainement."
                    );
                  } else {
                    setStripeError("Erreur lors de la configuration Stripe");
                  }
                } finally {
                  setStripeLoading(false);
                }
              }}
              disabled={stripeLoading}
              className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {stripeLoading ? "Configuration..." : "Configurer mon compte de paiement"}
            </button>
          </div>
        )}

        {stripeStatus === "pending" && (
          <div>
            <div className="flex items-center gap-2 text-warning-strong text-sm mb-4">
              <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
              Vérification en cours par Stripe
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setStripeLoading(true);
                  setStripeError(null);
                  try {
                    const result = await createAccountLink({
                      returnUrl: `${window.location.origin}/parrainage/dashboard/profil`,
                      refreshUrl: `${window.location.origin}/parrainage/dashboard/profil`,
                    });
                    if (result.url) {
                      window.location.href = result.url;
                    }
                  } catch {
                    setStripeError("Erreur lors de la configuration Stripe");
                  } finally {
                    setStripeLoading(false);
                  }
                }}
                disabled={stripeLoading}
                className="h-9 px-4 rounded-lg bg-surface-1 border border-border text-sm hover:bg-surface-3 disabled:opacity-50 transition-colors"
              >
                Reprendre la configuration
              </button>
              <button
                onClick={async () => {
                  setStripeLoading(true);
                  try {
                    await checkAccountStatus({});
                    window.location.reload();
                  } catch {
                    setStripeError("Erreur lors de la vérification");
                  } finally {
                    setStripeLoading(false);
                  }
                }}
                disabled={stripeLoading}
                className="h-9 px-4 rounded-lg bg-surface-1 border border-border text-sm hover:bg-surface-3 disabled:opacity-50 transition-colors"
              >
                Vérifier le statut
              </button>
            </div>
          </div>
        )}

        {stripeStatus === "active" && (
          <div className="flex items-center gap-2 text-success-strong text-sm">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Compte de paiement actif — vos commissions seront versées automatiquement
          </div>
        )}

        {stripeStatus === "disabled" && (
          <div className="text-danger-strong text-sm">
            Compte de paiement désactivé. Contactez le support.
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="p-6 rounded-2xl bg-surface-1 border border-border">
        <h2 className="text-base font-semibold mb-4">Session</h2>
        <button
          onClick={handleSignOut}
          className="h-10 px-6 rounded-xl bg-danger-soft border border-danger-border text-danger-strong text-sm font-medium hover:bg-danger/15 transition-colors"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
