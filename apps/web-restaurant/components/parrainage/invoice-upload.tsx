"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Upload de la facture de l'apporteur pour une commission donnée.
 * Flux Convex : generateUploadUrl -> POST du fichier -> attachReferralInvoice.
 * La facture est obligatoire avant tout versement (art. 4.2 du contrat).
 */
export function InvoiceUpload({
  referralId,
  uploaded,
}: {
  referralId: Id<"referrals">;
  uploaded: boolean;
}) {
  const generateUploadUrl = useMutation(api.referrals.generateInvoiceUploadUrl);
  const attachInvoice = useMutation(api.referrals.attachReferralInvoice);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(uploaded);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Format PDF attendu.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Fichier trop lourd (10 Mo max).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("upload failed");
      const json = (await res.json()) as { storageId: Id<"_storage"> };
      await attachInvoice({ referralId, storageId: json.storageId });
      setDone(true);
    } catch {
      setError("Échec de l'envoi, réessayez.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success-strong">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Facture reçue
      </span>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={`inv-${referralId}`}
        type="file"
        accept="application/pdf"
        onChange={onFile}
        className="sr-only"
      />
      <label
        htmlFor={`inv-${referralId}`}
        aria-busy={busy}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {busy ? "Envoi…" : "Ajouter ma facture"}
      </label>
      {error && <p className="mt-1 text-xs text-danger-strong">{error}</p>}
    </div>
  );
}
