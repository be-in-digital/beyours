import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Programme Apporteur d'Affaires — BeYours",
  description:
    "Devenez apporteur d'affaires BeYours et gagnez 500 € pour chaque client parrainé. Contrat signé en ligne, commissions suivies depuis votre tableau de bord.",
  /* NO `alternates.canonical` HERE (#535). A layout's metadata is inherited by
     every route beneath it — `connexion`, `contrat`, `inscription` and the whole
     dashboard — so a canonical declared at this level told a crawler that four
     distinct pages were duplicates of the landing page. A canonical is a claim
     about ONE url and belongs on the page making it; `page.tsx` makes it. */
};

export default function ParrainageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Simple header */}
      <header className="border-b border-border/50 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Logo width={160} height={37} priority linked={false} />
          </Link>
          <Link
            href="/parrainage"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Programme Apporteur
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1">{children}</div>

      {/* Simple footer */}
      <footer className="border-t border-border/50 px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} BeYours. Tous droits réservés.
        </div>
      </footer>
    </div>
  );
}
