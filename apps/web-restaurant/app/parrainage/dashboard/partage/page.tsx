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
  const { isEditing, setIsEditing, customCode, setCustomCode, error, setError } =
    useCodeCustomize();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [saving, setSaving] = useState(false);

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
      : "https://restaurant.beindigital.fr";
  const code = referralCode?.code ?? "";
  const referralLink = code ? `${siteUrl}/checkout?ref=${code}` : "";

  function copyToClipboard(text: string, type: "code" | "link") {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
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
    return `Découvrez Be in Digital, la plateforme digitale premium pour restaurants ! Utilisez mon code ${code} pour bénéficier d'une réduction sur la création : ${referralLink}`;
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

      <h1 className="text-2xl font-bold mb-8">Partager votre code</h1>

      {/* Code display */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] mb-6">
        <h2 className="text-base font-semibold mb-4">Votre code de parrainage</h2>

        <div className="flex items-center gap-3 mb-4">
          <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary/10 border border-primary/20">
            <span className="text-2xl font-mono font-bold text-primary tracking-wider">
              {code}
            </span>
          </div>
          <button
            onClick={() => copyToClipboard(code, "code")}
            className="h-10 px-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm hover:bg-white/[0.08] transition-colors"
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
                className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
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
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] mb-6">
        <h2 className="text-base font-semibold mb-4">Lien de parrainage</h2>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm text-muted-foreground bg-white/[0.04] px-4 py-2 rounded-lg truncate">
            {referralLink}
          </code>
          <button
            onClick={() => copyToClipboard(referralLink, "link")}
            className="h-10 px-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm hover:bg-white/[0.08] transition-colors flex-shrink-0"
          >
            {copied === "link" ? "Copié !" : "Copier"}
          </button>
        </div>
      </div>

      {/* Share buttons */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <h2 className="text-base font-semibold mb-4">Partager</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(getShareText())}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 h-11 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-sm font-medium hover:bg-[#25D366]/20 transition-colors"
          >
            WhatsApp
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent("Découvrez Be in Digital")}&body=${encodeURIComponent(getShareText())}`}
            className="flex items-center justify-center gap-2 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground text-sm font-medium hover:bg-white/[0.08] transition-colors"
          >
            Email
          </a>
          <a
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(getShareText())}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground text-sm font-medium hover:bg-white/[0.08] transition-colors"
          >
            X (Twitter)
          </a>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 h-11 rounded-xl bg-[#0077B5]/10 border border-[#0077B5]/20 text-[#0077B5] text-sm font-medium hover:bg-[#0077B5]/20 transition-colors"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </div>
  );
}
