import type { Metadata } from "next";

/**
 * The affiliate dashboard asks not to be indexed (#535).
 *
 * `robots.ts` disallows this path too, and that is a request a crawler may
 * ignore — or never see, if it reaches a url from a link rather than from the
 * root. This tag is what travels with the page itself. Both halves, on purpose.
 *
 * WHY A LAYOUT FOR ONE LINE. `page.tsx` here and under `admin/`, `partage/` and
 * `profil/` are all `"use client"`, and a client component cannot export
 * `metadata`. A layout is the only place this can be declared, and declaring it
 * once covers the four routes beneath it.
 *
 * It also replaces something that was wrong: `parrainage/layout.tsx` used to
 * carry `alternates: { canonical: "/parrainage" }`, which every route under it
 * inherited — so this dashboard, `connexion`, `contrat` and `inscription` all
 * told a crawler they were the landing page. The canonical now sits on the
 * landing page, where the claim is true.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AffiliateDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
