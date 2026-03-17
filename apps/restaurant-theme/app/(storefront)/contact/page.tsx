"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  Send,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  Badge,
  Button,
  Input,
  Textarea,
  Skeleton,
} from "@beindigital-engine/ui/components"
import { useStoreId } from "@/lib/hooks/use-store-id"
import { toast } from "sonner"

// ─────────────────────────────────────────────────────────────────────────────
// TOPICS
// ─────────────────────────────────────────────────────────────────────────────

const TOPICS = ["Commande", "Partenariat", "Réservation", "Autre"]

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function ContactPage() {
  const { storeId } = useStoreId()
  const store = useQuery(
    api.stores.getById,
    storeId ? { id: storeId as Id<"stores"> } : "skip"
  )

  const [form, setForm] = useState({
    name: "",
    email: "",
    topic: "",
    message: "",
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name || !form.email || !form.message) {
      toast.error("Veuillez remplir tous les champs obligatoires.")
      return
    }

    setSending(true)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur")
      }

      setSent(true)
      toast.success("Message envoyé avec succès !")
      setForm({ name: "", email: "", topic: "", message: "" })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de l\u2019envoi."
      )
    } finally {
      setSending(false)
    }
  }

  // Build contact info cards from store data
  const infoCards = []
  if (store?.email) {
    infoCards.push({
      icon: <Mail className="h-6 w-6" />,
      label: "Email",
      value: store.email,
      description: "Réponse sous 24h",
      href: `mailto:${store.email}`,
      color: "text-emerald-600",
    })
  }
  if (store?.phone) {
    infoCards.push({
      icon: <Phone className="h-6 w-6" />,
      label: "Téléphone",
      value: store.phone,
      description: "Du lundi au samedi",
      href: `tel:${store.phone}`,
      color: "text-orange-600",
    })
  }
  if (store?.address) {
    const addr = store.address
    const mapsUrl =
      addr.latitude && addr.longitude
        ? `https://www.google.com/maps/search/?api=1&query=${addr.latitude},${addr.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${addr.street}, ${addr.postalCode} ${addr.city}`
          )}`
    infoCards.push({
      icon: <MapPin className="h-6 w-6" />,
      label: "Adresse",
      value: `${addr.street}`,
      description: `${addr.postalCode} ${addr.city}`,
      href: mapsUrl,
      color: "text-blue-600",
    })
  }

  // Loading
  if (store === undefined) {
    return (
      <div className="min-h-screen bg-[#FDFCF6] pt-20">
        <Skeleton className="h-[400px] w-full" />
        <div className="max-w-7xl mx-auto px-6 py-24 -mt-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Skeleton className="lg:col-span-2 h-[800px] rounded-[4rem]" />
            <div className="space-y-8">
              <Skeleton className="h-32 rounded-[3rem]" />
              <Skeleton className="h-32 rounded-[3rem]" />
              <Skeleton className="h-32 rounded-[3rem]" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FDFCF6] text-zinc-900 font-sans pt-20 transition-colors duration-500">
      {/* ═══ HERO ═══ */}
      <section className="pt-24 pb-32 px-6 md:px-12 bg-zinc-900 relative overflow-hidden rounded-b-[4rem] md:rounded-b-[8rem]">
        <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-orange-500/20 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge className="bg-white/10 text-white border-white/20 backdrop-blur-md px-6 py-2 rounded-full mb-8 font-black tracking-widest uppercase text-[10px]">
              Contact
            </Badge>
            <h1 className="text-6xl md:text-9xl font-black text-white tracking-tighter leading-none mb-12 italic">
              Parlons{" "}
              <span className="text-orange-500 not-italic">ensemble</span>
            </h1>
            <p className="text-xl md:text-2xl text-white/60 max-w-2xl mx-auto font-medium">
              Une question, une remarque ou une demande ? Nous sommes à votre
              écoute.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══ CONTACT GRID ═══ */}
      <section className="pt-44 pb-24 px-6 md:px-12 max-w-7xl mx-auto -mt-20 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Contact Form ── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-2 bg-white rounded-[4rem] p-12 shadow-2xl shadow-black/[0.05] border border-zinc-100"
          >
            <div className="mb-12">
              <Badge className="bg-orange-500/10 text-orange-600 border-orange-200 px-4 py-1.5 rounded-full mb-6 font-black tracking-widest uppercase text-[10px]">
                Formulaire
              </Badge>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-800 leading-[0.9]">
                Envoyez-nous un{" "}
                <span className="text-orange-500 italic">message</span>
              </h2>
            </div>

            {sent ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-20"
              >
                <div className="flex justify-center mb-6">
                  <div className="rounded-full bg-emerald-100 p-4">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  </div>
                </div>
                <h3 className="text-2xl font-black tracking-tighter text-zinc-800 mb-3">
                  Message envoyé !
                </h3>
                <p className="text-zinc-500 font-medium mb-8">
                  Nous vous répondrons dans les plus brefs délais.
                </p>
                <Button
                  onClick={() => setSent(false)}
                  className="rounded-2xl bg-[#0D5C3F] hover:bg-[#0A412D] text-white font-black uppercase tracking-widest text-xs px-8 h-14"
                >
                  Envoyer un autre message
                </Button>
              </motion.div>
            ) : (
              <form className="space-y-8" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                      Nom complet *
                    </label>
                    <Input
                      required
                      placeholder="John Doe"
                      value={form.name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, name: e.target.value }))
                      }
                      className="h-16 rounded-2xl bg-zinc-50 border-zinc-100 focus:bg-white focus:border-emerald-300 transition-all px-6 font-bold text-zinc-800"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                      Adresse email *
                    </label>
                    <Input
                      required
                      type="email"
                      placeholder="john@example.com"
                      value={form.email}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, email: e.target.value }))
                      }
                      className="h-16 rounded-2xl bg-zinc-50 border-zinc-100 focus:bg-white focus:border-emerald-300 transition-all px-6 font-bold text-zinc-800"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                    Sujet
                  </label>
                  <div className="flex flex-wrap gap-4">
                    {TOPICS.map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, topic }))}
                        className={`px-6 py-3 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 ${
                          form.topic === topic
                            ? "border-orange-500 text-orange-500 bg-orange-50"
                            : "border-zinc-100 text-zinc-500 hover:border-orange-500 hover:text-orange-500 bg-white"
                        }`}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                    Votre message *
                  </label>
                  <Textarea
                    required
                    placeholder="Dites-nous tout..."
                    value={form.message}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, message: e.target.value }))
                    }
                    className="min-h-[180px] rounded-3xl bg-zinc-50 border-zinc-100 focus:bg-white focus:border-emerald-300 transition-all p-6 font-bold text-zinc-800"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full h-20 rounded-3xl bg-[#0D5C3F] hover:bg-[#0A412D] text-white font-black uppercase tracking-widest text-sm shadow-xl transition-all group disabled:opacity-60"
                >
                  {sending ? (
                    <>
                      <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      Envoyer le message
                      <Send className="ml-3 h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </motion.div>

          {/* ── Contact Sidebar ── */}
          <div className="lg:col-span-1 space-y-8">
            {infoCards.map((item, i) => (
              <motion.a
                key={i}
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={
                  item.href.startsWith("http")
                    ? "noopener noreferrer"
                    : undefined
                }
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="block p-8 bg-white rounded-[3rem] shadow-xl border border-zinc-100 group hover:border-emerald-200 transition-all"
              >
                <div className="flex items-start gap-6">
                  <div
                    className={`h-14 w-14 rounded-2xl bg-zinc-50 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm ${item.color}`}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">
                      {item.label}
                    </div>
                    <div className="text-xl font-black text-zinc-800 tracking-tight mb-1">
                      {item.value}
                    </div>
                    <div className="text-sm font-bold text-zinc-500">
                      {item.description}
                    </div>
                  </div>
                </div>
              </motion.a>
            ))}

            {/* Fallback si pas d'infos store */}
            {infoCards.length === 0 && store !== null && (
              <div className="p-8 bg-white rounded-[3rem] shadow-xl border border-zinc-100 text-center">
                <MessageSquare className="h-10 w-10 text-zinc-300 mx-auto mb-4" />
                <p className="text-sm font-bold text-zinc-400">
                  Contactez-nous via le formulaire
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Social + Chat CTA row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          {/* Social Box */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-emerald-700 rounded-[3rem] p-10 text-white"
          >
            <h3 className="text-2xl font-black tracking-tighter mb-6 italic">
              Suivez-nous sur les{" "}
              <span className="text-orange-400 not-italic">réseaux</span>
            </h3>
            <div className="flex items-center gap-6">
              {[
                {
                  label: "Instagram",
                  href: "#",
                  icon: (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                    </svg>
                  ),
                },
                {
                  label: "Facebook",
                  href: "#",
                  icon: (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                    </svg>
                  ),
                },
                {
                  label: "TikTok",
                  href: "#",
                  icon: (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                    </svg>
                  ),
                },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white hover:text-emerald-700 transition-all"
                  aria-label={social.label}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </motion.div>

          {/* Chat CTA */}
          <motion.a
            href="https://wa.me/"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-orange-500 rounded-[3rem] p-10 text-white relative overflow-hidden group cursor-pointer block"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
            <MessageSquare className="h-12 w-12 mb-6 opacity-20" />
            <h3 className="text-xl font-black uppercase tracking-widest leading-none mb-2">
              Chat en direct
            </h3>
            <p className="text-white/80 font-bold text-sm mb-6">
              Discutez avec nous sur WhatsApp pour une réponse instantanée
            </p>
            <div className="flex items-center gap-2 font-black uppercase tracking-widest text-[10px] group-hover:gap-4 transition-all">
              Démarrer le chat
              <ArrowRight className="h-4 w-4" />
            </div>
          </motion.a>
        </div>
      </section>
    </div>
  )
}
