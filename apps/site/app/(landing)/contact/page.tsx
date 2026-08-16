import type { Metadata } from "next";
import { ContactHero } from "@/components/contact/contact-hero";
import { ContactFormSection } from "@/components/contact/contact-form-section";
import { ContactInfoSection } from "@/components/contact/contact-info-section";

export const metadata: Metadata = {
  title: "Contact — BeYours",
  description:
    "Contactez BeYours. Réservez un appel, envoyez-nous un message ou retrouvez nos coordonnées.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact — BeYours",
    description:
      "Parlons de votre restaurant. Réservez un appel ou envoyez un message.",
    url: "/contact",
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <>
      <ContactHero />
      <ContactFormSection />
      <ContactInfoSection />
    </>
  );
}
