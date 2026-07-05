"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWhitelistModal } from "@/lib/store";

const planLabels = {
  essentielle: "Essentielle — Site web restaurant",
  premium: "Premium — Site web + application mobile",
} as const;

export function WhitelistModal() {
  const { isOpen, selectedPlan, close } = useWhitelistModal();
  const joinWhitelist = useMutation(api.whitelist.join);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    restaurantName: "",
    city: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const resetForm = useCallback(() => {
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      restaurantName: "",
      city: "",
      message: "",
    });
    setStatus("idle");
    setErrorMsg("");
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, close]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      await joinWhitelist({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        restaurantName: form.restaurantName.trim(),
        city: form.city.trim(),
        plan: selectedPlan,
        message: form.message.trim() || undefined,
      });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue. Veuillez réessayer."
      );
    }
  }

  function handleClose() {
    close();
    // Reset after transition
    setTimeout(resetForm, 300);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#13131a] shadow-[0_0_80px_rgba(82,207,175,0.08)]">
        {/* Top neon line */}
        <div
          className="absolute top-0 left-8 right-8 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(82,207,175,0.4), transparent)",
          }}
        />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="Fermer"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 sm:p-8">
          {status === "success" ? (
            /* ── Success state ── */
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-3">
                Inscription confirmée
              </h3>
              <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
                Vous êtes inscrit à la waitlist Be in Digital.
                Nous vous recontacterons très prochainement.
              </p>
              <button
                onClick={handleClose}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all"
              >
                Fermer
              </button>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div className="mb-6">
                <h3 className="text-xl sm:text-2xl font-semibold text-foreground">
                  S&apos;inscrire à la waitlist
                </h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Remplissez le formulaire pour rejoindre notre liste d&apos;attente
                  et être parmi les premiers à bénéficier de la plateforme.
                </p>
              </div>

              {/* Selected plan indicator */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/[0.06] border border-primary/15 mb-6">
                <div className="w-2 h-2 rounded-full bg-primary/60" />
                <span className="text-sm text-primary/80 font-medium">
                  {planLabels[selectedPlan]}
                </span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldInput
                    label="Prénom"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                    placeholder="Jean"
                  />
                  <FieldInput
                    label="Nom"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    required
                    placeholder="Dupont"
                  />
                </div>

                <FieldInput
                  label="Email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="jean@restaurant.fr"
                />

                <FieldInput
                  label="Téléphone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  placeholder="06 12 34 56 78"
                />

                <FieldInput
                  label="Nom du restaurant"
                  name="restaurantName"
                  value={form.restaurantName}
                  onChange={handleChange}
                  required
                  placeholder="Le Petit Bistrot"
                />

                <FieldInput
                  label="Ville"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  required
                  placeholder="Paris"
                />

                {/* Message */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">
                    Message <span className="text-muted-foreground/50">(optionnel)</span>
                  </label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Parlez-nous de votre projet..."
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all resize-none"
                  />
                </div>

                {/* Error message */}
                {status === "error" && errorMsg && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-red-400 shrink-0"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                    <span className="text-sm text-red-400">{errorMsg}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all duration-200 shadow-[0_0_20px_rgba(82,207,175,0.2)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {status === "loading" ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
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
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          fill="currentColor"
                          className="opacity-75"
                        />
                      </svg>
                      Inscription en cours...
                    </>
                  ) : (
                    <>
                      S&apos;inscrire à la waitlist
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
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Reusable field input ── */

function FieldInput({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-muted-foreground mb-1.5">
        {label}
        {required && <span className="text-primary/60 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all"
      />
    </div>
  );
}
