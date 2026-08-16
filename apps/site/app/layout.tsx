import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ConvexClientProvider } from "@/components/convex-provider";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site-config";
import "./globals.css";

/**
 * Fonts — self-hosted through next/font/local, files under app/fonts/.
 *
 * Why not next/font/google: that loader downloads the woff2 files from
 * fonts.gstatic.com AT BUILD TIME. Seven families, so seven chances for a
 * Google outage to fail a build with no line of code having changed. The
 * agency site paid for it on 2026-08-15: three 404s on Fraunces cascaded into
 * six "Module not found" errors.
 *
 * The files are committed (9 woff2, 212 KB, Latin subset): the build becomes
 * deterministic and works offline. Six of these are variable fonts — one file
 * covers the whole weight range, hence the interval `weight` values. Only Zen
 * Kaku is static, hence its three files.
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
