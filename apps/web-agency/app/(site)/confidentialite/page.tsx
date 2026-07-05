import type { Metadata } from "next";

import { LegalPageView } from "@/components/legal-page-view";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité de Be in Digital — données collectées, finalités, droits RGPD.",
  alternates: { canonical: "/confidentialite" },
  robots: { index: true, follow: false },
};

export default function ConfidentialitePage() {
  return <LegalPageView slug="confidentialite" />;
}
