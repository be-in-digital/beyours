/**
 * Structured data components for SEO.
 * Output JSON-LD via <script type="application/ld+json"> with string children.
 * React 19 renders script text children verbatim for non-executable types.
 * All data is static and server-authored — no user input is ever embedded.
 */

import { SITE_URL, SITE_NAME, SITE_EMAIL } from "@/lib/site-config";

const LOGO_URL = `${SITE_URL}/logo.png`;

interface JsonLdProps {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}

function JsonLd({ data }: JsonLdProps) {
  return (
    <script type="application/ld+json">{JSON.stringify(data)}</script>
  );
}

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: LOGO_URL,
    description:
      "Plateforme digitale premium pour restaurateurs : site web, commande en ligne, fidélité, analytics.",
    sameAs: [
      "https://instagram.com/beindigital.fr",
      "https://tiktok.com/@beindigital.fr",
      "https://linkedin.com/company/beindigital-fr",
      "https://x.com/beindigital_fr",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      email: SITE_EMAIL,
      areaServed: "FR",
      availableLanguage: ["fr-FR"],
    },
  };
  return <JsonLd data={data} />;
}

export function SoftwareApplicationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "RestaurantManagementSoftware",
    operatingSystem: "Web",
    description:
      "Plateforme tout-en-un pour restaurants : site vitrine, commande en ligne, Click & Collect, livraison, KDS, fidélité, analytics et intégrations Uber Eats / Deliveroo.",
    url: SITE_URL,
    image: `${SITE_URL}/opengraph-image`,
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: LOGO_URL,
    },
    featureList: [
      "Site web restaurant premium",
      "Commande en ligne sans commission",
      "Click and Collect",
      "Livraison via Uber Direct",
      "KDS (Kitchen Display System)",
      "Impression de tickets",
      "Centralisation Uber Eats & Deliveroo",
      "Programme de fidélité & gamification",
      "Analytics et rapports",
      "CMS simple",
      "Formation Google Business Profile",
    ],
  };
  return <JsonLd data={data} />;
}

const faqItems = [
  {
    q: "En combien de temps notre restaurant peut être en ligne ?",
    a: "Comptez en moyenne 4 à 6 semaines entre le premier échange et la mise en ligne, incluant le design, la mise en place du site, du menu, des intégrations de commande et la formation à la plateforme.",
  },
  {
    q: "Be in Digital prélève-t-il une commission sur les commandes ?",
    a: "Non. Les commandes reçues directement depuis votre site Be in Digital sont sans commission. Vous conservez l'intégralité de votre marge.",
  },
  {
    q: "Peut-on intégrer Uber Eats et Deliveroo à la plateforme ?",
    a: "Oui. Les commandes Uber Eats et Deliveroo sont centralisées dans votre dashboard Be in Digital pour une gestion unifiée avec vos commandes directes.",
  },
  {
    q: "Comment fonctionne la livraison ?",
    a: "Be in Digital s'intègre nativement à Uber Direct pour proposer la livraison depuis votre site, sans contrat séparé avec une plateforme tierce.",
  },
  {
    q: "Y a-t-il un engagement dans la durée ?",
    a: "Notre modèle repose sur un achat one-shot de la plateforme + une maintenance annuelle. Aucun engagement long terme n'est imposé.",
  },
  {
    q: "Le dashboard est-il adapté aux non-techniciens ?",
    a: "Oui. L'interface est conçue pour être utilisée au quotidien par des restaurateurs sans compétences techniques, avec une prise en main rapide grâce à un onboarding personnalisé.",
  },
];

export function FaqJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
  return <JsonLd data={data} />;
}

export function WebsiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "fr-FR",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: LOGO_URL,
    },
  };
  return <JsonLd data={data} />;
}

interface BreadcrumbItem {
  name: string;
  item: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.item.startsWith("http") ? it.item : `${SITE_URL}${it.item}`,
    })),
  };
  return <JsonLd data={data} />;
}
