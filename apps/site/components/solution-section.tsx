import Image from "next/image";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { UtensilsCrossed, LayoutDashboard, Check, TrendingUp, Sparkles, Mail } from "lucide-react";

export function SolutionSection() {
  return (
    <section id="solution" className="relative py-20 sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-section-radial"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <p className="text-sm font-semibold text-primary-ink">La plateforme</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-balance sm:text-4xl lg:text-[2.75rem]">
            Tout votre restaurant, réuni en ligne.
          </h2>
          {/* Bridge from « Le constat », which shows the platforms taking 30 %.
              The offer is not to leave them but to stop depending on them, so
              the certification and the commission grievance stop reading as a
              contradiction two sections apart. */}
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Rien ne vous oblige à quitter les plateformes, il s&apos;agit de ne
            plus en dépendre : un canal direct sans commission, et leurs
            commandes réunies aux vôtres. Le site, le menu, les intégrations et
            la fidélité, au même endroit.
          </p>
        </FadeIn>

        <StaggerContainer
          className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
          stagger={0.08}
        >
          {/* A — Site & commande (hero) */}
          <StaggerItem className="bento-card bento-card--hero flex flex-col p-6 md:col-span-2 lg:row-span-2 lg:p-7">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary-ink">
              Vitrine & vente directe
            </span>
            <h3 className="mt-2 font-display text-xl font-semibold text-foreground">
              Un site à votre image, qui prend les commandes
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Élégant, rapide, mobile-first. Vos clients commandent en direct,
              sans commission ni intermédiaire.
            </p>
            <div className="relative mt-6 flex-1 overflow-hidden rounded-2xl border border-[color:var(--border)]">
              <div className="relative h-52 w-full lg:h-full lg:min-h-[240px]">
                <Image
                  src="/photos/plat-gastronomie.webp"
                  alt="Plat dressé sur le site du restaurant"
                  fill
                  sizes="(max-width: 1024px) 100vw, 520px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground">
                  0 % de commission
                </span>
                <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl bg-white/90 px-3 py-2 backdrop-blur-sm">
                  <span className="text-xs font-semibold text-[#221c15]">
                    Filet, jus corsé · 24,00 €
                  </span>
                  <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-semibold text-primary-foreground">
                    Ajouter
                  </span>
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* B — Centralisation */}
          <StaggerItem className="bento-card flex flex-col p-6 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary-ink">
              Opérations
            </span>
            <h3 className="mt-2 font-display text-lg font-semibold text-foreground">
              Toutes vos commandes, un seul flux
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Site, click &amp; collect, sur place et Deliveroo : tout arrive
              au même endroit, en temps réel. Deliveroo a certifié notre
              application. Il ne manque qu&apos;Uber Eats, dont la validation
              est en attente : l&apos;unification est à 70 %.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {[
                { name: "Votre site", logo: null, soon: false, tag: null },
                { name: "Sur place", logo: null, soon: false, tag: null },
                {
                  name: "Deliveroo",
                  logo: "/logos/deliveroo.png",
                  soon: false,
                  tag: "Certifié",
                },
                {
                  name: "Uber Eats",
                  logo: "/logos/uber-eats.png",
                  soon: true,
                  tag: "En attente",
                },
              ].map((s) => (
                <span
                  key={s.name}
                  className={`inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-background px-3 py-1.5 text-xs font-medium ${s.soon ? "text-muted-foreground" : "text-secondary-foreground"}`}
                >
                  {s.logo ? (
                    <Image
                      src={s.logo}
                      alt=""
                      width={14}
                      height={14}
                      className={`h-3.5 w-3.5 rounded-sm object-contain ${s.soon ? "opacity-60" : ""}`}
                    />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                  {s.name}
                  {s.tag ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${s.soon ? "bg-surface-2 text-muted-foreground" : "bg-primary/12 text-primary-ink"}`}
                    >
                      {s.tag}
                    </span>
                  ) : null}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> 1 flux unifié
              </span>
            </div>
          </StaggerItem>

          {/* C — Menu management */}
          <StaggerItem className="bento-card flex flex-col p-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary-ink">
              <UtensilsCrossed className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h3 className="mt-4 font-display text-base font-semibold text-foreground">
              Gestion du menu
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Plats, prix et disponibilité mis à jour en temps réel.
            </p>
            <div className="mt-4 space-y-2">
              {[
                { name: "Pizza Margherita", price: "12,90 €", on: true },
                { name: "Tiramisu maison", price: "6,50 €", on: false },
              ].map((it) => (
                <div
                  key={it.name}
                  className="flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-background px-3 py-2 text-xs"
                >
                  <span className="font-medium text-foreground">{it.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-muted-foreground">
                      {it.price}
                    </span>
                    <span
                      className={`h-4 w-7 rounded-full p-0.5 ${it.on ? "bg-primary" : "bg-surface-3"}`}
                    >
                      <span
                        className={`block h-3 w-3 rounded-full bg-white transition-transform ${it.on ? "translate-x-3" : ""}`}
                      />
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </StaggerItem>

          {/* D — Dashboard */}
          <StaggerItem className="bento-card flex flex-col p-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary-ink">
              <LayoutDashboard className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h3 className="mt-4 font-display text-base font-semibold text-foreground">
              Dashboard clair
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Pilotez ventes et commandes d&apos;un coup d&apos;œil.
            </p>
            <div className="mt-auto pt-4">
              <div className="flex h-14 items-end gap-1.5">
                {[35, 50, 40, 62, 55, 78, 70, 92].map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t ${i === 7 ? "bg-primary" : "bg-primary/25"}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary-ink">
                <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.2} /> +24 % ce
                mois
              </p>
            </div>
          </StaggerItem>

          {/* E — Loyalty */}
          <StaggerItem className="bento-card flex flex-col p-6 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary-ink">
              Engagement
            </span>
            <h3 className="mt-2 font-display text-lg font-semibold text-foreground">
              Une raison de revenir
            </h3>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Roue ou carte à gratter, scannées au QR code sur vos tables. Vous
              gardez le lien entre deux visites, avec les coordonnées de vos
              clients.
            </p>
            <div className="mt-4 space-y-3 rounded-xl border border-[color:var(--border)] bg-background p-4">
              {/* The game + the reward */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary-ink">
                    <Sparkles className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <div className="leading-tight">
                    <p className="text-xs font-semibold text-foreground">
                      Roue de la chance
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Jeu personnalisable, scanné à table
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground">
                  Dessert offert
                </span>
              </div>
              {/* The captured customer record */}
              <div className="flex items-center gap-2.5 border-t border-[color:var(--border)] pt-3">
                <Mail
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.8}
                />
                <span className="truncate text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">
                    marie.l@email.fr
                  </span>{" "}
                  · fiche client enregistrée
                </span>
              </div>
            </div>
          </StaggerItem>

          {/* F — Application mobile */}
          <StaggerItem className="bento-card relative flex flex-col justify-end overflow-hidden p-6 md:col-span-2">
            <Image
              src="/photos/burger-premium.webp"
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--olive)]/95 via-[color:var(--olive)]/70 to-[color:var(--olive)]/30" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-300">
                Mobile
                <span className="rounded-full border border-white/30 px-1.5 py-0.5 text-[9px] tracking-wide text-white/80">
                  À venir
                </span>
              </span>
              <h3 className="mt-2 font-display text-lg font-semibold text-white">
                Une app à votre marque
              </h3>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[color:var(--primary-100)]/85">
                Notifications push, commande en un geste : vos habitués vous
                gardent dans leur poche. Elle fera l&apos;offre Premium, qui
                ouvrira à sa sortie sur l&apos;App Store et Google Play.
              </p>
            </div>
          </StaggerItem>
        </StaggerContainer>
      </div>
    </section>
  );
}
