"use client";

import { useState } from "react";
import { z } from "zod";

/**
 * ContactForm — formulaire de contact branché sur l'httpAction Convex
 * `POST /api/contact` (cf. convex/http.ts). Le hash IP est calculé
 * server-side avec un salt secret.
 *
 * Validation côté client via Zod (longueurs, format email).
 * Honeypot : champ <input name="company"> caché, si rempli → spam silencieux,
 * la mutation reçoit honeypot=valeur et la marque comme spam sans le dire.
 *
 * Pas de Convex client React ici — on POST en fetch direct au site Convex
 * (NEXT_PUBLIC_CONVEX_SITE_URL/api/contact). Bénéfice : le bundle home/work
 * ne tire plus le client Convex (~37KB).
 */
const ContactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Au moins 2 caractères")
    .max(120, "Trop long"),
  email: z
    .string()
    .trim()
    .email("Format d’email invalide")
    .max(254, "Email trop long"),
  message: z
    .string()
    .trim()
    .min(20, "Au moins 20 caractères")
    .max(5000, "Trop long (5000 max)"),
  company: z.string().max(0).optional(), // honeypot
});

type FormStatus = "idle" | "submitting" | "success" | "error";

type Props = {
  submitLabel?: string;
  successMessage?: string;
};

export function ContactForm({
  submitLabel = "Envoyer le message",
  successMessage = "Message envoyé. Réponse sous 24-48h.",
}: Props = {}) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // On capture la ref du <form> AVANT le await — sinon e.currentTarget
    // devient null après le re-render asynchrone (React event pooling).
    const formEl = e.currentTarget;
    setStatus("submitting");
    setErrors({});

    const form = new FormData(formEl);
    const raw = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      message: String(form.get("message") ?? ""),
      company: String(form.get("company") ?? ""),
    };

    const parsed = ContactSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setStatus("idle");
      return;
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
      if (!baseUrl) {
        throw new Error("NEXT_PUBLIC_CONVEX_SITE_URL manquante");
      }
      const response = await fetch(`${baseUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsed.data.name,
          email: parsed.data.email,
          message: parsed.data.message,
          honeypot: parsed.data.company,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
      } | null;
      if (!response.ok || !result?.ok) {
        throw new Error("submit failed");
      }
      setStatus("success");
      formEl.reset();
    } catch (err) {
      console.error("contact submit failed", err);
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="border-primary/30 bg-surface-1 rounded-2xl border p-8 sm:p-10">
        <p className="font-mono text-primary text-xs tracking-[0.2em] uppercase">
          Message reçu
        </p>
        <h3 className="font-display text-foreground mt-4 text-3xl font-light leading-tight sm:text-4xl">
          On revient vers vous
          <br />
          <span className="text-muted-foreground italic">sous 24 h.</span>
        </h3>
        <p className="text-muted-foreground mt-4 text-base leading-relaxed">
          {successMessage} Si c’est urgent, écrivez directement à{" "}
          <a
            href="mailto:hello@beindigital.fr"
            className="text-primary hover:text-foreground border-primary/30 hover:border-primary border-b transition-colors"
          >
            hello@beindigital.fr
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {/* Honeypot — caché, les humains ne le remplissent pas */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      <Field
        name="name"
        label="Votre nom"
        type="text"
        autoComplete="name"
        required
        error={errors.name}
      />
      <Field
        name="email"
        label="Email professionnel"
        type="email"
        autoComplete="email"
        required
        error={errors.email}
      />
      <Field
        name="message"
        label="Votre projet en quelques lignes"
        as="textarea"
        rows={5}
        required
        error={errors.message}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          data-magnetic
          disabled={status === "submitting"}
          className="bg-primary text-primary-foreground glow-primary hover:glow-strong inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-medium tracking-wide transition-shadow duration-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "submitting" ? "Envoi…" : submitLabel}
        </button>
        {status === "error" ? (
          <p className="text-sm text-red-400">
            L’envoi a échoué. Réessayez ou écrivez-nous directement à{" "}
            <a
              href="mailto:hello@beindigital.fr"
              className="underline underline-offset-4"
            >
              hello@beindigital.fr
            </a>
            .
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Réponse sous 24 h. Aucun engagement.
          </p>
        )}
      </div>
    </form>
  );
}

type FieldProps = {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  rows?: number;
  as?: "input" | "textarea";
  error?: string;
};

function Field({
  name,
  label,
  type = "text",
  autoComplete,
  required,
  rows,
  as = "input",
  error,
}: FieldProps) {
  const inputClass =
    "border-border focus:border-primary/60 bg-surface-1 text-foreground placeholder:text-muted-foreground/60 w-full rounded-lg border px-4 py-3 text-base transition-colors duration-200 focus:outline-none";

  return (
    <label className="flex flex-col gap-2">
      <span className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
        {label}
      </span>
      {as === "textarea" ? (
        <textarea
          name={name}
          rows={rows ?? 4}
          required={required}
          className={`${inputClass} resize-none`}
        />
      ) : (
        <input
          name={name}
          type={type}
          autoComplete={autoComplete}
          required={required}
          className={inputClass}
        />
      )}
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </label>
  );
}
