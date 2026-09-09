"use client";

import { useConvexAuth, useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { validateSiret } from "@/lib/siret";

type ProfileFields = {
  firstName: string;
  lastName: string;
  phone: string;
  siret: string;
  address: string;
  city: string;
  postalCode: string;
};

export default function ContratPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  const affiliate = useQuery(
    api.affiliateUsers.me,
    isAuthenticated ? {} : "skip",
  );
  const activeContract = useQuery(api.contractVersions.getActive);
  const completeProfile = useMutation(api.affiliateUsers.completeProfile);
  const signContract = useAction(api.affiliateSignature.signAffiliateContract);

  const [edits, setEdits] = useState<Partial<ProfileFields>>({});
  const [signatureNameOverride, setSignatureNameOverride] = useState<
    string | null
  >(null);
  const [consented, setConsented] = useState(false);

  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/parrainage/connexion");
    }
  }, [isLoading, isAuthenticated, router]);

  // Redirect once the contract is active (reactive — also fires after signing)
  useEffect(() => {
    if (affiliate?.contractStatus === "active") {
      router.push("/parrainage/dashboard");
    }
  }, [affiliate, router]);

  // Form fields: derived from the loaded profile plus the user's own edits
  // (no syncing effect → no cascade of re-renders).
  const firstName = edits.firstName ?? affiliate?.firstName ?? "";
  const lastName = edits.lastName ?? affiliate?.lastName ?? "";
  const phone = edits.phone ?? affiliate?.phone ?? "";
  const siret = edits.siret ?? affiliate?.siret ?? "";
  const address = edits.address ?? "";
  const city = edits.city ?? "";
  const postalCode = edits.postalCode ?? "";
  const setField =
    (key: keyof ProfileFields) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setEdits((prev) => ({ ...prev, [key]: e.target.value }));

  // Signature name: the account name by default, overridable.
  const signatureName =
    signatureNameOverride ??
    `${affiliate?.firstName ?? ""} ${affiliate?.lastName ?? ""}`.trim();

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    if (!activeContract || !affiliate) return;
    if (!consented) {
      setError("Vous devez accepter les termes du contrat pour signer.");
      return;
    }
    if (signatureName.trim().length < 3) {
      setError("Saisissez votre nom complet pour signer.");
      return;
    }
    const siretDigits = siret.replace(/\s/g, "");
    if (!validateSiret(siretDigits)) {
      setError(
        "Numéro SIRET invalide (14 chiffres). Le programme est réservé aux apporteurs professionnels.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await completeProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        siret: siretDigits,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
      });

      /* The audit trail's IP row, minted server-side and passed through
         opaquely. This page cannot produce one and must not try:
         `/api/signer-ip` reads the address out of a header the platform edge
         wrote — never `x-forwarded-for`, which this browser could set itself —
         signs it together with the name of that header, and the Convex action
         verifies both before printing anything on the certificate. `null` from
         that route is an ordinary answer, not an error to work around.
         Best-effort — a failure here costs the trail one corroborating row,
         not the signature. */
      let signerIpAttestation:
        | { ip: string; issuedAt: number; mac: string; source: string }
        | undefined;
      try {
        const ipRes = await fetch("/api/signer-ip");
        if (ipRes.ok) {
          const ipJson = (await ipRes.json()) as {
            attestation: {
              ip: string;
              issuedAt: number;
              mac: string;
              source: string;
            } | null;
          };
          signerIpAttestation = ipJson.attestation ?? undefined;
        }
      } catch {
        // ignore
      }

      await signContract({
        fullName: signatureName.trim(),
        consented,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        signerIpAttestation,
      });

      // Signing activates the affiliate (contractStatus → "active"):
      // the reactive query triggers the redirect above.
      setSigned(true);
    } catch (err) {
      console.error("Signature error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la signature du contrat.",
      );
      setSaving(false);
    }
  }

  if (isLoading || !isAuthenticated || affiliate === undefined) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="animate-pulse text-muted-foreground text-center">
          Chargement...
        </div>
      </div>
    );
  }

  // Success — signed, waiting for the reactive redirect to the dashboard
  if (signed) {
    return (
      <div
        role="status"
        className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-success-soft flex items-center justify-center mx-auto mb-6">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-success-strong"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">
          Contrat signé
        </h1>
        <p className="text-muted-foreground">
          Votre compte est activé. Redirection vers votre espace…
        </p>
      </div>
    );
  }

  const isBlocked = affiliate?.contractStatus === "blocked_new_version";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-bold mb-2">
          {isBlocked
            ? "Nouvelle version du contrat"
            : "Contrat d'apporteur d'affaires"}
        </h1>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          {isBlocked
            ? "Une nouvelle version du contrat est disponible. Veuillez la signer pour réactiver votre compte."
            : "Pour activer votre compte, remplissez vos informations, lisez le contrat et signez ci-dessous."}
        </p>
      </div>

      {/* Alert for re-signature */}
      {isBlocked && (
        <div className="mb-6 p-4 rounded-xl bg-warning-soft border border-warning-border text-warning-strong text-sm flex items-start gap-3">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="flex-shrink-0 mt-0.5"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="font-medium">Signature requise</p>
            <p className="text-foreground/80 mt-1">
              Votre accès au programme est suspendu jusqu&apos;à la signature de
              la nouvelle version du contrat.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSign}>
        {/* Personal info */}
        <div className="p-6 rounded-2xl bg-surface-1 border border-border mb-6">
          <h2 className="text-base font-semibold mb-4">Vos informations</h2>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium mb-1.5"
                >
                  Prénom *
                </label>
                <input
                  id="firstName"
                  value={firstName}
                  onChange={setField("firstName")}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium mb-1.5"
                >
                  Nom *
                </label>
                <input
                  id="lastName"
                  value={lastName}
                  onChange={setField("lastName")}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="address"
                className="block text-sm font-medium mb-1.5"
              >
                Adresse postale *
              </label>
              <input
                id="address"
                value={address}
                onChange={setField("address")}
                required
                placeholder="Numéro et nom de rue"
                className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="postalCode"
                  className="block text-sm font-medium mb-1.5"
                >
                  Code postal *
                </label>
                <input
                  id="postalCode"
                  value={postalCode}
                  onChange={setField("postalCode")}
                  required
                  placeholder="75001"
                  className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label
                  htmlFor="city"
                  className="block text-sm font-medium mb-1.5"
                >
                  Ville *
                </label>
                <input
                  id="city"
                  value={city}
                  onChange={setField("city")}
                  required
                  placeholder="Paris"
                  className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium mb-1.5"
              >
                Téléphone *
              </label>
              <input
                id="phone"
                value={phone}
                onChange={setField("phone")}
                required
                type="tel"
                placeholder="06 12 34 56 78"
                className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="siret"
                className="block text-sm font-medium mb-1.5"
              >
                N° SIRET *
              </label>
              <input
                id="siret"
                value={siret}
                onChange={setField("siret")}
                required
                inputMode="numeric"
                placeholder="123 456 789 00012"
                className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Programme réservé aux apporteurs professionnels. Pas encore de
                statut ? La micro-entreprise se crée gratuitement en ligne.
              </p>
            </div>
          </div>
        </div>

        {/* Contract content */}
        {activeContract ? (
          <div className="p-6 rounded-2xl bg-surface-1 border border-border mb-6">
            <h2 className="text-base font-semibold mb-4">
              {activeContract.title}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                v{activeContract.version}
              </span>
            </h2>

            {/* Contract summary */}
            <div className="mb-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
              <h3 className="text-sm font-medium text-primary mb-2">
                Points clés du contrat
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">&#x2022;</span>
                  Commission de 500 € par client signé (barème en vigueur),
                  versée après une période de validation de 14 jours
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">&#x2022;</span>
                  Vous agissez en tant qu&apos;intermédiaire indépendant
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">&#x2022;</span>
                  Aucun pouvoir d&apos;encaissement au nom de Be in Digital
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">&#x2022;</span>
                  Attribution via votre lien ou code de parrainage
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">&#x2022;</span>
                  Signature électronique simple, horodatée et journalisée
                </li>
              </ul>
            </div>

            {/* Full contract text */}
            <div className="max-h-96 overflow-y-auto rounded-xl bg-background border border-border p-4">
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/80 leading-relaxed">
                {activeContract.content}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-surface-1 border border-border mb-6 text-center">
            <p className="text-muted-foreground">
              Aucun contrat actif pour le moment. Veuillez contacter
              l&apos;administrateur.
            </p>
          </div>
        )}

        {/* Signature */}
        {activeContract && (
          <div className="p-6 rounded-2xl bg-surface-1 border border-border mb-6">
            <h2 className="text-base font-semibold mb-4">Signature</h2>

            <label className="flex items-start gap-3 cursor-pointer mb-5">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <span className="text-sm text-foreground/85">
                J&apos;ai lu et j&apos;accepte les termes du contrat
                d&apos;apporteur d&apos;affaires ci-dessus.
              </span>
            </label>

            <div>
              <label
                htmlFor="signatureName"
                className="block text-sm font-medium mb-1.5"
              >
                Signez en saisissant votre nom complet
              </label>
              <input
                id="signatureName"
                value={signatureName}
                onChange={(e) => setSignatureNameOverride(e.target.value)}
                placeholder="Prénom Nom"
                autoComplete="name"
                className="w-full h-12 px-4 rounded-xl bg-surface-1 border border-border text-foreground font-display text-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              Signature électronique simple, horodatée et journalisée. Un
              exemplaire signé (PDF) sera disponible dans votre espace.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 p-3 rounded-xl bg-danger-soft border border-danger-border text-danger-strong text-sm"
          >
            {error}
          </div>
        )}

        {/* Submit */}
        {activeContract && (
          <button
            type="submit"
            disabled={
              saving ||
              !firstName ||
              !lastName ||
              !phone ||
              !siret ||
              !address ||
              !city ||
              !postalCode ||
              !consented ||
              signatureName.trim().length < 3
            }
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {saving ? "Signature en cours…" : "Signer le contrat"}
          </button>
        )}
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        En signant, vous acceptez les conditions du programme d&apos;apporteur
        d&apos;affaires Be in Digital. Signature électronique simple (eIDAS
        art. 25), horodatée et journalisée ; votre identité repose sur votre
        compte authentifié.
      </p>
    </div>
  );
}
