import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ConvexClientProvider } from "@/components/convex-provider";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site-config";
import "./globals.css";

/**
 * Fonts — auto-hébergées via next/font/local, fichiers dans app/fonts/.
 *
 * Pourquoi pas next/font/google : ce chargeur télécharge les woff2 depuis
 * fonts.gstatic.com AU MOMENT DU BUILD. Sept familles, donc sept occasions
 * qu'une indisponibilité de Google fasse échouer un build sans qu'aucune
 * ligne n'ait changé. Le site agence en a fait les frais le 15/08/2026 :
 * trois 404 sur Fraunces ont cascadé en six erreurs « Module not found ».
 *
 * Les fichiers sont versionnés (9 woff2, 212 Ko, sous-ensemble latin) : le
 * build devient déterministe et fonctionne hors ligne. Six de ces polices
 * sont variables — un fichier couvre toute la plage de graisses, d'où les
 * `weight` en intervalle. Seule Zen Kaku est statique, d'où ses trois
 * fichiers.
 */
const geistSans = localFont({
  variable: "--font-geist-sans",
  display: "swap",
  src: [{ path: "./fonts/geist.woff2", weight: "100 900", style: "normal" }],
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  display: "swap",
  src: [
    { path: "./fonts/geist-mono.woff2", weight: "100 900", style: "normal" },
  ],
});

// Display font — grotesque à caractère, chaleureux, hospitalité food
const bricolage = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "./fonts/bricolage.woff2", weight: "400 700", style: "normal" },
  ],
});

// Polices d'accent des templates interactifs (une identité par univers).
// Pizzeria — serif éditorial
const fraunces = localFont({
  variable: "--font-editorial",
  display: "swap",
  src: [{ path: "./fonts/fraunces.woff2", weight: "100 900", style: "normal" }],
});
// Fast-food — grotesque d'impact
const anton = localFont({
  variable: "--font-impact",
  display: "swap",
  src: [{ path: "./fonts/anton.woff2", weight: "400", style: "normal" }],
});
// Food truck — condensée
const oswald = localFont({
  variable: "--font-condensed",
  display: "swap",
  src: [{ path: "./fonts/oswald.woff2", weight: "200 700", style: "normal" }],
});
// Asiatique — sans épurée
const zenKaku = localFont({
  variable: "--font-zen",
  display: "swap",
  src: [
    { path: "./fonts/zen-kaku-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/zen-kaku-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/zen-kaku-700.woff2", weight: "700", style: "normal" },
  ],
});

const TITLE =
  "BeYours — La plateforme digitale des restaurateurs indépendants";
const DESCRIPTION = SITE_DESCRIPTION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · BeYours",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "logiciel restaurant",
    "site restaurant",
    "commande en ligne restaurant",
    "click and collect",
    "KDS restaurant",
    "plateforme restaurant",
    "fidélité restaurant",
    "commande en ligne sans commission",
    "POS restaurant",
    "digitaliser restaurant",
    "logiciel caisse restaurant",
    "BeYours",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
    languages: {
      "fr-FR": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@beindigital",
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
  category: "Business Software",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#faf5ee" }],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${fraunces.variable} ${anton.variable} ${oswald.variable} ${zenKaku.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
