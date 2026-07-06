"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Plus, ShoppingBag, Star, MapPin } from "lucide-react";

type Dish = {
  name: string;
  desc: string;
  price: number;
  img: string;
};

const DISHES: Dish[] = [
  {
    name: "Filet, jus corsé",
    desc: "Pommes grenaille, échalote confite",
    price: 24,
    img: "/photos/plat-gastronomie.webp",
  },
  {
    name: "Burger signature",
    desc: "Bœuf maturé, cheddar affiné, oignons",
    price: 15,
    img: "/photos/burger-premium.webp",
  },
  {
    name: "Table du chef",
    desc: "Le menu dégustation, 4 services",
    price: 39,
    img: "/photos/salle-restaurant2.webp",
  },
];

const eur = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/**
 * Aperçu réel du produit livré : un mini site de commande restaurant,
 * fonctionnel (ajout au panier), à l'image d'un établissement.
 */
export function StorefrontPreview({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const [cart, setCart] = useState<number[]>([1]); // indices ajoutés (démarre avec 1 article)

  const add = (i: number) => setCart((c) => [...c, i]);
  const count = cart.length;
  const total = cart.reduce((sum, i) => sum + DISHES[i].price, 0);

  return (
    <div className={`relative ${className}`}>
      {/* Cadre navigateur — le site livré */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        className="relative overflow-hidden rounded-[1.6rem] border border-[color:var(--border)] bg-surface-1 shadow-[0_40px_90px_-40px_rgba(112,60,34,0.5),0_2px_0_rgba(255,255,255,0.6)_inset]"
      >
        {/* Barre navigateur */}
        <div className="flex items-center gap-2 border-b border-[color:var(--border)] bg-secondary/60 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-surface-4" />
            <span className="h-2.5 w-2.5 rounded-full bg-surface-4" />
            <span className="h-2.5 w-2.5 rounded-full bg-surface-4" />
          </div>
          <div className="mx-auto flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1 text-[10px] font-medium text-muted-foreground">
            <MapPin className="h-3 w-3 text-primary" strokeWidth={2.2} />
            trattoria-nonna.fr
          </div>
        </div>

        {/* En-tête établissement */}
        <div className="relative h-32 w-full overflow-hidden sm:h-36">
          <Image
            src="/photos/plat-gastronomie.webp"
            alt="Ambiance de la Trattoria Nonna"
            fill
            sizes="(max-width: 768px) 100vw, 520px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground shadow-sm">
            0 % de commission
          </span>
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
            <div>
              <p className="font-display text-lg font-semibold leading-none text-white">
                Trattoria Nonna
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/80">
                <Star className="h-3 w-3 fill-primary text-primary" />
                4,9 · Cuisine italienne · Bordeaux
              </p>
            </div>
            <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground">
              Ouvert
            </span>
          </div>
        </div>

        {/* Onglets menu */}
        <div className="flex gap-5 border-b border-[color:var(--border)] px-4 pt-3 text-xs font-medium">
          <span className="relative pb-2.5 text-foreground">
            À la carte
            <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
          </span>
          <span className="pb-2.5 text-muted-foreground">Menus</span>
          <span className="pb-2.5 text-muted-foreground">Boissons</span>
        </div>

        {/* Plats */}
        <div className="divide-y divide-[color:var(--border)]">
          {DISHES.map((dish, i) => (
            <div key={dish.name} className="flex items-center gap-3 px-4 py-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                <Image
                  src={dish.img}
                  alt={dish.name}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {dish.name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {dish.desc}
                </p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums text-primary">
                  {eur(dish.price)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => add(i)}
                aria-label={`Ajouter ${dish.name} au panier`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-200 hover:scale-105 active:scale-95"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>

        {/* Barre panier */}
        <div className="flex items-center justify-between gap-3 border-t border-[color:var(--border)] bg-secondary/50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative grid h-8 w-8 place-items-center rounded-full bg-background">
              <ShoppingBag className="h-4 w-4 text-foreground" strokeWidth={2} />
              <AnimatePresence>
                <motion.span
                  key={count}
                  initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground"
                >
                  {count}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="tabular-nums font-medium text-foreground">
              {eur(total)}
            </span>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
            Commander
          </span>
        </div>
      </motion.div>

    </div>
  );
}
