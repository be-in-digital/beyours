import type { Metadata, Viewport } from "next";
import { Fraunces, Inter_Tight, JetBrains_Mono } from "next/font/google";
import Script from "next/script";

import "./globals.css";

/**
 * Fonts — chargées via next/font/google (auto-self-host + woff2 + preload).
 *
 * Perf :
 *   - Fraunces : variable font, axes optical-size + softness pour rendre
 *     le H1 hero. On ne demande que les weights réellement utilisés
 *     (300 light pour le hero, 400 normal, 700 bold pour body) afin de
 *     réduire la taille du fichier. Avec axes="opsz" l'optical sizing
 *     est ajusté automatiquement par taille de glyph. preload:true
 *     (default) → <link rel="preload"> ajouté automatiquement par Next
 *     dans le <head>, donc le navigateur fetch la font en parallèle du
 *     HTML, ce qui sécurise le LCP.
 *   - Inter Tight : weight body, on garde 400/500/600.
 *   - JetBrains Mono : preload:false car font de niche (chiffres /
 *     monospace) qui n'apparaît qu'après le hero.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  // Weights statiques utilisés dans le site : 300 (hero light) / 400
  // (paragraphes display) / 700 (titres bold éventuels). On laisse
  // tomber les axes opsz/SOFT/WONK : la perte visuelle est minime mais
  // on économise ~70KB sur le fichier woff2 (variable font full ≈
  // 118KB vs ~50KB en weights statiques).
  // 700 retiré (non utilisé en above-fold) → −1 fichier woff2 préloadé
  // sur mobile, gain LCP estimé 100-200 ms.
  weight: ["300", "400"],
  style: ["normal", "italic"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400"],
  // preload:false → cette font ne charge qu'au moment où elle est utilisée
  // (font-mono apparaît uniquement après le hero, pas critique LCP).
  preload: false,
});

const TITLE_DEFAULT =
  "Be in Digital — Studio digital pour startups & scale-ups · Paris";
const DESCRIPTION =
  "Be in Digital conçoit et code les produits digitaux premium des startups Series A/B et des scale-ups : sites web sur mesure, applications SaaS, design système, ingénierie produit. Studio indépendant à Paris.";

export const metadata: Metadata = {
  metadataBase: new URL("https://beindigital.fr"),
  title: {
    default: TITLE_DEFAULT,
    template: "%s · Be in Digital",
  },
  description: DESCRIPTION,
  applicationName: "Be in Digital",
  authors: [{ name: "Be in Digital" }],
  creator: "Be in Digital",
  publisher: "Be in Digital",
  category: "Web Design & Development",
  keywords: [
    "Be in Digital",
    "agence web premium",
    "agence digitale Paris",
    "studio digital Paris",
    "studio créatif Paris",
    "création site web sur mesure",
    "développement Next.js",
    "agence Next.js",
    "design produit",
    "design système",
    "application SaaS sur mesure",
    "ingénierie produit",
    "refonte site premium",
    "agence WebGL",
    "agence Three.js",
    "performance web",
    "site startup",
    "site scale-up",
  ],
  alternates: {
    canonical: "/",
    languages: {
      "fr-FR": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://beindigital.fr",
    siteName: "Be in Digital",
    title: TITLE_DEFAULT,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE_DEFAULT,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#090909",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Preconnect Sanity CDN — toutes les covers DeviceMockup viennent
          de cdn.sanity.io. Économise ~150ms RTT TLS sur mobile 3G/4G.
          crossorigin requis car l'asset est servi en cross-origin.
        */}
        <link
          rel="preconnect"
          href="https://cdn.sanity.io"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://cdn.sanity.io" />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
        {/*
          Widget de chat Be in Digital (AI Business OS).
          Chargé via next/script en lazyOnload : la bulle de conversation
          n'est pas critique pour le LCP, on la charge pendant le temps
          d'inactivité du navigateur pour ne pas pénaliser le rendu hero.
          L'attribut data-business porte la clé publique du compte.
        */}
        <Script
          src="https://aibusinessos.beindigital.fr/widget.js"
          data-business="pk_live_wjk13kmhiSKaHQ16IyCQZmMzK504uD6R"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
