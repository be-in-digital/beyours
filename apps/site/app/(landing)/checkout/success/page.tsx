import Link from "next/link";
import { FadeIn } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";
import { KickoffCallButton } from "@/components/checkout/kickoff-call-button";

export default function CheckoutSuccessPage() {
  return (
    <main className="relative min-h-screen pt-28 pb-20 overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/[0.06] blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 sm:px-6 text-center">
        <FadeIn>
          <SectionBadge text="Paiement confirmé" />

          <div className="mt-6 w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em] mt-6">
            Merci pour votre{" "}
            <span className="text-primary">confiance</span>
          </h1>

          <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            Votre paiement a bien été reçu. Prenez rendez-vous dès maintenant
            pour lancer votre projet avec notre équipe.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <KickoffCallButton />
            <Link
              href="/"
              className="rounded-full bg-surface-2 border border-[color:var(--border-contrast)] px-6 py-3 text-sm font-medium text-foreground transition-all hover:bg-surface-3"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
