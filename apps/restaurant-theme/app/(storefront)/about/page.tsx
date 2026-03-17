"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { Target, Heart, Zap, CheckCircle2, ArrowRight } from "lucide-react"
import { Badge, Button } from "@beindigital-engine/ui/components"

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────────────────────

const HERO = {
  badge: "Notre Histoire",
  title: "Une passion pour la\ngastronomie",
  description:
    "Découvrez notre univers, notre équipe et les valeurs qui guident chaque plat que nous préparons.",
}

const STORY = {
  badge: "Depuis 2020",
  title: "Bien plus qu'un\nrestaurant",
  description:
    "Nous croyons que chaque repas est une expérience. Depuis nos débuts, nous sélectionnons les meilleurs ingrédients locaux pour créer des plats qui racontent une histoire — celle du goût, de la fraîcheur et du partage.",
  features: [
    "Ingrédients frais & locaux",
    "Recettes élaborées par des chefs passionnés",
    "Livraison rapide & emballages éco-responsables",
    "Un service client à votre écoute",
  ],
  image:
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=800&auto=format&fit=crop",
  stats: { value: "10K+", label: "Clients satisfaits" },
}

const VALUES = [
  {
    icon: "Target",
    title: "Qualité",
    description:
      "Chaque ingrédient est sélectionné avec soin auprès de producteurs locaux pour garantir une fraîcheur et un goût incomparables.",
    color: "bg-emerald-100 text-emerald-600",
  },
  {
    icon: "Heart",
    title: "Passion",
    description:
      "Notre équipe de chefs passionnés met tout son cœur dans chaque recette pour vous offrir une expérience culinaire unique.",
    color: "bg-orange-100 text-orange-600",
  },
  {
    icon: "Zap",
    title: "Innovation",
    description:
      "Nous innovons constamment pour améliorer notre service, réduire notre empreinte écologique et surprendre vos papilles.",
    color: "bg-blue-100 text-blue-600",
  },
]

const ICON_MAP: Record<string, React.ReactNode> = {
  Target: <Target className="h-6 w-6" />,
  Heart: <Heart className="h-6 w-6" />,
  Zap: <Zap className="h-6 w-6" />,
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────

function renderTitle(text: string) {
  return text.split(/(\{[\s\S]*?\})/g).map((part, i) => {
    if (part.startsWith("{") && part.endsWith("}")) {
      return (
        <span key={i} className="text-orange-500 not-italic">
          {part.slice(1, -1)}
        </span>
      )
    }
    return part
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FDFCF6] text-zinc-900 font-sans pt-20 transition-colors duration-500">
      {/* ═══ HERO ═══ */}
      <section className="pt-24 pb-32 px-6 md:px-12 bg-[#0D5C3F] relative overflow-hidden rounded-b-[4rem] md:rounded-b-[8rem]">
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-white/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-emerald-400/10 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-md px-6 py-2 rounded-full mb-8 font-black tracking-widest uppercase text-[10px] shadow-lg">
              {HERO.badge}
            </Badge>
            <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-none mb-8 italic whitespace-pre-line">
              {HERO.title.split("\n").map((line, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {i === 1 ? (
                    <span className="text-orange-500 not-italic">{line}</span>
                  ) : (
                    line
                  )}
                </span>
              ))}
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto font-medium">
              {HERO.description}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══ STORY SECTION ═══ */}
      <section className="py-32 px-6 md:px-12 max-w-7xl mx-auto overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <Badge className="bg-orange-500/10 text-orange-600 border-orange-200 px-4 py-1.5 rounded-full mb-6 font-black tracking-widest uppercase text-[10px]">
              {STORY.badge}
            </Badge>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-zinc-800 leading-[0.9] mb-6 whitespace-pre-line">
              {STORY.title.split("\n").map((line, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {i === 1 ? (
                    <span className="text-orange-500 italic">{line}</span>
                  ) : (
                    line
                  )}
                </span>
              ))}
            </h2>
            <div className="h-2 w-24 bg-orange-600 rounded-full mb-8" />
            <p className="text-zinc-500 font-medium leading-relaxed mb-10">
              {STORY.description}
            </p>

            <div className="space-y-6">
              {STORY.features.map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="font-bold text-zinc-700 uppercase tracking-tight text-sm">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="relative aspect-[4/5] rounded-[4rem] overflow-hidden shadow-2xl">
              <Image
                src={STORY.image}
                alt="Notre histoire"
                fill
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-10 -left-10 bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl border border-white max-w-[240px] hidden md:block">
              <div className="text-5xl font-black text-emerald-700 tracking-tighter mb-2">
                {STORY.stats.value}
              </div>
              <div className="text-xs font-black text-zinc-400 uppercase tracking-widest leading-tight">
                {STORY.stats.label}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ VALUES SECTION ═══ */}
      <section className="py-32 bg-white rounded-[5rem] shadow-sm mb-24 mx-6 md:mx-12 overflow-hidden border border-zinc-100/50">
        <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 px-4 py-1.5 rounded-full mb-6 font-black tracking-widest uppercase text-[10px]">
            Nos Valeurs
          </Badge>
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-zinc-800 leading-[0.9] mb-6">
            Ce qui nous{" "}
            <span className="text-orange-500 italic">anime</span>
          </h2>
          <p className="text-zinc-500 font-medium max-w-2xl mx-auto mb-20">
            Trois piliers fondamentaux guident notre travail au quotidien
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {VALUES.map((val, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.2 }}
                className="p-10 rounded-[3rem] bg-zinc-50 border border-zinc-100 hover:border-emerald-200 transition-all hover:shadow-xl group text-left"
              >
                <div
                  className={`h-16 w-16 rounded-2xl flex items-center justify-center mb-8 shadow-sm group-hover:scale-110 transition-transform ${val.color}`}
                >
                  {ICON_MAP[val.icon] || <Zap className="h-6 w-6" />}
                </div>
                <h3 className="text-xl font-black tracking-tighter text-zinc-800 uppercase mb-4">
                  {val.title}
                </h3>
                <p className="text-zinc-500 font-medium leading-relaxed">
                  {val.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA SECTION ═══ */}
      <section className="py-32 px-6 md:px-12 max-w-7xl mx-auto mb-24">
        <div className="relative rounded-[5rem] bg-[#0D5C3F] p-12 md:p-32 overflow-hidden text-center">
          <div className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-10">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-white rounded-full blur-[80px]" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-orange-500 rounded-full blur-[80px]" />
          </div>

          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-5xl md:text-8xl font-black text-white tracking-tighter leading-none mb-10 italic">
              Prêt à{" "}
              <span className="text-orange-500 not-italic">commander ?</span>
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-12">
              <Link href="/menu">
                <Button className="h-20 px-12 rounded-3xl bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest text-sm shadow-2xl transition-all hover:scale-105 cursor-pointer group">
                  Voir le menu
                  <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-2 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
