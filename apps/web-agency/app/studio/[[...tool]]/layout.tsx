/**
 * Layout dédié au studio Sanity. On override le layout racine (qui mount
 * Loader, MagneticCursor, Lenis, Navbar, Footer) — ces composants n'ont
 * rien à faire dans une UI d'admin.
 *
 * La metadata `viewport-fit=cover` empêche le studio d'avoir des coupures
 * sur iPhone notch.
 */
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Be in Digital — Studio",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
