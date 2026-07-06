import { NavbarShell } from "@/components/navbar-shell";
import { sanityFetch } from "@/sanity/lib/fetch";
import { siteSettingsQuery } from "@/sanity/lib/queries";
import type { SiteSettings } from "@/sanity/types";

/**
 * Navbar — server component qui fetch siteSettings (navbar items + CTA)
 * et délègue le rendu interactif à <NavbarShell />.
 */
export async function Navbar() {
  const settings = await sanityFetch<SiteSettings>({ query: siteSettingsQuery });

  return (
    <NavbarShell
      navItems={settings.navItems}
      ctaLabel={settings.ctaLabel}
      ctaHref={settings.ctaHref}
    />
  );
}
