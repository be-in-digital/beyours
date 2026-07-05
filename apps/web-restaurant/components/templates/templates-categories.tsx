"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";
import { useCalendlyModal } from "@/lib/store";
import { categories, categoryCircles } from "@/lib/templates-data";

function CategoryIcon({ iconPath, categoryId, size = 28 }: { iconPath: string; categoryId: string; size?: number }) {
  const paths = iconPath.split(" M").map((p, i) => (i === 0 ? p : `M${p}`));
  const circles = categoryCircles[categoryId] ?? [];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {circles.map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r={c.r} />
      ))}
    </svg>
  );
}

export function TemplatesCategories() {
  const [activeCategory, setActiveCategory] = useState(categories[0].id);
  const { open: openCalendly } = useCalendlyModal();
  const active = categories.find((c) => c.id === activeCategory)!;

  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section header */}
        <FadeIn>
          <div className="text-center mb-16">
            <SectionBadge text="Categories" />
            <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight">
              Trouvez le template ideal
            </h2>
            <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Chaque categorie propose des designs penses specifiquement pour
              votre type de cuisine et votre clientele.
            </p>
          </div>
        </FadeIn>

        {/* Category tabs */}
        <FadeIn delay={0.15}>
          <div className="flex flex-wrap justify-center gap-3 mb-16">
            {categories.map((cat) => {
              const isActive = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`group relative inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 cursor-pointer ${
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_20px_rgba(82,207,175,0.12)]"
                      : "bg-white/[0.04] text-muted-foreground border border-white/[0.08] hover:bg-white/[0.07] hover:text-foreground hover:border-white/[0.15]"
                  }`}
                >
                  <span className={`transition-colors duration-300 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>
                    <CategoryIcon iconPath={cat.iconPath} categoryId={cat.id} />
                  </span>
                  {cat.label}
                </button>
              );
            })}
          </div>
        </FadeIn>

        {/* Active category content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Category banner */}
            <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-6 sm:p-8 mb-10 overflow-hidden">
              <div
                className="absolute top-0 right-0 w-[300px] h-[200px] rounded-full blur-[100px] pointer-events-none opacity-20"
                style={{ background: active.color }}
              />
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div
                  className="flex items-center justify-center w-14 h-14 rounded-xl border"
                  style={{
                    backgroundColor: `${active.color.replace("0.8", "0.1")}`,
                    borderColor: `${active.color.replace("0.8", "0.2")}`,
                    color: active.color.replace("0.8", "1"),
                  }}
                >
                  <CategoryIcon iconPath={active.iconPath} categoryId={active.id} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{active.label}</h3>
                  <p className="text-muted-foreground mt-1">
                    {active.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Template cards grid */}
            <StaggerContainer stagger={0.08} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {active.templates.map((template) => (
                <StaggerItem key={template.name}>
                  <Link href={`/templates/${template.slug}`} className="block h-full">
                    <div className="group relative h-full rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all duration-300 overflow-hidden">
                      {/* Preview placeholder */}
                      <div className="relative aspect-[16/10] bg-white/[0.02] border-b border-white/[0.06] overflow-hidden">
                        <div className="absolute inset-0 flex flex-col">
                          {/* Fake browser bar */}
                          <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.03]">
                            <div className="w-2 h-2 rounded-full bg-white/10" />
                            <div className="w-2 h-2 rounded-full bg-white/10" />
                            <div className="w-2 h-2 rounded-full bg-white/10" />
                            <div className="ml-3 h-4 w-32 rounded-full bg-white/[0.06]" />
                          </div>
                          {/* Fake content blocks */}
                          <div className="flex-1 p-4 space-y-3">
                            <div className="h-2.5 w-3/4 rounded bg-white/[0.06]" />
                            <div className="h-2.5 w-1/2 rounded bg-white/[0.04]" />
                            <div className="mt-4 h-16 w-full rounded-lg bg-white/[0.03] border border-white/[0.05]" />
                            <div className="flex gap-2 mt-3">
                              <div className="h-8 w-20 rounded-md bg-primary/10 border border-primary/15" />
                              <div className="h-8 w-16 rounded-md bg-white/[0.04] border border-white/[0.06]" />
                            </div>
                          </div>
                        </div>
                        {/* Hover overlay */}
                        <div
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/40 backdrop-blur-[2px]"
                        >
                          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_0_20px_rgba(82,207,175,0.3)]">
                            Voir le template
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 13L13 1M13 1H3M13 1V11" />
                            </svg>
                          </span>
                        </div>
                        {/* Hover glow */}
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                          style={{
                            background: `radial-gradient(circle at 50% 80%, ${active.color.replace("0.8", "0.06")}, transparent 70%)`,
                          }}
                        />
                      </div>

                      {/* Card content */}
                      <div className="p-5 sm:p-6">
                        <h4 className="text-lg font-semibold mb-2">
                          {template.name}
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                          {template.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {template.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex text-xs px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </motion.div>
        </AnimatePresence>

        {/* CTA */}
        <FadeIn delay={0.3}>
          <div className="mt-16 text-center">
            <p className="text-muted-foreground mb-6">
              Envie de voir un template en action ?
            </p>
            <button
              onClick={openCalendly}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-medium text-primary-foreground transition-all duration-200 hover:brightness-110 shadow-[0_0_30px_rgba(82,207,175,0.25),0_0_80px_rgba(82,207,175,0.08)] cursor-pointer"
            >
              Reserver une demo
              <svg
                width="16"
                height="16"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 13L13 1M13 1H3M13 1V11" />
              </svg>
            </button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
