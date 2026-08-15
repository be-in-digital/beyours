import type { Metadata } from "next";
import Link from "next/link";
import { SectionBadge } from "@/components/ui/section-badge";
import { CommissionCalculator } from "@/components/pricing/commission-calculator";
import { DecouvrirHero } from "@/components/decouvrir/decouvrir-hero";
import { GameDemo } from "@/components/decouvrir/game-demo";
import { GameWalkthrough } from "@/components/decouvrir/game-walkthrough";
import { FeatureShowcase } from "@/components/decouvrir/feature-showcase";
import { CompetitorComparison } from "@/components/decouvrir/competitor-comparison";
import { DecouvrirCta } from "@/components/decouvrir/decouvrir-cta";
import { CalendlyButton } from "@/components/decouvrir/demo-cta-button";
import { FoundersBanner } from "@/components/decouvrir/founders-banner";
import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Découvrir en jouant — la démo interactive | Be in Digital",
  description:
    "Tournez la roue, grattez la carte, parcourez le site de commande. La démo interactive du produit restaurant Be in Digital : jeu de fidélité, KDS, multi-langues, 0 % de commission. Et ce que la concurrence vous coûte vraiment.",
  alternates: { canonical: `${SITE_URL}/decouvrir` },
  openGraph: {
    title: "Découvrir Be in Digital en jouant — démo interactive",
    description:
      "Le seul aperçu où vous pouvez vraiment cliquer : jeu de fidélité jouable, KDS, multi-langues, comparatif chiffré face aux plateformes.",
    url: `${SITE_URL}/decouvrir`,
    type: "website",
  },
};

function SectionIntro({
  badge,
  title,
  children,
}: {
  badge: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto mb-14 max-w-3xl text-center">
      <SectionBadge text={badge} />
      <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {children && (
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {children}
        </p>
      )}
    </div>
  );
}

