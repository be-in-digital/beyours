"use client"

import { useState } from "react"

export interface ClaimFormData {
  firstName: string
  lastName: string
  email: string
  phone?: string
  marketingOptIn?: boolean
}

export interface ClaimFormProps {
  prizeName: string
  onSubmit: (data: ClaimFormData) => Promise<void>
  isSubmitting: boolean
  primaryColor?: string
}

/**
 * Form to claim a prize after winning.
 * Collects firstName, email, phone, and marketing opt-out.
 */
export function ClaimForm({
  prizeName,
  onSubmit,
  isSubmitting,
  primaryColor = "#000000",
}: ClaimFormProps) {
  const [firstName, setFirstName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [marketingOptIn, setMarketingOptIn] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!firstName.trim()) newErrors.firstName = "Prénom requis"
    if (!email.trim()) {
      newErrors.email = "Email requis"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Email invalide"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || isSubmitting) return

    await onSubmit({
      firstName: firstName.trim(),
      lastName: "",
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      marketingOptIn,
    })
  }

  const inputClassName = (field: string) =>
    `w-full px-4 py-3 rounded-xl bg-white/10 border text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-colors ${
      errors[field]
        ? "border-red-400 focus:ring-red-400"
        : "border-white/20 focus:ring-white/40"
    }`

  return (
    <div className="w-full max-w-sm mx-auto p-6">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/15 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">{"\uD83C\uDF81"}</div>
          <h2 className="text-xl font-bold text-white mb-1">
            {`R\u00E9cup\u00E9rez votre prix`}
          </h2>
          <p className="text-white/70 text-sm">
            Remplissez vos informations pour recevoir <strong>{prizeName}</strong> par email
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <input
              type="text"
              placeholder="Prénom"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClassName("firstName")}
              disabled={isSubmitting}
            />
            {errors.firstName && (
              <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>
            )}
          </div>

          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClassName("email")}
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className="text-red-400 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <input
              type="tel"
              placeholder="Téléphone (optionnel)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClassName("phone")}
              disabled={isSubmitting}
            />
          </div>

          {/* Marketing opt-out */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!marketingOptIn}
              onChange={(e) => setMarketingOptIn(!e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/30 bg-white/10 accent-white"
              disabled={isSubmitting}
            />
            <span className="text-xs text-white/50 leading-relaxed">
              Je ne souhaite pas recevoir de communications marketing
            </span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 border border-white/20"
            style={{
              backgroundColor: primaryColor,
              boxShadow: `0 0 20px ${primaryColor}40`,
            }}
          >
            {isSubmitting ? "Envoi en cours..." : "Recevoir mon prix par email"}
          </button>
        </form>
      </div>
    </div>
  )
}
