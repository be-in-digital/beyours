"use client"

import { useParams } from "next/navigation"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Calendar, User, ChevronLeft } from "lucide-react"
import { Badge, Button } from "@beindigital-engine/ui/components"

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA (placeholder — à remplacer par Convex CMS)
// ─────────────────────────────────────────────────────────────────────────────

interface BlogPost {
  title: string
  excerpt: string
  image: string
  category: string
  author: string
  date: string
  sections: { heading?: string; body: string }[]
}

const BLOG_POSTS: Record<string, BlogPost> = {
  "secrets-bonne-livraison": {
    title: "Les secrets d\u2019une bonne livraison",
    excerpt:
      "Découvrez comment nous garantissons une livraison rapide tout en préservant la qualité.",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200&auto=format&fit=crop",
    category: "Coulisses",
    author: "L\u2019équipe",
    date: "12 Mars 2026",
    sections: [
      {
        body: "La livraison est bien plus qu\u2019un simple transport de nourriture. C\u2019est la dernière étape d\u2019une expérience culinaire que nous souhaitons parfaite de bout en bout.",
      },
      {
        heading: "L\u2019emballage, un détail qui change tout",
        body: "Nous utilisons des contenants isothermes qui maintiennent la température optimale de chaque plat. Les plats chauds restent chauds, les salades restent fraîches \u2014 exactement comme au restaurant.",
      },
      {
        heading: "Des livreurs formés",
        body: "Nos partenaires de livraison sont formés pour manipuler les commandes avec soin. Pas de sac retourné, pas de plat écrasé. Chaque commande arrive chez vous dans les meilleures conditions.",
      },
      {
        heading: "Un suivi en temps réel",
        body: "Grâce à notre système de tracking intégré, vous pouvez suivre votre commande à chaque étape, de la cuisine jusqu\u2019à votre porte.",
      },
    ],
  },
  "manger-equilibre-sans-effort": {
    title: "Manger équilibré sans effort",
    excerpt:
      "Nos chefs partagent leurs astuces pour combiner gourmandise et équilibre au quotidien.",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1200&auto=format&fit=crop",
    category: "Nutrition",
    author: "Chef Marie",
    date: "8 Mars 2026",
    sections: [
      {
        body: "Manger équilibré ne signifie pas renoncer au plaisir. Au contraire, c\u2019est apprendre à combiner les bons ingrédients pour nourrir son corps tout en régalant ses papilles.",
      },
      {
        heading: "La règle des couleurs",
        body: "Plus votre assiette est colorée, plus elle est nutritive. Variez les légumes, les protéines et les féculents pour un repas complet et appétissant.",
      },
      {
        heading: "Les protéines végétales",
        body: "Nous proposons de nombreuses options à base de légumineuses, tofu et tempeh pour ceux qui souhaitent réduire leur consommation de viande sans compromettre leurs apports nutritionnels.",
      },
      {
        heading: "Les portions justes",
        body: "Nos plats sont calibrés par nos nutritionnistes pour offrir la juste quantité d\u2019énergie dont vous avez besoin. Ni trop, ni trop peu.",
      },
    ],
  },
  "producteurs-locaux-partenaires": {
    title: "Nos producteurs locaux partenaires",
    excerpt:
      "Rencontrez les artisans et producteurs qui fournissent nos ingrédients frais.",
    image:
      "https://images.unsplash.com/photo-1606787366850-de6330128bfc?q=80&w=1200&auto=format&fit=crop",
    category: "Engagements",
    author: "L\u2019équipe",
    date: "2 Mars 2026",
    sections: [
      {
        body: "Derrière chaque plat, il y a des hommes et des femmes passionnés par leur métier. Nous avons fait le choix de travailler exclusivement avec des producteurs locaux.",
      },
      {
        heading: "Des fermes à moins de 50 km",
        body: "La majorité de nos fruits, légumes et produits laitiers proviennent de fermes situées à moins de 50 kilomètres de nos cuisines. Cela garantit une fraîcheur maximale et réduit notre empreinte carbone.",
      },
      {
        heading: "Des relations de confiance",
        body: "Nous rendons régulièrement visite à nos producteurs pour vérifier les conditions de culture et d\u2019élevage. Cette transparence est au cœur de notre engagement qualité.",
      },
      {
        heading: "Un impact positif",
        body: "En choisissant de commander chez nous, vous soutenez directement l\u2019économie locale et les circuits courts. Un geste simple mais significatif.",
      },
    ],
  },
  "nouvelle-carte-printemps": {
    title: "La nouvelle carte du printemps",
    excerpt:
      "Avec l\u2019arrivée des beaux jours, nous renouvelons notre menu avec des saveurs printanières.",
    image:
      "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?q=80&w=1200&auto=format&fit=crop",
    category: "Menu",
    author: "Chef Thomas",
    date: "25 Février 2026",
    sections: [
      {
        body: "Le printemps est la saison du renouveau, et notre carte n\u2019échappe pas à la règle. Découvrez les nouvelles saveurs qui vous attendent.",
      },
      {
        heading: "Des légumes de saison",
        body: "Asperges, petits pois, radis, fèves\u2026 Les légumes printaniers arrivent en force dans nos recettes pour apporter fraîcheur et couleur à vos repas.",
      },
      {
        heading: "De nouvelles recettes exclusives",
        body: "Notre chef Thomas a concocté 8 nouvelles recettes qui mettent à l\u2019honneur les produits de saison. Du risotto aux asperges au tartare de saumon aux herbes fraîches, il y en a pour tous les goûts.",
      },
    ],
  },
  "emballages-eco-responsables": {
    title: "Nos emballages éco-responsables",
    excerpt:
      "Notre engagement pour réduire notre impact environnemental passe aussi par nos emballages.",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=1200&auto=format&fit=crop",
    category: "Engagements",
    author: "L\u2019équipe",
    date: "18 Février 2026",
    sections: [
      {
        body: "L\u2019emballage alimentaire est un enjeu environnemental majeur. Nous avons pris des mesures concrètes pour réduire notre impact.",
      },
      {
        heading: "100% recyclable",
        body: "Tous nos emballages sont fabriqués à partir de matériaux recyclables ou compostables. Fini le plastique à usage unique.",
      },
      {
        heading: "Des contenants réutilisables",
        body: "Nous proposons également un programme de contenants consignés pour nos clients réguliers. Un petit geste qui fait une grande différence.",
      },
    ],
  },
  "art-du-plating": {
    title: "L\u2019art du dressage",
    excerpt:
      "Comment nos chefs transforment chaque assiette en une œuvre d\u2019art.",
    image:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=1200&auto=format&fit=crop",
    category: "Coulisses",
    author: "Chef Marie",
    date: "10 Février 2026",
    sections: [
      {
        body: "On mange d\u2019abord avec les yeux. C\u2019est pourquoi nos chefs accordent autant d\u2019importance au visuel qu\u2019au goût de chaque plat.",
      },
      {
        heading: "Les règles d\u2019or du dressage",
        body: "Contraste des couleurs, jeu de textures, hauteur et asymétrie \u2014 chaque assiette est composée comme un tableau. Le résultat ? Des plats aussi beaux que bons.",
      },
      {
        heading: "Du restaurant à la livraison",
        body: "Le défi est de conserver cette esthétique même en livraison. Nous avons développé des techniques d\u2019emballage qui préservent la présentation de chaque plat.",
      },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const post = BLOG_POSTS[slug]

  if (!post) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-[#FDFCF6] text-zinc-900 font-sans pt-20 transition-colors duration-500">
      {/* ═══ HERO IMAGE ═══ */}
      <div className="relative h-[60vh] min-h-[400px] w-full overflow-hidden">
        <Image
          src={post.image}
          alt={post.title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16 max-w-5xl mx-auto">
          <div className="flex flex-wrap gap-4 mb-6">
            <Link href="/blog">
              <Button
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white hover:text-black rounded-full backdrop-blur-md"
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Retour au blog
              </Button>
            </Link>
            {post.category && (
              <Badge className="bg-emerald-500 text-white border-none px-4 py-1 font-black uppercase tracking-widest text-[10px]">
                {post.category}
              </Badge>
            )}
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-tight mb-8">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-white/80 font-bold uppercase tracking-widest text-[10px]">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-500" />
              <span>{post.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-500" />
              <span>{post.date}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-16">
        <article className="space-y-8">
          {post.sections.map((section, i) => (
            <div key={i}>
              {section.heading && (
                <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 mb-4">
                  {section.heading}
                </h2>
              )}
              <p className="text-zinc-600 text-lg leading-relaxed">
                {section.body}
              </p>
            </div>
          ))}
        </article>

        {/* Footer */}
        <div className="mt-20 pt-10 border-t border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <User className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Rédigé par
              </p>
              <p className="font-bold text-zinc-900">{post.author}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