export default function DecouvrirPage() {
  return (
    <div className="paper-grain relative">
      <DecouvrirHero />

      {/* ── Ce que les plateformes coûtent ── */}
      <section className="relative px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            badge="Le vrai prix des plateformes"
            title="Chaque commande livrée, c'est 30 % qui partent"
          >
            Uber Eats prélève jusqu&apos;à 30 % HT par commande, 33 à 36 % une fois
            les frais et la TVA comptés. Déplacez le curseur : voyez ce que ces
            commissions vous coûtent, et en combien de temps votre site se
            rembourse.
          </SectionIntro>
          <CommissionCalculator />
        </div>
      </section>

      {/* ── Le jeu ── */}
      <section
        id="jeu"
        className="relative scroll-mt-24 bg-surface-1/50 px-4 py-20 sm:px-6 sm:py-28"
      >
        <div className="pointer-events-none absolute inset-0 bg-section-radial" />
        <div className="relative mx-auto max-w-7xl">
          <SectionIntro
            badge="La démo à jouer"
            title="Le jeu qui transforme une visite en client fidèle"
          >
            Voici, exactement, ce que vit votre client après avoir scanné le QR
            code sur sa table. Jouez-le vous-même, étape par étape.
          </SectionIntro>
          <GameDemo />
          <GameWalkthrough />
        </div>
      </section>

      {/* ── Toutes les fonctionnalités ── */}
      <section className="relative px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            badge="Le produit complet"
            title="Bien plus qu'un jeu : votre restaurant en digital"
          >
            Site de commande, écran cuisine, pilotage, langues, fidélité. Cliquez
            dans chaque module : tout est réel et inclus dès aujourd&apos;hui. Les
            intégrations Uber Eats &amp; Deliveroo arrivent après certification,
            offertes à tous.
          </SectionIntro>
          <FeatureShowcase />
        </div>
      </section>

      {/* ── Comparatif concurrence ── */}
      <section className="relative bg-surface-1/50 px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            badge="Face à la concurrence"
            title="Vous louez votre visibilité, ou vous la possédez"
          >
            Plateformes, logiciels en abonnement, agences : chacun a un prix
            caché. Voici où se place Be in Digital, sans détour.
          </SectionIntro>
          <CompetitorComparison />
        </div>
      </section>

      {/* ── Ancrage prix ── */}
      <section className="relative px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <FoundersBanner />
          <div className="overflow-hidden rounded-3xl border border-[color:var(--border)] bg-surface-1 p-8 sm:p-12">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
              <div>
                <SectionBadge text="L'offre Essentielle" />
                <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">
                  Tout ça, une fois. Pas chaque mois.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  Vous achetez votre site une fois. La maintenance couvre
                  l&apos;hébergement, le support, les mises à jour et les évolutions
                  mineures. Le jeu, la fidélité, le KDS et les langues sont
                  inclus. Zéro commission sur vos ventes directes.
                </p>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {[
                    "Fidélité, jeu concours, KDS et multi-langues inclus",
                    "0 % de commission sur les commandes directes",
                    "Paiement de la création en 3 ou 4 fois (Alma, Klarna)",
                    "Offre fondateurs : 2 500 € HT pour les 10 premiers",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="text-foreground">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col justify-center rounded-2xl border border-[color:var(--border)] bg-background p-8">
                <p className="text-sm text-muted-foreground">Création</p>
                <p className="font-display text-4xl font-semibold tracking-tight">
                  3 500 €{" "}
                  <span className="text-lg font-normal text-muted-foreground">
                    HT
                  </span>
                </p>
                <div className="my-5 h-px bg-[color:var(--border)]" />
                <p className="text-sm text-muted-foreground">
                  Puis maintenance
                </p>
                <p className="font-display text-3xl font-semibold tracking-tight">
                  1 000 €{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    HT / an
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  1re année incluse, puis renouvellement annuel
                </p>
                <p className="mt-4 self-start rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                  Offre fondateurs : 2 500 € HT pour les 10 premiers
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <CalendlyButton className="w-full">
                    Réserver un appel
                  </CalendlyButton>
                  <Link
                    href="/tarifs"
                    className="inline-flex w-full items-center justify-center rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    Voir le détail des tarifs
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DecouvrirCta />

      {/* ── Sources ── */}
      <section className="border-t border-[color:var(--border)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sources & méthodologie
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground/80">
            Chiffres relevés en juillet 2026. Commissions de livraison : Uber
            Eats 30 % HT (formule livraison Uber), effectif 33 à 36 % avec frais
            et TVA ; Deliveroo 25 à 32 %. Impact des avis : Michael Luca, Harvard
            Business School (2011), « Reviews, Reputation, and Revenue: The Case
            of Yelp.com » : une étoile de plus vaut 5 à 9 % de chiffre d&apos;affaires
            pour un indépendant. Fidélisation : Bain & Company (acquérir coûte 5
            à 25 fois plus que fidéliser). Logiciels : Zenchef 69 à 149 €/mois,
            TheFork ~139 €/mois plus commission au couvert. Outils de jeu :
            Drimify, Easypromos, Qualifio, 29 à 226 €/mois. Les tarifs Be in
            Digital sont en euros hors taxes.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {[
              ["Commissions plateformes", "https://commandeici.com/blogs/commande-en-ligne/commission-uber-eats-restaurant-combien-payez"],
              ["Livraison 2026 (L'Hôtellerie)", "https://www.lhotellerie-restauration.fr/actualite/livraison-en-2026-les-plateformes-toujours-au-coeur-de-la-strategie"],
              ["Tarifs Zenchef", "https://www.zenchef.com/plans"],
              ["Coût TheFork", "https://www.restoboard.fr/blog/combien-coute-thefork-restaurant-2026"],
              ["Outils de gamification", "https://www.blogdumoderateur.com/tools/drimify/"],
            ].map(([label, url]) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
