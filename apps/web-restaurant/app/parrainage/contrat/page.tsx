"use client";

import { useConvexAuth, useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

export default function ContratPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="animate-pulse text-muted-foreground text-center">
            Chargement...
          </div>
        </div>
      }
    >
      <ContratContent />
    </Suspense>
  );
}

function ContratContent() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReturn = searchParams.get("signature") === "return";

  const affiliate = useQuery(
    api.affiliateUsers.me,
    isAuthenticated ? {} : "skip",
  );
  const activeContract = useQuery(api.contractVersions.getActive);
  const pendingSignature = useQuery(
    api.contractSignatures.getMyPendingSignature,
    isAuthenticated ? {} : "skip",
  );
  const completeProfile = useMutation(api.affiliateUsers.completeProfile);
  const createSignatureRequest = useMutation(
    api.contractSignatures.createSignatureRequest,
  );
  const launchYousign = useAction(api.yousign.createSignatureRequest);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const checkStatus = useAction(api.yousign.checkSignatureStatus);

  const [saving, setSaving] = useState(false);
  const [waitingForSignature, setWaitingForSignature] = useState(false);
  const [checking, setChecking] = useState(false);
  const [currentSignatureId, setCurrentSignatureId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/parrainage/connexion");
    }
  }, [isLoading, isAuthenticated, router]);

  // Redirect if contract already signed
  useEffect(() => {
    if (affiliate?.contractStatus === "active") {
      router.push("/parrainage/dashboard");
    }
  }, [affiliate, router]);

  // Pre-fill form from existing affiliate data
  useEffect(() => {
    if (affiliate) {
      setFirstName(affiliate.firstName ?? "");
      setLastName(affiliate.lastName ?? "");
      setPhone(affiliate.phone ?? "");
    }
  }, [affiliate]);

  // Auto-redirect on signature completion (reactive subscription)
  useEffect(() => {
    if (pendingSignature?.status === "signed" && affiliate?.contractStatus === "active") {
      router.push("/parrainage/dashboard");
    }
  }, [pendingSignature, affiliate, router]);

  async function handleSignContract(e: React.FormEvent) {
    e.preventDefault();
    if (!activeContract || !affiliate) return;

    setSaving(true);
    setError(null);

    try {
      // If there's already a pending signature with a Yousign URL, open in new tab
      if (pendingSignature?.status === "pending" && pendingSignature.yousignSignerUrl) {
        window.open(pendingSignature.yousignSignerUrl, "_blank", "noopener,noreferrer");
        setCurrentSignatureId(pendingSignature._id);
        setWaitingForSignature(true);
        setSaving(false);
        return;
      }

      // 1. Save profile data first
      await completeProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
      });

      // 2. Compute snapshot hash
      const encoder = new TextEncoder();
      const data = encoder.encode(activeContract.content);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const snapshotHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // 3. Create signature request in DB
      const signatureId = await createSignatureRequest({
        contractVersionId: activeContract._id,
        contractSnapshotContent: activeContract.content,
        contractSnapshotHash: snapshotHash,
      });

      // 4. Call Yousign API action to create signature request + get signer URL
      const { url } = await launchYousign({ signatureId });

      // 5. Open Yousign signing page in a new tab
      window.open(url, "_blank", "noopener,noreferrer");

      // 6. Show waiting screen
      setCurrentSignatureId(signatureId);
      setWaitingForSignature(true);
    } catch (err) {
      console.error("Contract signature error:", err);
      setError("Erreur lors de la création de la demande de signature.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckStatus() {
    const sigId = currentSignatureId ?? pendingSignature?._id;
    if (!sigId) return;

    setChecking(true);
    setError(null);
    try {
      const { status } = await checkStatus({
        signatureId: sigId as Parameters<typeof checkStatus>[0]["signatureId"],
      });
      if (status === "signed") {
        // Convex reactive queries will auto-update and redirect
      } else if (status === "declined") {
        setError("La signature a été refusée.");
        setWaitingForSignature(false);
      } else if (status === "expired" || status === "canceled") {
        setError("La demande de signature a expiré ou a été annulée.");
        setWaitingForSignature(false);
      }
    } catch (err) {
      console.error("Check status error:", err);
      setError("Impossible de vérifier le statut. Réessayez dans un instant.");
    } finally {
      setChecking(false);
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

  // Waiting for signature (after opening Yousign in new tab, or return from Yousign)
  const showWaiting = waitingForSignature || (isReturn && pendingSignature?.status === "pending");
  if (showWaiting && pendingSignature?.status === "pending") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-primary animate-pulse"
          >
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-3">
          Signez le contrat dans l&apos;onglet Yousign
        </h1>
        <p className="text-muted-foreground mb-6">
          Un nouvel onglet a été ouvert pour la signature. Une fois terminé,
          cliquez sur le bouton ci-dessous.
        </p>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="h-12 px-8 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {checking ? "Vérification en cours..." : "J'ai signé le contrat"}
          </button>
          {pendingSignature.yousignSignerUrl && (
            <a
              href={pendingSignature.yousignSignerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-12 px-6 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm hover:bg-white/[0.08] transition-colors inline-flex items-center"
            >
              Rouvrir l&apos;onglet de signature
            </a>
          )}
        </div>
      </div>
    );
  }

  const isBlocked = affiliate?.contractStatus === "blocked_new_version";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">
          {isBlocked
            ? "Nouvelle version du contrat"
            : "Contrat d'apporteur d'affaires"}
        </h1>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          {isBlocked
            ? "Une nouvelle version du contrat est disponible. Veuillez la signer pour réactiver votre compte."
            : "Pour activer votre compte, veuillez remplir vos informations et signer le contrat ci-dessous."}
        </p>
      </div>

      {/* Alert for re-signature */}
      {isBlocked && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-start gap-3">
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
            <p className="text-amber-400/80 mt-1">
              Votre accès au programme est suspendu jusqu&apos;à la signature de
              la nouvelle version du contrat.
            </p>
          </div>
        </div>
      )}

      {/* Resume pending signature */}
      {pendingSignature?.status === "pending" &&
        pendingSignature.yousignSignerUrl && (
          <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm flex items-start gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="flex-shrink-0 mt-0.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="font-medium">
                Vous avez une signature en attente
              </p>
              <p className="text-blue-400/80 mt-1">
                Reprenez la signature là où vous l&apos;avez laissée.
              </p>
              <a
                href={pendingSignature.yousignSignerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center mt-2 text-blue-400 hover:text-blue-300 font-medium"
              >
                Reprendre la signature &rarr;
              </a>
            </div>
          </div>
        )}

      <form onSubmit={handleSignContract}>
        {/* Personal info */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] mb-6">
          <h2 className="text-base font-semibold mb-4">
            Vos informations
          </h2>
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
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
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
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
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
                onChange={(e) => setAddress(e.target.value)}
                required
                placeholder="Numéro et nom de rue"
                className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
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
                  onChange={(e) => setPostalCode(e.target.value)}
                  required
                  placeholder="75001"
                  className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
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
                  onChange={(e) => setCity(e.target.value)}
                  required
                  placeholder="Paris"
                  className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
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
                onChange={(e) => setPhone(e.target.value)}
                required
                type="tel"
                placeholder="06 12 34 56 78"
                className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Contract content */}
        {activeContract ? (
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] mb-6">
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
                  Commission de 500 € par client signé, versée sous 14 jours
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
                  Attribution des commissions exclusivement via le lien de
                  parrainage
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">&#x2022;</span>
                  Signature électronique avancée (Yousign, conforme eIDAS)
                </li>
              </ul>
            </div>

            {/* Full contract text */}
            <div className="max-h-96 overflow-y-auto rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-muted-foreground leading-relaxed">
                {activeContract.content}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] mb-6 text-center">
            <p className="text-muted-foreground">
              Aucun contrat actif pour le moment. Veuillez contacter
              l&apos;administrateur.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        {activeContract && (
          <button
            type="submit"
            disabled={saving || !firstName || !lastName || !phone || !address || !city || !postalCode}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving
              ? "Préparation de la signature..."
              : pendingSignature?.status === "pending" && pendingSignature.yousignSignerUrl
                ? "Reprendre la signature"
                : "Signer mon contrat"}
          </button>
        )}
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        En signant ce contrat, vous acceptez les conditions du programme
        d&apos;apporteur d&apos;affaires Be in Digital.
        <br />
        La signature électronique est réalisée via Yousign, conforme au
        règlement européen eIDAS.
      </p>
    </div>
  );
}
