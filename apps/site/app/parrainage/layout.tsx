import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Programme Apporteur d'Affaires — Be in Digital",
  description:
    "Devenez apporteur d'affaires Be in Digital et gagnez 500 € pour chaque client parrainé.",
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
            <Logo width={160} height={53} priority linked={false} />
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
          &copy; {new Date().getFullYear()} Be in Digital. Tous droits réservés.
        </div>
      </footer>
    </div>
  );
}
