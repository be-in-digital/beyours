import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Bricolage_Grotesque,
  Fraunces,
  Anton,
  Oswald,
  Zen_Kaku_Gothic_New,
} from "next/font/google";
import { ConvexClientProvider } from "@/components/convex-provider";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site-config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Display font — grotesque à caractère, chaleureux, hospitalité food
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Polices d'accent des templates interactifs (une identité par univers).
// Pizzeria — serif éditorial
const fraunces = Fraunces({
  variable: "--font-editorial",
  subsets: ["latin"],
  display: "swap",
});
// Fast-food — grotesque d'impact
const anton = Anton({
  variable: "--font-impact",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
// Food truck — condensée
const oswald = Oswald({
  variable: "--font-condensed",
  subsets: ["latin"],
  display: "swap",
});
// Asiatique — sans épurée
const zenKaku = Zen_Kaku_Gothic_New({
  variable: "--font-zen",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const TITLE =
  "Be in Digital — La plateforme digitale des restaurateurs indépendants";
const DESCRIPTION = SITE_DESCRIPTION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Be in Digital",
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
    "Be in Digital",
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
