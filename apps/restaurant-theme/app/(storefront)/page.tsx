"use client"

import React, { useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import useEmblaCarousel from "embla-carousel-react"
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Heart,
  Leaf,
  Play,
  Plus,
  Quote,
  ShoppingBag,
  Star,
  Truck,
  Users,
} from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button } from "@beindigital-engine/ui/components"
import { Badge } from "@beindigital-engine/ui/components"
import { Skeleton, Empty, EmptyHeader, EmptyTitle } from "@beindigital-engine/ui/components"
import {
  formatPrice,
  isProductAvailable,
  useCartStore,
} from "@beindigital-engine/restaurant"
import type { ProductDoc, CategoryDoc, CartItem } from "@beindigital-engine/restaurant"
import { useStoreId } from "@/lib/hooks"
import { useStoreStatus } from "@/lib/hooks"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Truck, label: "Livraison rapide & fiable", color: "bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400" },
  { icon: CreditCard, label: "Paiements sécurisés", color: "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" },
  { icon: Leaf, label: "Ingrédients frais & sains", color: "bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" },
  { icon: ShoppingBag, label: "Click & Collect", color: "bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400" },
  { icon: Clock, label: "Horaires flexibles 7j/7", color: "bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400" },
]

const CATEGORY_COLORS = [
  { color: "from-orange-500/20 to-orange-500/5", borderColor: "border-orange-200 dark:border-orange-900/50" },
  { color: "from-emerald-500/20 to-emerald-500/5", borderColor: "border-emerald-200 dark:border-emerald-900/50" },
  { color: "from-blue-500/20 to-blue-500/5", borderColor: "border-blue-200 dark:border-blue-900/50" },
  { color: "from-pink-500/20 to-pink-500/5", borderColor: "border-pink-200 dark:border-pink-900/50" },
  { color: "from-emerald-500/20 to-emerald-500/5", borderColor: "border-emerald-200 dark:border-emerald-900/50" },
  { color: "from-yellow-500/20 to-yellow-500/5", borderColor: "border-yellow-200 dark:border-yellow-900/50" },
]

const STATIC_CATEGORIES = [
  { _id: "1", name: "Burgers", emoji: "🍔", count: "12 articles" },
  { _id: "2", name: "Pizzas", emoji: "🍕", count: "8 articles" },
  { _id: "3", name: "Boissons", emoji: "🍹", count: "15 articles" },
  { _id: "4", name: "Desserts", emoji: "🍰", count: "10 articles" },
  { _id: "5", name: "Salades", emoji: "🥗", count: "6 articles" },
  { _id: "6", name: "Wraps", emoji: "🌯", count: "9 articles" },
]

const TESTIMONIALS = [
  {
    quote: "Enfin une plateforme qui se soucie de la qualité ! J\u2019apprécie les options saines et la rapidité de livraison. Hautement recommandé !",
    author: "Emma L.",
    role: "Cliente vérifiée",
    rating: 5,
    avatar: "emma",
  },
  {
    quote: "Expérience incroyable. La gestion des commandes est parfaite et la nourriture arrive chaude et fraîche à chaque fois.",
    author: "Marc D.",
    role: "Amateur de gastronomie",
    rating: 5,
    avatar: "marc",
  },
  {
    quote: "J\u2019adore la variété des options. C\u2019est si facile de trouver des repas qui ont vraiment bon goût sans passer des heures en cuisine.",
    author: "Sophie R.",
    role: "Passionnée de cuisine",
    rating: 5,
    avatar: "sophie",
  },
]

