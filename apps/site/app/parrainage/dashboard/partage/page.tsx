"use client";

import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCodeCustomize } from "@/lib/affiliate-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function PartagePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const referralCode = useQuery(
    api.referralCodes.getMyCode,
    isAuthenticated ? {} : "skip",
  );
  const customizeCode = useMutation(api.referralCodes.customizeMyCode);
  const generateCode = useMutation(api.referralCodes.generateMyCode);
  const { isEditing, setIsEditing, customCode, setCustomCode, error, setError } =
    useCodeCustomize();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const affiliate = useQuery(
    api.affiliateUsers.me,
    isAuthenticated ? {} : "skip",
  );

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

  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://beyours.fr";
  const code = referralCode?.code ?? "";
  const referralLink = code ? `${siteUrl}/checkout?ref=${code}` : "";

  function copyToClipboard(text: string, type: "code" | "link") {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  /* The way back for an affiliate holding no code.
     The signature mints it (convex/contractSignatures.ts), so this is normally
     unreachable — it is here for the affiliates who signed while the mint was
     still being attempted at signup, where it could only throw, and for any
     future mint that does not happen. Until this button the page drew an empty
     code chip and an empty share link, and offered nothing that created one. */
  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      await generateCode();
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Erreur lors de la génération",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleCustomize(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await customizeCode({ code: customCode });
      setIsEditing(false);
      setCustomCode("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la personnalisation",
      );
    } finally {
      setSaving(false);
    }
  }

  function getShareText() {
    return `Découvrez BeYours, la plateforme digitale premium pour restaurants ! Utilisez mon code ${code} pour bénéficier d'une réduction sur la création : ${referralLink}`;
  }

  if (isLoading || !isAuthenticated || referralCode === undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="animate-pulse text-muted-foreground text-center">
          Chargement...
        </div>
      </div>
    );
  }

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

      <h1 className="font-display text-2xl font-bold mb-8">Partager votre code</h1>

      {referralCode ? (
        <>
          {/* Code display */}
          <div className="p-6 rounded-2xl bg-surface-1 border border-border mb-6">
            <h2 className="text-base font-semibold mb-4">Votre code de parrainage</h2>

            <div className="flex items-center gap-3 mb-4">
              <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary/10 border border-primary/20">
                <span className="text-2xl font-mono font-bold text-primary tracking-wider">
                  {code}
                </span>
              </div>
              <button
                onClick={() => copyToClipboard(code, "code")}
                className="h-10 px-4 rounded-lg bg-surface-1 border border-border text-sm hover:bg-surface-3 transition-colors"
              >
                {copied === "code" ? "Copié !" : "Copier"}
              </button>
            </div>

            {/* Customize */}
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Personnaliser mon code
              </button>
            ) : (
              <form onSubmit={handleCustomize} className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Nouveau code (3 à 20 caractères)
                  </label>
                  <input
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                    placeholder="MONCODE"
                    maxLength={20}
                    className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border text-foreground font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>
                {error && (
                  <div className="p-3 rounded-xl bg-danger-soft border border-danger-border text-danger-strong text-sm">
                    {error}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={saving || customCode.length < 3}
                    className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "..." : "Valider"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setError(null);
                      setCustomCode("");
                    }}
                    className="h-9 px-4 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Link */}
          <div className="p-6 rounded-2xl bg-surface-1 border border-border mb-6">
            <h2 className="text-base font-semibold mb-4">Lien de parrainage</h2>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm text-foreground bg-secondary px-4 py-2 rounded-lg truncate">
                {referralLink}
              </code>
              <button
                onClick={() => copyToClipboard(referralLink, "link")}
                className="h-10 px-4 rounded-lg bg-surface-1 border border-border text-sm hover:bg-surface-3 transition-colors flex-shrink-0"
              >
                {copied === "link" ? "Copié !" : "Copier"}
              </button>
            </div>
          </div>

          {/* Share buttons */}
          <div className="p-6 rounded-2xl bg-surface-1 border border-border">
            <h2 className="text-base font-semibold mb-4">Partager</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "WhatsApp",
                  dot: "#25D366",
                  href: `https://wa.me/?text=${encodeURIComponent(getShareText())}`,
                  blank: true,
                },
                {
                  label: "Email",
                  dot: "var(--primary)",
                  href: `mailto:?subject=${encodeURIComponent("Découvrez BeYours")}&body=${encodeURIComponent(getShareText())}`,
                  blank: false,
                },
                {
                  label: "X (Twitter)",
                  dot: "#1c1c1c",
                  href: `https://x.com/intent/tweet?text=${encodeURIComponent(getShareText())}`,
                  blank: true,
                },
                {
                  label: "LinkedIn",
                  dot: "#0077B5",
                  href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`,
                  blank: true,
                },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  {...(s.blank
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="flex items-center justify-center gap-2 h-11 rounded-xl bg-surface-1 border border-border text-foreground text-sm font-medium hover:bg-surface-3 hover:border-border-contrast transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <span
                    aria-hidden
                    className="size-2 rounded-full flex-shrink-0"
                    style={{ background: s.dot }}
                  />
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="p-6 rounded-2xl bg-surface-1 border border-border">
          <h2 className="text-base font-semibold mb-2">
            Votre code de parrainage
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Aucun code n’est encore associé à votre compte.
          </p>
          {generateError && (
            <div className="p-3 rounded-xl bg-danger-soft border border-danger-border text-danger-strong text-sm mb-3">
              {generateError}
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {generating ? "..." : "Générer mon code"}
          </button>
        </div>
      )}
    </div>
  );
}
