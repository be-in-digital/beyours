"use client";

import { useState } from "react";

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
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary/40 focus:bg-white/[0.06]"
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
          value={form.firstName}
          onChange={update("firstName")}
          placeholder="Jean"
        />
        <FieldInput
          label="Nom"
          value={form.lastName}
          onChange={update("lastName")}
          placeholder="Dupont"
        />
      </div>
      <FieldInput
        label="Email"
        type="email"
        value={form.email}
        onChange={update("email")}
        placeholder="jean@restaurant.fr"
      />
      <FieldInput
        label="Téléphone"
        type="tel"
        value={form.phone}
        onChange={update("phone")}
        placeholder="06 12 34 56 78"
      />
      <FieldInput
        label="Nom du restaurant"
        value={form.restaurantName}
        onChange={update("restaurantName")}
        placeholder="Le Bon Goût"
      />
      <FieldInput
        label="Ville"
        value={form.city}
        onChange={update("city")}
        placeholder="Paris"
      />
      {buyerType === "business" && (
        <div>
          <FieldInput
            label="N° SIRET (optionnel)"
            value={form.siret ?? ""}
            onChange={(v) => {
              setSiretError(null);
              setForm((prev) => ({ ...prev, siret: v }));
            }}
            required={false}
            placeholder="123 456 789 00012"
          />
          {siretError && (
            <p className="text-xs text-red-400 mt-1">{siretError}</p>
          )}
        </div>
      )}
      <button
        type="submit"
        className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 cursor-pointer mt-2"
      >
        Continuer
      </button>
    </form>
  );
}