const BLOG_POSTS = [
  {
    date: "12 Mars",
    title: "Les secrets d\u2019une bonne livraison",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop",
    href: "/menu",
  },
  {
    date: "8 Mars",
    title: "Manger équilibré sans effort",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop",
    href: "/menu",
  },
  {
    date: "2 Mars",
    title: "Nos producteurs locaux partenaires",
    image: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?q=80&w=800&auto=format&fit=crop",
    href: "/menu",
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — parse {orange} accents in titles
// ─────────────────────────────────────────────────────────────────────────────

function renderTitle(text: string) {
  return text.split(/(\{[\s\S]*?\})/g).map((part, i) => {
    if (part.startsWith("{") && part.endsWith("}")) {
      return (
        <span key={i} className="text-orange-500 italic">
          {part.slice(1, -1)}
        </span>
      )
    }
    return part
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// MEAL CAROUSEL (embla-based, replaces shadcn Carousel)
// ─────────────────────────────────────────────────────────────────────────────

interface MealCarouselProps {
  products: ProductDoc[] | undefined
  onAddToCart: (product: ProductDoc) => void
  isOpen: boolean
  prevClassName?: string
  nextClassName?: string
}

function MealCarousel({ products, onAddToCart, isOpen, prevClassName, nextClassName }: MealCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" })
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  if (products === undefined) {
    return (
      <div className="flex gap-4 overflow-hidden -ml-4 pb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4 flex-shrink-0">
            <Skeleton className="aspect-[4/3] w-full rounded-[2.5rem]" />
            <div className="p-6 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyTitle>Aucun produit disponible pour le moment</EmptyTitle>
        </EmptyHeader>
        <Link href="/menu">
          <Button variant="outline" className="rounded-2xl font-black uppercase tracking-widest text-xs">
            Voir le menu complet
          </Button>
        </Link>
      </Empty>
    )
  }

  return (
    <>
      <div ref={emblaRef} className="overflow-hidden -ml-4 pb-8">
        <div className="flex">
          {products.map((product) => {
            const available = isProductAvailable(product)
            const canAdd = available && isOpen && (!product.options || product.options.length === 0)

            return (
              <div key={product._id} className="pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4 flex-shrink-0">
                <Link href={`/product/${product._id}`} className="block h-full">
                  <motion.div
                    whileHover={{ y: -10 }}
                    className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/[0.04] border border-white/10 dark:border-zinc-800 hover:border-emerald-100 dark:hover:border-emerald-900/50 transition-all group flex flex-col h-full cursor-pointer"
                  >
                    {/* Image */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                      {product.images?.[0] ? (
                        <Image
                          src={product.images[0]}
                          alt={product.name}
                          fill
                          className="object-cover group-hover:scale-110 transition-all duration-700"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-6xl">🍽️</div>
                      )}
                      {/* Badge */}
                      <div className="absolute top-4 left-4 flex gap-2">
                        {product.isFeatured && (
                          <Badge className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md text-zinc-800 dark:text-zinc-100 border-none py-1.5 px-3 rounded-lg font-bold uppercase text-[9px] shadow-sm">
                            Tendance
                          </Badge>
                        )}
                      </div>
                      {/* Unavailable overlay */}
                      {!available && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="bg-white/90 rounded-full px-4 py-1.5 text-xs font-bold text-zinc-800">Indisponible</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="text-lg font-black tracking-tighter text-zinc-800 dark:text-zinc-100 leading-tight mb-3 group-hover:text-emerald-700 dark:group-hover:text-emerald-500 transition-colors uppercase">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 rounded-lg text-[10px] font-black">
                          <Star className="h-3 w-3 fill-current" />
                          4.8
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-lg text-[10px] font-black">
                          <Clock className="h-3 w-3" />
                          20-30 min
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-1">Prix</span>
                          <span className="text-xl font-black text-[#0D5C3F] dark:text-emerald-400 leading-none">
                            {formatPrice(product.price)}
                          </span>
                        </div>
                        {canAdd && (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onAddToCart(product)
                            }}
                            className="h-10 w-10 rounded-xl bg-[#0D5C3F] text-white flex items-center justify-center shadow-lg shadow-emerald-900/20 hover:bg-emerald-800 transition-all active:scale-95"
                            aria-label={`Ajouter ${product.name}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </div>
            )
          })}
        </div>
      </div>

      {/* Navigation buttons — positioned below carousel */}
      <div className="flex justify-center md:justify-end gap-4 mt-4">
        <button
          onClick={scrollPrev}
          className={cn(
            "h-12 w-12 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-[#0D5C3F] hover:text-white transition-all bg-white dark:bg-zinc-900 dark:text-zinc-100",
            prevClassName
          )}
          aria-label="Précédent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={scrollNext}
          className={cn(
            "h-12 w-12 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center bg-[#0D5C3F] text-white hover:scale-105 transition-all",
            nextClassName
          )}
          aria-label="Suivant"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTIMONIALS CAROUSEL
// ─────────────────────────────────────────────────────────────────────────────

function TestimonialsCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" })
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  return (
    <>
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {TESTIMONIALS.map((t, index) => (
            <div key={index} className="min-w-full">
              <div className="space-y-8 py-4">
                <div className="relative">
                  <Quote className="h-20 w-20 text-emerald-500/10 absolute -top-10 -left-6 rotate-12" />
                  <p className="text-2xl md:text-3xl font-bold leading-relaxed tracking-tight text-zinc-700 dark:text-zinc-300 italic relative z-10">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
                <div className="flex items-center gap-5 pt-4">
                  <div className="h-16 w-16 rounded-2xl bg-orange-100 dark:bg-orange-950/30 overflow-hidden border-2 border-white dark:border-zinc-800 shadow-lg ring-4 ring-orange-100/30 flex items-center justify-center">
                    <span className="text-xl font-black text-orange-600 dark:text-orange-400">
                      {t.author.split(" ").map(w => w[0]).join("")}
                    </span>
                  </div>
                  <div>
                    <p className="font-black text-xl leading-none mb-1.5 text-zinc-900 dark:text-zinc-100">{t.author}</p>
                    <div className="flex items-center gap-1 text-orange-400">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-current" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prev / Next */}
      <div className="flex items-center gap-4 mt-16">
        <button
          onClick={scrollPrev}
          className="h-14 w-14 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-[#0D5C3F] hover:border-[#0D5C3F] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all bg-white dark:bg-zinc-900 shadow-sm"
          aria-label="Précédent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={scrollNext}
          className="h-14 w-14 rounded-2xl bg-[#0D5C3F] flex items-center justify-center text-white hover:bg-emerald-900 transition-all border-none shadow-xl shadow-emerald-950/20"
          aria-label="Suivant"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADING (reusable, matches base-theme Heading component)
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeading({
  badge,
  title,
  description,
  align = "left",
  viewAll,
  badgeColor = "bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400",
  barColor,
}: {
  badge?: string
  title: string
  description?: string
  align?: "left" | "center"
  viewAll?: { label: string; href: string }
  badgeColor?: string
  barColor?: string
}) {
  const isCenter = align === "center"

  return (
    <div className={cn(
      "flex flex-col md:flex-row items-center md:items-end justify-between mb-16 gap-8",
      isCenter && "flex-col md:flex-col items-center md:items-center text-center"
    )}>
      <div className={cn(
        "flex flex-col",
        isCenter ? "items-center" : "items-center md:items-start text-center md:text-left"
      )}>
        {badge && (
          <Badge className={cn("mb-6 px-4 py-1.5 rounded-lg border-none font-black uppercase text-[10px] tracking-widest", badgeColor)}>
            {badge}
          </Badge>
        )}
        <h2 className={cn(
          "text-4xl md:text-6xl font-black tracking-tighter leading-[1.1] whitespace-pre-line text-zinc-800 dark:text-zinc-100",
          isCenter ? "mb-6" : "mb-4"
        )}>
          {renderTitle(title)}
        </h2>
        {description && (
          <p className={cn(
            "text-zinc-500 dark:text-zinc-400 font-medium max-w-xl",
            isCenter ? "text-lg md:text-xl" : "text-md"
          )}>
            {description}
          </p>
        )}
        {barColor && !isCenter && (
          <div className={cn("h-1.5 w-24 rounded-full mt-4 mx-auto md:mx-0", barColor)} />
        )}
      </div>

      {viewAll && (
        <Link href={viewAll.href}>
          <Button
            variant="ghost"
            className="font-black uppercase tracking-widest text-[10px] items-center gap-2 text-orange-500 hover:bg-orange-50"
          >
            {viewAll.label} <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { storeId } = useStoreId()
  const { isOpen, store } = useStoreStatus(storeId)

  // Featured products (try featured first, fallback to all products)
  const featured = useQuery(
    api.products.getFeatured,
    storeId ? { storeId: storeId as Id<"stores"> } : "skip"
  ) as ProductDoc[] | undefined

  const allProducts = useQuery(
    api.products.list,
    storeId ? { storeId: storeId as Id<"stores"> } : "skip"
  ) as ProductDoc[] | undefined

  // Use featured if available, else first 8 of all products
  const featuredProducts = (featured && featured.length > 0)
    ? featured
    : allProducts
      ? allProducts.filter(p => p.isActive !== false).slice(0, 8)
      : allProducts

  const categories = useQuery(
    api.categories.list,
    storeId ? { storeId: storeId as Id<"stores"> } : "skip"
  ) as CategoryDoc[] | undefined

  const addItem = useCartStore((s: { addItem: (item: CartItem) => void }) => s.addItem)
  const cartStoreId = useCartStore((s: { storeId: string | null }) => s.storeId)

  const handleAddToCart = (product: ProductDoc) => {
    if (!storeId || !isProductAvailable(product) || !isOpen) return
    if (cartStoreId && cartStoreId !== storeId) {
      toast.error("Vous avez des articles d\u2019un autre restaurant dans votre Box.")
      return
    }
    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity: 1,
      options: [],
      imageUrl: product.images?.[0],
    })
    toast.success(`${product.name} ajouté à la Box`)
  }

  const displayCategories = (categories && categories.length > 0)
    ? categories.slice(0, 6).map((cat, idx) => ({
        _id: cat._id,
        name: cat.name,
        emoji: STATIC_CATEGORIES[idx % STATIC_CATEGORIES.length]?.emoji ?? "🍽️",
        count: `${0} articles`,
        slug: cat.slug,
        colorIdx: idx,
      }))
    : STATIC_CATEGORIES.map((cat, idx) => ({ ...cat, slug: undefined, colorIdx: idx }))

  const storeName = store?.name ?? "Notre Restaurant"

  return (
    <div className="min-h-screen bg-[#FDFCF6] dark:bg-zinc-950 text-[#1A1A1A] dark:text-zinc-100 font-sans overflow-x-hidden transition-colors duration-500">

      {/* ═══════════════════════════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-32 px-6 md:px-12 overflow-hidden bg-[#0D5C3F] rounded-b-none md:rounded-b-[6rem]">
        {/* Decorative bg */}
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-white/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-emerald-400/10 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12 relative z-10">
          {/* Left — text */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex-1 text-center md:text-left"
          >
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-md px-4 py-1.5 rounded-full mb-6 font-black tracking-widest uppercase text-[10px] shadow-lg">
              Commandez maintenant
            </Badge>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white leading-[0.9] tracking-tighter mb-8 drop-shadow-2xl whitespace-pre-line">
              {renderTitle(`${storeName}\n{savoureux}`)}
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-10 max-w-lg leading-relaxed font-black drop-shadow-md">
              Livraison, à emporter ou sur place — commandez en quelques clics et régalez-vous.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
              <Button asChild className="h-16 w-full sm:w-auto px-10 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-orange-500/20 group transition-all duration-300">
                <Link href="/menu">
                  Commander maintenant
                  <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>
            {/* Store closed */}
            {!isOpen && store && (
              <p className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 mt-6">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Actuellement fermé
              </p>
            )}
          </motion.div>

          {/* Right — hero image + floating badges */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            className="flex-1 relative w-full mt-24 md:mt-0"
          >
            <div className="relative w-full aspect-square max-w-xl mx-auto">
              <Image
                src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800&auto=format&fit=crop"
                alt="Gourmet Burger"
                fill
                className="object-contain drop-shadow-[0_45px_45px_rgba(0,0,0,0.6)] z-20 scale-125"
                priority
              />

              {/* Floating badge 1 */}
              <motion.div
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-10 -left-10 z-30 bg-white/20 backdrop-blur-md p-4 rounded-3xl border border-white/20 shadow-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500 rounded-full">
                    <Star className="h-4 w-4 text-white fill-current" />
                  </div>
                  <div className="text-white text-left">
                    <p className="text-[10px] font-black uppercase tracking-tighter opacity-70 leading-none mb-1">Top noté</p>
                    <p className="text-sm font-black leading-none tracking-tight">Choix gourmet</p>
                  </div>
                </div>
              </motion.div>

              {/* Floating badge 2 */}
              <motion.div
                animate={{ y: [0, 20, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-1/4 -right-10 z-30 bg-white/20 backdrop-blur-md p-4 rounded-3xl border border-white/20 shadow-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500 rounded-full">
                    <Clock className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-white text-left">
                    <p className="text-[10px] font-black uppercase tracking-tighter opacity-70 leading-none mb-1">Livraison rapide</p>
                    <p className="text-sm font-black leading-none tracking-tight">15-30 min</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FEATURES STRIP
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-12 px-6 md:px-12 max-w-7xl mx-auto -mt-16 relative z-30">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[2.5rem] shadow-xl shadow-black/[0.03] border border-white dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 transition-all hover:scale-105 group h-full flex flex-col items-center text-center"
              >
                <div className={cn(
                  "w-24 h-24 rounded-[1.5rem] flex items-center justify-center mb-6 group-hover:scale-110 transition-all overflow-hidden shrink-0",
                  feature.color
                )}>
                  <Icon className="h-8 w-8" />
                </div>
                <p className="text-sm md:text-md font-black italic tracking-tight text-zinc-800 dark:text-zinc-100 leading-tight">
                  {feature.label}
                </p>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          TRENDING / POPULAR PRODUCTS
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto overflow-hidden">
        <SectionHeading
          title="Découvrez nos plats {tendance}"
          barColor="bg-orange-500"
          viewAll={{ label: "Tout voir", href: "/menu" }}
        />
        <MealCarousel
          products={featuredProducts}
          onAddToCart={handleAddToCart}
          isOpen={isOpen}
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CATEGORIES
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
        <SectionHeading
          align="center"
          badge="Explorez le menu"
          title="Les meilleures catégories"
          description="Découvrez notre large variété culinaire, des burgers juteux aux salades fraîches et saines."
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {displayCategories.map((cat) => {
            const colors = CATEGORY_COLORS[cat.colorIdx % CATEGORY_COLORS.length]!
            return (
              <motion.div
                key={cat._id}
                whileHover={{ y: -10 }}
                className={cn(
                  "relative p-8 rounded-[2.5rem] border bg-gradient-to-br transition-all duration-300 group cursor-pointer flex flex-col items-center justify-center gap-4 text-center h-full",
                  colors.color,
                  colors.borderColor
                )}
                onClick={() => {
                  const href = cat.slug ? `/menu?category=${cat.slug}` : "/menu"
                  window.location.href = href
                }}
              >
                <div className="h-24 w-24 rounded-3xl bg-transparent flex items-center justify-center text-4xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 overflow-hidden shrink-0">
                  {cat.emoji}
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tighter text-zinc-800 dark:text-zinc-100 mb-1">{cat.name}</h3>
                  <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{cat.count}</p>
                </div>
                {/* Hover arrow */}
                <div className="absolute bottom-4 right-4 h-8 w-8 rounded-full bg-white dark:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center shadow-lg translate-y-2 group-hover:translate-y-0">
                  <ChevronRight className="h-4 w-4 text-[#0D5C3F] dark:text-emerald-400" />
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          VEGETARIAN SECTION
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto bg-emerald-50/50 dark:bg-emerald-950/10 rounded-[4rem] overflow-hidden transition-colors duration-500">
        <SectionHeading
          badge="100% Healthy"
          badgeColor="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
          title="Idéal pour les {végétariens}"
          description="Des options végétales délicieuses qui ne font aucun compromis sur le goût."
          viewAll={{ label: "Tout voir", href: "/menu" }}
        />
        <MealCarousel
          products={featuredProducts}
          onAddToCart={handleAddToCart}
          isOpen={isOpen}
          prevClassName="hover:bg-emerald-600 hover:text-white"
          nextClassName="bg-emerald-600 text-white"
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CTA / PROMO BANNER
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-12 md:py-32 px-0 md:px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto bg-[#0A3D2E] rounded-none md:rounded-[6rem] overflow-hidden relative p-12 md:p-16 lg:p-24 shadow-3xl shadow-emerald-950/40">
          {/* Decorative */}
          <div className="absolute top-0 right-0 w-full h-full pointer-events-none">
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-orange-400/10 rounded-full blur-[100px]" />
          </div>

          <div className="relative z-10">
            {/* Title centered */}
            <div className="text-center mb-16 lg:mb-24">
              <Badge className="bg-orange-500 text-white mb-8 px-4 py-1.5 rounded-full border-none font-black uppercase text-[10px] tracking-widest shadow-lg shadow-orange-500/20">
                Offre limitée
              </Badge>
              <h2 className="text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-white leading-[0.9] tracking-tighter italic whitespace-pre-line">
                {renderTitle("La faim n\u2019attend\n{personne.}")}
              </h2>
            </div>

            <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
              {/* Left — text + cta */}
              <div className="flex-1 text-center lg:text-left w-full">
                <p className="text-emerald-50/70 text-lg md:text-xl font-medium mb-12 max-w-xl leading-relaxed mx-auto lg:mx-0">
                  Commandez dès maintenant et profitez de la livraison offerte sur votre première commande.
                </p>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-8 mb-12">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                      <Truck className="h-5 w-5 text-orange-400" />
                    </div>
                    <span className="text-white font-bold text-sm">Livraison gratuite</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                      <Star className="h-5 w-5 text-orange-400" />
                    </div>
                    <span className="text-white font-bold text-sm">4.9/5 Avis</span>
                  </div>
                </div>
                <Link href="/menu">
                  <Button className="h-18 w-full md:w-auto px-12 rounded-2xl bg-white text-[#0D5C3F] hover:bg-zinc-100 font-black uppercase tracking-widest text-sm shadow-2xl transition-all hover:scale-105 group">
                    Découvrir le menu
                    <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-2 transition-transform" />
                  </Button>
                </Link>
              </div>

              {/* Right — video/image */}
              <div className="flex-1 w-full relative mt-16 md:mt-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8 }}
                  className="relative aspect-video lg:aspect-[4/3] rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white/5 group"
                >
                  <Image
                    src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop"
                    alt="Cuisine gourmet"
                    fill
                    className="object-cover group-hover:scale-110 transition-all duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A3D2E]/80 via-transparent to-transparent" />

                  {/* Play button */}
                  <button className="absolute inset-0 m-auto h-24 w-24 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center text-white border border-white/30 hover:bg-white hover:text-[#0D5C3F] transition-all shadow-2xl group/play">
                    <Play className="h-10 w-10 fill-current translate-x-1 group-hover/play:scale-110 transition-transform" />
                    <div className="absolute inset-0 rounded-full bg-white animate-ping opacity-20 group-hover:opacity-0" />
                  </button>

                  {/* Video info bar */}
                  <div className="absolute bottom-8 left-8 right-8 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-black text-sm uppercase tracking-wider mb-1">Découvrez notre histoire</p>
                        <p className="text-emerald-50/60 text-xs font-bold">2:45 min · La qualité avant tout</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
                        <Play className="h-4 w-4 text-white fill-current translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          TESTIMONIALS
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-32 px-6 relative overflow-hidden bg-zinc-50 dark:bg-zinc-950/50 transition-colors duration-500">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-100/30 dark:bg-orange-950/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto">
          <div className="mb-20 lg:mb-32">
            <SectionHeading
              align="center"
              badge="Avis clients"
              title={"Ce que nos clients\n{adorés} en disent."}
            />
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-20">
            {/* Left — image panel */}
            <div className="flex-1 relative w-full mb-12 lg:mb-0">
              <div className="relative z-10 rounded-[3rem] overflow-hidden shadow-2xl border-[12px] border-white">
                <Image
                  src="https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=600&auto=format&fit=crop"
                  alt="Notre restaurant"
                  width={600}
                  height={700}
                  className="object-cover aspect-[4/5] hover:scale-105 transition-transform duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Floating stat — rating */}
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  className="absolute top-12 -left-8 bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-xl border border-zinc-100 dark:border-zinc-800 hidden md:block"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                      <Heart className="h-6 w-6 fill-current" />
                    </div>
                    <div>
                      <p className="font-black text-xl leading-none">4.9/5</p>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1 whitespace-nowrap">Note moyenne</p>
                    </div>
                  </div>
                </motion.div>

                {/* Floating stat — customers */}
                <motion.div
                  initial={{ x: 20, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  className="absolute bottom-12 -right-8 bg-[#0D5C3F] p-6 rounded-3xl shadow-xl border border-emerald-900 hidden md:block"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-black text-xl leading-none text-white">10K+</p>
                      <p className="text-[10px] font-black text-emerald-100/50 uppercase tracking-widest mt-1 whitespace-nowrap">Clients satisfaits</p>
                    </div>
                  </div>
                </motion.div>
              </div>
              {/* Dot pattern decoration */}
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[radial-gradient(#e5e7eb_2px,transparent_2px)] [background-size:20px_20px] opacity-100" />
            </div>

            {/* Right — carousel */}
            <div className="flex-1 w-full max-w-xl">
              <TestimonialsCarousel />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          BLOG SECTION
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto bg-white dark:bg-zinc-900/40 rounded-[5rem] shadow-sm mb-24 border border-zinc-100 dark:border-zinc-800 transition-colors duration-500">
        <div className="flex items-end justify-between mb-16 px-8">
          <div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-zinc-800 dark:text-zinc-100 leading-[0.9] mb-6 whitespace-pre-line">
              {renderTitle("Consultez notre\n{Blog}")}
            </h2>
            <div className="h-2 w-24 bg-emerald-800 rounded-full" />
          </div>
          <Link href="/menu">
            <Button variant="ghost" className="text-emerald-700 font-black uppercase tracking-widest text-[10px] items-center gap-2 hover:bg-emerald-50">
              Tout voir <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 px-8">
          {BLOG_POSTS.map((post, index) => (
            <Link key={index} href={post.href} className="group">
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-lg shadow-black/[0.03] border border-zinc-100 dark:border-zinc-800 hover:shadow-xl transition-all h-full flex flex-col">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-all duration-700"
                  />
                  {/* Date badge */}
                  <div className="absolute top-4 left-4 bg-white dark:bg-zinc-900 px-4 py-2 rounded-2xl shadow-lg border border-zinc-100 dark:border-zinc-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#0D5C3F] dark:text-emerald-400">{post.date}</p>
                  </div>
                </div>
                <div className="p-8 flex-1 flex flex-col">
                  <h3 className="text-xl font-black tracking-tighter text-zinc-800 dark:text-zinc-100 leading-tight group-hover:text-[#0D5C3F] dark:group-hover:text-emerald-400 transition-colors">
                    {post.title}
                  </h3>
                  <div className="mt-auto pt-6 flex items-center text-[10px] font-black uppercase tracking-widest text-orange-500 group-hover:gap-3 gap-2 transition-all">
                    Lire la suite <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}
