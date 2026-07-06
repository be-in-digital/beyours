import type { Metadata } from "next";

import { LegalPageView } from "@/components/legal-page-view";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Mentions légales de Be in Digital — éditeur, hébergeur, propriété intellectuelle.",
  alternates: { canonical: "/mentions-legales" },
  robots: { index: true, follow: false },
};

export default function MentionsLegalesPage() {
  return <LegalPageView slug="mentions-legales" />;
}
