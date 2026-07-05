"use client";

import { useState } from "react";
import { FadeIn } from "@/components/ui/motion";
import { useCalendlyModal } from "@/lib/store";

type FormState = "idle" | "sending" | "sent" | "error";

export function ContactFormSection() {
  const { open: openCalendly } = useCalendlyModal();
  const [formState, setFormState] = useState<FormState>("idle");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    restaurant: "",
    message: "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormState("sending");
    // Simulate sending — replace with real API call
    setTimeout(() => {
      setFormState("sent");
      setFormData({ name: "", email: "", restaurant: "", message: "" });
    }, 1500);
  }

  return (
    <section className="relative py-8 sm:py-12 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/[0.02] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-stretch">
          {/* Left — Form */}
          <FadeIn direction="left">
            <div className="relative p-8 sm:p-10 rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
              {/* Inner glow */}
              <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-primary/[0.04] rounded-full blur-[60px] pointer-events-none" />

              <div className="relative z-10">
                <h2 className="text-2xl sm:text-3xl font-semibold mb-2">
                  Envoyez-nous un message
                </h2>
                <p className="text-sm text-muted-foreground mb-8">
                  Décrivez-nous votre projet et nous vous répondrons sous 24h.
                </p>

                {formState === "sent" ? (
                  <div className="py-12 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary"
                      >
                        <path d="m9 12 2 2 4-4" />
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
                      Message envoyé !
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Nous vous répondrons dans les meilleurs délais.
                    </p>
                    <button
                      onClick={() => setFormState("idle")}
                      className="text-sm text-primary hover:text-primary/80 transition-colors cursor-pointer"
                    >
                      Envoyer un autre message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label
                          htmlFor="name"
                          className="block text-sm font-medium mb-2"
                        >
                          Nom complet
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          required
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Votre nom"
                          className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="email"
                          className="block text-sm font-medium mb-2"
                        >
                          Email
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="vous@restaurant.fr"
                          className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="restaurant"
                        className="block text-sm font-medium mb-2"
                      >
                        Nom du restaurant{" "}
                        <span className="text-muted-foreground font-normal">
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
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="message"
                        className="block text-sm font-medium mb-2"
                      >
                        Votre message
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={5}
                        value={formData.message}
                        onChange={handleChange}
                        placeholder="Décrivez votre projet, vos besoins, vos questions..."
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all duration-200 resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={formState === "sending"}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-medium text-primary-foreground transition-all duration-200 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-[0_0_20px_rgba(82,207,175,0.15)]"
                    >
                      {formState === "sending" ? (
                        <>
                          <svg
                            className="animate-spin w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="3"
                              className="opacity-25"
                            />
                            <path
                              d="M4 12a8 8 0 018-8"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                            />
                          </svg>
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          Envoyer le message
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </FadeIn>

          {/* Right — Calendly + quick info + socials */}
          <FadeIn direction="right" className="flex">
            <div className="flex flex-col gap-6 flex-1">
              {/* Calendly CTA card */}
              <div className="relative p-8 sm:p-10 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent overflow-hidden">
                <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-primary/[0.06] rounded-full blur-[60px] pointer-events-none" />
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-primary"
                    >
                      <rect width="18" height="18" x="3" y="4" rx="2" />
                      <path d="M16 2v4" />
                      <path d="M8 2v4" />
                      <path d="M3 10h18" />
                      <path d="M8 14h.01" />
                      <path d="M12 14h.01" />
                      <path d="M16 14h.01" />
                      <path d="M8 18h.01" />
                      <path d="M12 18h.01" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">
                    Préférez un appel ?
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    Réservez un créneau de 30 minutes avec notre équipe pour
                    discuter de votre projet en détail. Sans engagement.
                  </p>
                  <button
                    onClick={openCalendly}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all duration-200 hover:brightness-110 cursor-pointer shadow-[0_0_20px_rgba(82,207,175,0.2)]"
                  >
                    Réserver un appel
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 13L13 1M13 1H3M13 1V11" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Quick contact cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-primary/10 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-primary mb-3">
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
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-semibold mb-1">Email</h4>
                  <a
                    href="mailto:hello@beindigital.fr"
                    className="text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    hello@beindigital.fr
                  </a>
                </div>

                <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-primary/10 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-primary mb-3">
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
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-semibold mb-1">Réponse</h4>
                  <p className="text-sm text-muted-foreground">Sous 24h</p>
                </div>
              </div>

              {/* Social links */}
              <div className="flex-1 flex flex-col justify-end">
                <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <h4 className="text-sm font-semibold mb-4">
                    Suivez-nous
                  </h4>
                  <div className="flex items-center gap-3">
                    {[
                      {
                        label: "Instagram",
                        href: "https://instagram.com/beindigital.fr",
                        icon: (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
                    ].map((social) => (
                      <a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={social.label}
                        className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:text-primary hover:border-primary/20 hover:bg-primary/[0.06] transition-all duration-200"
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
