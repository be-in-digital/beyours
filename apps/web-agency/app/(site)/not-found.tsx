import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page introuvable",
  description: "Cette page n'existe pas ou a été déplacée.",
  robots: { index: false, follow: true },
};

export default function NotFoundPage() {
  return (
    <main className="bg-background relative flex min-h-svh items-center overflow-hidden px-6 py-32 sm:px-10 sm:py-40">
      <div className="bg-section-radial pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_30%,hsl(162_56%_57%/0.18),transparent_60%)]"
      />

      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-start">
        <p className="font-mono text-primary mb-6 text-xs tracking-[0.2em] uppercase">
          Erreur 404
        </p>

        <h1 className="font-display text-foreground text-7xl leading-[0.9] font-light tracking-tight sm:text-8xl lg:text-[10rem]">
          Page
          <br />
          <span className="text-muted-foreground italic">introuvable.</span>
        </h1>

        <p className="text-muted-foreground mt-10 max-w-xl text-lg leading-relaxed sm:text-xl">
          Cette page n’existe plus, ou n’a jamais existé. Pas grave — on
          peut probablement t’aider à trouver ce que tu cherches.
        </p>

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <Link
            href="/"
            data-magnetic
            className="bg-primary text-primary-foreground glow-primary hover:glow-strong inline-flex items-center rounded-full px-7 py-3.5 text-sm font-medium tracking-wide transition-shadow duration-300"
          >
            Retour à l’accueil
          </Link>
          <Link
            href="/work"
            data-magnetic
            className="text-muted-foreground hover:text-foreground border-border hover:border-primary/40 inline-flex items-center rounded-full border px-7 py-3.5 text-sm tracking-wide transition-colors duration-300"
          >
            Voir les études de cas
          </Link>
        </div>
      </div>
    </main>
  );
}
