"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

function validateSiret(raw: string): boolean {
  const digits = raw.replace(/\s/g, "");
  if (!/^\d{14}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let n = parseInt(digits[i]);
    if (i % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  restaurantName: string;
  city: string;
  siret?: string;
}

function FieldInput({
  label,
  type = "text",
  value,
  onChange,
  required = true,
  placeholder,
  name,
  autoComplete,
  invalid = false,
  describedBy,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  name?: string;
  autoComplete?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-sm font-medium text-foreground"
      >
        {label}
      </label>
      <input
        type={type}
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className="w-full rounded-xl border border-[color:var(--border)] bg-surface-1 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
      />
    </div>
  );
}

export function CheckoutForm({
  initialData,
  onSubmit,
  buyerType = "business",
}: {
  initialData?: CustomerInfo | null;
  onSubmit: (data: CustomerInfo) => void;
  buyerType?: "business" | "personal";
}) {
  const [form, setForm] = useState<CustomerInfo>(
    initialData ?? {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      restaurantName: "",
      city: "",
      siret: "",
    },
  );

  const [siretError, setSiretError] = useState<string | null>(null);

  const update = (field: keyof CustomerInfo) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSiretError(null);

    const siretRaw = form.siret?.replace(/\s/g, "") ?? "";
    if (buyerType === "business" && siretRaw.length > 0) {
      if (!validateSiret(siretRaw)) {
        setSiretError("Numéro SIRET invalide (14 chiffres attendus)");
        return;
      }
    }

    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldInput
          label="Prénom"
          name="firstName"
          autoComplete="given-name"
          value={form.firstName}
          onChange={update("firstName")}
          placeholder="Jean"
        />
        <FieldInput
          label="Nom"
          name="lastName"
          autoComplete="family-name"
          value={form.lastName}
          onChange={update("lastName")}
          placeholder="Dupont"
        />
      </div>
      <FieldInput
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={update("email")}
        placeholder="jean@restaurant.fr"
      />
      <FieldInput
        label="Téléphone"
        name="phone"
        type="tel"
        autoComplete="tel"
        value={form.phone}
        onChange={update("phone")}
        placeholder="06 12 34 56 78"
      />
      <FieldInput
        label="Nom du restaurant"
        name="restaurantName"
        autoComplete="organization"
        value={form.restaurantName}
        onChange={update("restaurantName")}
        placeholder="Le Bon Goût"
      />
      <FieldInput
        label="Ville"
        name="city"
        autoComplete="address-level2"
        value={form.city}
        onChange={update("city")}
        placeholder="Paris"
      />
      {buyerType === "business" && (
        <div>
          <FieldInput
            label="N° SIRET (optionnel)"
            name="siret"
            value={form.siret ?? ""}
            onChange={(v) => {
              setSiretError(null);
              setForm((prev) => ({ ...prev, siret: v }));
            }}
            required={false}
            placeholder="123 456 789 00012"
            invalid={siretError ? true : false}
            describedBy={siretError ? "siret-error" : undefined}
          />
          {siretError && (
            <p
              id="siret-error"
              className="mt-1.5 text-xs text-[color:var(--destructive)]"
            >
              {siretError}
            </p>
          )}
        </div>
      )}
      <button
        type="submit"
        className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--glow-primary)] transition-all duration-200 hover:brightness-105"
      >
        Continuer
        <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </form>
  );
}
