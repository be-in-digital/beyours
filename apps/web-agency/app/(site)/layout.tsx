/**
 * Layout du site public — wrappe toutes les pages marketing avec :
 *   Loader cinematic, MagneticCursor, ConvexClientProvider (form contact),
 *   LenisProvider (smooth scroll), Navbar et Footer.
 *
 * Le studio Sanity (/studio) ne passe pas par ce layout — il a son propre
 * layout dans app/studio/[[...tool]]/layout.tsx, qui n'embarque aucun de
 * ces composants pour ne pas polluer l'UI d'admin.
 *
 * Perf :
 *   - Loader, MagneticCursor : `ssr: false` via SiteShellEffects (client).
 *     Ces composants ne sont plus dans le bundle d'hydratation initial.
 *   - LenisProviderClient : idem (ssr:false). Tire ~50KB gzipped (lenis +
 *     gsap + ScrollTrigger). Le rendering du contenu n'attend pas Lenis.
 *
 * Bénéfice : le navigateur peint le hero, mesure le LCP sur le H1 / hero
 * radial, *puis* charge les effets. Lighthouse perçoit donc un LCP
 * rapide.
 */
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import {
  LenisProviderClient,
  SiteShellEffects,
} from "@/components/site-shell-effects";

/**
 * ConvexClientProvider est volontairement *absent* de ce layout : il
 * n'est nécessaire que sur /contact (formulaire branché sur Convex). Le
 * provider est donc importé directement par <ContactForm /> via dynamic
 * import, ce qui évite ~37KB unminified de Convex client sur les routes
 * marketing (home, work, etc.) qui n'en ont pas besoin.
 */
export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <SiteShellEffects />
      <a href="#main-content" className="bid-skip-link">
        Aller au contenu
      </a>
      <LenisProviderClient>
        <Navbar />
        <div id="main-content" tabIndex={-1}>{children}</div>
        <Footer />
      </LenisProviderClient>
    </>
  );
}
