import type { Metadata } from "next";

import { LegalPageView } from "@/components/legal-page-view";

export const metadata: Metadata = {
  title: "Cookies",
  description:
    "Politique cookies de Be in Digital — aucun cookie de tracking, uniquement des cookies techniques essentiels.",
  alternates: { canonical: "/cookies" },
  robots: { index: true, follow: false },
};

export default function CookiesPage() {
  return <LegalPageView slug="cookies" />;
}
