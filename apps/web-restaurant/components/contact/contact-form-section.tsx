"use client";

import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
} from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { useCalendlyModal } from "@/lib/store";

type FormState = "idle" | "sending" | "sent" | "error";

type FieldName = "name" | "email" | "restaurant" | "message";
type FormErrors = Partial<Record<FieldName, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const socials: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: "Instagram",
    href: "https://instagram.com/beindigital.fr",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="20" height="20" x="2" y="2" rx="5" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@beindigital.fr",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.07 2.49 5.44 5.59 5.44 3.19 0 5.7-2.55 5.7-5.7V8.81a7.35 7.35 0 0 0 4.3 1.38V7.1s-1.88.09-3.24-1.28z" />
      </svg>
    ),
  },
  {
    label: "X",
    href: "https://x.com/beindigital_fr",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/company/beindigital-fr",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
];

const INPUT_CLASS =
  "w-full rounded-xl border border-[color:var(--border)] bg-surface-1 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]";

export function ContactFormSection() {
  const { open: openCalendly } = useCalendlyModal();
  const [formState, setFormState] = useState<FormState>("idle");
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    restaurant: "",
    message: "",
  });

  function validate(data: typeof formData): FormErrors {
    const next: FormErrors = {};
    if (!data.name.trim()) next.name = "Merci d'indiquer votre nom.";
    if (!data.email.trim()) {
      next.email = "Merci d'indiquer votre email.";
    } else if (!EMAIL_RE.test(data.email.trim())) {
      next.email = "Cet email semble invalide.";
    }
    if (!data.message.trim()) next.message = "Merci d'écrire votre message.";
    return next;
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name as FieldName]) return prev;
      const next = { ...prev };
      delete next[name as FieldName];
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validate(formData);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    setErrors({});
    setFormState("sending");
    // Simulate sending, replace with real API call
    setTimeout(() => {
      setFormState("sent");
      setFormData({ name: "", email: "", restaurant: "", message: "" });
    }, 1500);
  }

  return (
    <section className="relative overflow-hidden py-8 sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-section-radial"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 items-stretch gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — Form */}
          <FadeIn direction="left">
            <div className="rounded-2xl border border-[color:var(--border)] bg-surface-1 p-8 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)] sm:p-10">
              <h2 className="mb-2 font-display text-2xl font-semibold text-foreground sm:text-3xl">
                Envoyez-nous un message
              </h2>
              <p className="mb-8 text-sm text-muted-foreground">
                Décrivez-nous votre projet et nous vous répondrons sous 24h.
              </p>

              {formState === "sent" ? (
                <div className="py-12 text-center">
                  <span className="mx-auto mb-4 inline-grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
                    <CheckCircle2 className="h-8 w-8" strokeWidth={1.8} />
                  </span>
                  <h3 className="mb-2 font-display text-xl font-semibold text-foreground">
                    Message envoyé
                  </h3>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Nous vous répondrons dans les meilleurs délais.
                  </p>
                  <button
                    onClick={() => setFormState("idle")}
                    className="cursor-pointer text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Envoyer un autre message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="name"
                        className="mb-2 block text-sm font-medium text-foreground"
                      >
                        Nom complet
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Votre nom"
                        aria-invalid={errors.name ? true : undefined}
                        aria-describedby={errors.name ? "name-error" : undefined}
                        className={INPUT_CLASS}
                      />
                      {errors.name && (
                        <p
                          id="name-error"
                          className="mt-1.5 text-xs text-[color:var(--destructive)]"
                        >
                          {errors.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="mb-2 block text-sm font-medium text-foreground"
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="vous@restaurant.fr"
                        aria-invalid={errors.email ? true : undefined}
                        aria-describedby={
                          errors.email ? "email-error" : undefined
                        }
                        className={INPUT_CLASS}
                      />
                      {errors.email && (
                        <p
                          id="email-error"
                          className="mt-1.5 text-xs text-[color:var(--destructive)]"
                        >
                          {errors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="restaurant"
                      className="mb-2 block text-sm font-medium text-foreground"
                    >
                      Nom du restaurant{" "}
                      <span className="font-normal text-muted-foreground">
                        (optionnel)
                      </span>
                    </label>
                    <input
                      type="text"
                      id="restaurant"
                      name="restaurant"
                      value={formData.restaurant}
                      onChange={handleChange}
                      placeholder="Le nom de votre établissement"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="message"
                      className="mb-2 block text-sm font-medium text-foreground"
                    >
                      Votre message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={5}
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Décrivez votre projet, vos besoins, vos questions..."
                      aria-invalid={errors.message ? true : undefined}
                      aria-describedby={
                        errors.message ? "message-error" : undefined
                      }
                      className={`${INPUT_CLASS} resize-none`}
                    />
                    {errors.message && (
                      <p
                        id="message-error"
                        className="mt-1.5 text-xs text-[color:var(--destructive)]"
                      >
                        {errors.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={formState === "sending"}
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-[var(--glow-primary)] transition-all duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {formState === "sending" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        Envoyer le message
                        <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </FadeIn>

          {/* Right — Calendly + quick info + socials */}
          <FadeIn direction="right" className="flex">
            <div className="flex flex-1 flex-col gap-6">
              {/* Calendly CTA card */}
              <div className="rounded-2xl border border-[color:var(--border-accent)] bg-surface-1 p-8 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)] sm:p-10">
                <span className="mb-5 inline-grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <h3 className="mb-2 font-display text-xl font-semibold text-foreground">
                  Préférez un appel ?
                </h3>
                <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                  Réservez un créneau de 30 minutes avec notre équipe pour
                  discuter de votre projet en détail. Sans engagement.
                </p>
                <button
                  onClick={openCalendly}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--glow-primary)] transition-all duration-200 hover:brightness-105"
                >
                  Réserver un appel
                  <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>

              {/* Quick contact cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--border)] bg-surface-1 p-5 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)]">
                  <span className="mb-3 inline-grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Mail className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </span>
                  <h4 className="mb-1 text-sm font-semibold text-foreground">
                    Email
                  </h4>
                  <a
                    href="mailto:hello@beindigital.fr"
                    className="text-sm text-primary transition-colors hover:text-primary/80"
                  >
                    hello@beindigital.fr
                  </a>
                </div>

                <div className="rounded-2xl border border-[color:var(--border)] bg-surface-1 p-5 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)]">
                  <span className="mb-3 inline-grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Clock className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </span>
                  <h4 className="mb-1 text-sm font-semibold text-foreground">
                    Réponse
                  </h4>
                  <p className="text-sm text-muted-foreground">Sous 24h</p>
                </div>
              </div>

              {/* Social links */}
              <div className="flex flex-1 flex-col justify-end">
                <div className="rounded-2xl border border-[color:var(--border)] bg-surface-1 p-5 shadow-[0_10px_30px_-20px_rgba(112,60,34,0.35)]">
                  <h4 className="mb-4 text-sm font-semibold text-foreground">
                    Suivez-nous
                  </h4>
                  <div className="flex items-center gap-3">
                    {socials.map((social) => (
                      <a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={social.label}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[color:var(--border)] bg-surface-2 text-secondary-foreground transition-all duration-200 hover:border-[color:var(--border-accent)] hover:bg-primary/10 hover:text-primary"
                      >
                        {social.icon}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
