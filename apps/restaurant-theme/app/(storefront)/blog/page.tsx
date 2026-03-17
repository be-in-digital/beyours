"use client"

import Image from "next/image"
import Link from "next/link"
import { Calendar, ArrowRight, User } from "lucide-react"
import { Badge } from "@beindigital-engine/ui/components"

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA (placeholder — à remplacer par Convex CMS)
// ─────────────────────────────────────────────────────────────────────────────

const BLOG_POSTS = [
  {
    slug: "secrets-bonne-livraison",
    title: "Les secrets d\u2019une bonne livraison",
    excerpt:
      "Découvrez comment nous garantissons une livraison rapide tout en préservant la qualité et la fraîcheur de vos plats.",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop",
    category: "Coulisses",
    author: "L\u2019équipe",
    date: "12 Mars 2026",
  },
  {
    slug: "manger-equilibre-sans-effort",
    title: "Manger équilibré sans effort",
    excerpt:
      "Nos chefs partagent leurs astuces pour combiner gourmandise et équilibre au quotidien, sans sacrifier le plaisir.",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop",
    category: "Nutrition",
    author: "Chef Marie",
    date: "8 Mars 2026",
  },
  {
    slug: "producteurs-locaux-partenaires",
    title: "Nos producteurs locaux partenaires",
    excerpt:
      "Rencontrez les artisans et producteurs qui fournissent les ingrédients frais utilisés dans chacune de nos recettes.",
    image:
      "https://images.unsplash.com/photo-1606787366850-de6330128bfc?q=80&w=800&auto=format&fit=crop",
    category: "Engagements",
    author: "L\u2019équipe",
    date: "2 Mars 2026",
  },
  {
    slug: "nouvelle-carte-printemps",
    title: "La nouvelle carte du printemps",
    excerpt:
      "Avec l\u2019arrivée des beaux jours, nous renouvelons notre menu avec des saveurs printanières et des produits de saison.",
    image:
      "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?q=80&w=800&auto=format&fit=crop",
    category: "Menu",
    author: "Chef Thomas",
    date: "25 Février 2026",
  },
  {
    slug: "emballages-eco-responsables",
    title: "Nos emballages éco-responsables",
    excerpt:
      "Notre engagement pour réduire notre impact environnemental passe aussi par le choix de nos emballages.",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800&auto=format&fit=crop",
    category: "Engagements",
    author: "L\u2019équipe",
    date: "18 Février 2026",
  },
  {
    slug: "art-du-plating",
    title: "L\u2019art du dressage",
    excerpt:
      "Comment nos chefs transforment chaque assiette en une véritable œuvre d\u2019art visuelle et gustative.",
    image:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=800&auto=format&fit=crop",
    category: "Coulisses",
    author: "Chef Marie",
    date: "10 Février 2026",
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen bg-[#FDFCF6] text-zinc-900 font-sans pt-20 transition-colors duration-500">
      {/* ═══ HERO ═══ */}
      <section className="pt-24 pb-20 px-6 md:px-12 bg-[#0D5C3F] relative overflow-hidden rounded-b-[4rem] md:rounded-b-[8rem]">
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-white/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-emerald-400/10 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-md px-4 py-1.5 rounded-full mb-8 font-black tracking-widest uppercase text-[10px] shadow-lg">
            Actualités & Conseils
          </Badge>
          <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-none mb-8 italic">
            Notre{" "}
            <span className="text-orange-500 not-italic">Blog</span>
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto font-medium">
            Découvrez nos derniers articles, conseils nutritionnels et coulisses du restaurant.
          </p>
        </div>
      </section>

      {/* ═══ GRID ═══ */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {BLOG_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col h-full bg-white rounded-[2.5rem] overflow-hidden border border-zinc-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500"
            >
              <div className="relative h-64 w-full overflow-hidden">
                <Image
                  src={post.image}
                  alt={post.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                />
                {post.category && (
                  <Badge className="absolute top-6 left-6 bg-white/90 backdrop-blur-md text-zinc-800 border-none font-black uppercase tracking-widest text-[9px] px-3">
                    {post.category}
                  </Badge>
                )}
              </div>

              <div className="p-8 flex flex-col flex-1">
                <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-6">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-orange-500" />
                    <span>{post.author}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-orange-500" />
                    <span>{post.date}</span>
                  </div>
                </div>

                <h3 className="text-xl font-black text-zinc-900 tracking-tighter leading-tight mb-4 group-hover:text-[#0D5C3F] transition-colors">
                  {post.title}
                </h3>

                <p className="text-zinc-500 text-sm font-medium line-clamp-3 mb-8 flex-1">
                  {post.excerpt}
                </p>

                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-600">
                  Lire l&apos;article{" "}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
