import Link from "next/link";
import { FadeIn } from "@/components/ui/motion";
import { SectionBadge } from "@/components/ui/section-badge";

export default function CheckoutCancelPage() {
  return (
    <main className="relative min-h-screen pt-28 pb-20 overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-white/[0.02] blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 sm:px-6 text-center">
        <FadeIn>
          <SectionBadge text="Paiement annulé" />

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em] mt-6">
            Paiement annulé
          </h1>

          <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            Votre paiement a été annulé. Aucun montant n&apos;a été débité.
            Vous pouvez réessayer à tout moment.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/tarifs"
              className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all hover:brightness-110"
            >
              Voir les offres
            </Link>
            <Link
              href="/"
              className="rounded-full border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-sm font-medium text-foreground transition-all hover:bg-white/[0.08]"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
