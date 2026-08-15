import Link from "next/link";

export default function ParrainagePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      {/* Hero */}
      <div className="relative text-center mb-16">
        <div
          aria-hidden
          className="bg-hero-radial pointer-events-none absolute inset-x-0 -top-16 h-72"
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            Programme Apporteur d&apos;Affaires
          </div>
          <h1 className="font-display text-balance text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight mb-4">
            Gagnez{" "}
            <span className="text-primary">500 &euro;</span>{" "}
            par client converti
          </h1>
          <p className="text-lg text-foreground/75 max-w-2xl mx-auto mb-8 text-pretty">
            Recommandez BeYours aux restaurateurs de votre réseau.
            Dès qu&apos;un filleul finalise son achat et que la commande est validée,
            vous touchez votre commission. Simple, transparent, automatique.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/parrainage/inscription"
              className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-primary text-primary-foreground font-semibold glow-primary hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Devenir apporteur
            </Link>
            <Link
              href="/parrainage/connexion"
              className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-surface-1 border border-border text-foreground font-medium hover:bg-surface-3 hover:border-border-contrast transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              J&apos;ai déjà un compte
            </Link>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="mb-16">
        <h2 className="font-display text-2xl font-semibold text-center mb-8">
          Comment ça marche
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              step: "1",
              title: "Inscrivez-vous",
              description:
                "Créez votre compte en quelques secondes avec votre email. C'est gratuit et ouvert à tous.",
            },
            {
              step: "2",
              title: "Partagez votre lien",
              description:
                "Envoyez votre code ou lien de parrainage personnalisé aux restaurateurs de votre réseau.",
            },
            {
              step: "3",
              title: "Recevez 500 €",
              description:
                "Dès que le restaurateur parrainé finalise son achat et que la commande est confirmée, votre commission est versée automatiquement.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="relative p-6 rounded-2xl bg-surface-1 border border-border"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-lg mb-4">
                {item.step}
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Benefits */}
      <div className="text-center mb-16">
        <h2 className="font-display text-2xl font-semibold mb-6">Vos avantages</h2>
        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {[
            "500 € de commission par vente encaissée au prix catalogue",
            "Virement automatique sur votre compte",
            "Dashboard pour suivre vos parrainages",
            "Code personnalisable à votre nom",
            "Vos filleuls bénéficient de -10% sur la création",
            "Inscription gratuite, aucun engagement",
          ].map((benefit) => (
            <div
              key={benefit}
              className="flex items-start gap-3 text-left p-3 rounded-xl"
            >
              <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-primary"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-sm text-foreground/80">{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center p-8 rounded-2xl bg-primary/5 border border-primary/10">
        <h2 className="font-display text-2xl font-semibold mb-2">Prêt à commencer ?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Inscription en 30 secondes, votre lien de parrainage est prêt immédiatement.
        </p>
        <Link
          href="/parrainage/inscription"
          className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
        >
          Créer mon compte apporteur
        </Link>
      </div>
    </div>
  );
}
