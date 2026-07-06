/**
 * Footer — signature visuelle finale (Acte 07).
 *
 * Server async component qui fetch le singleton `siteSettings` (footer
 * columns + wordmark + copyright + signature). Tous les liens sont
 * éditables depuis le studio Sanity à `/studio`.
 */
import { sanityFetch } from "@/sanity/lib/fetch";
import { siteSettingsQuery } from "@/sanity/lib/queries";
import type { FooterColumn, SiteSettings } from "@/sanity/types";

export async function Footer() {
  const settings = await sanityFetch<SiteSettings>({ query: siteSettingsQuery });
  const { footer } = settings;

  return (
    <footer
      className="border-border/40 relative mt-24 border-t px-6 sm:mt-32 sm:px-10"
      role="contentinfo"
    >
      {/* ───── Wordmark XL outline → fill ───── */}
      <div className="border-border/40 mx-auto flex max-w-7xl justify-center border-b py-20 sm:py-28">
        <p
          aria-hidden="true"
          className="bid-wordmark-xl font-display text-foreground/90 text-center leading-[0.85] font-light tracking-tight"
        >
          {footer.wordmarkText}
        </p>
      </div>

      {/* ───── Columns ───── */}
      <nav
        aria-label="Liens du pied de page"
        className="mx-auto grid max-w-7xl gap-12 py-16 sm:grid-cols-2 lg:grid-cols-4"
      >
        {footer.columns.map((column) => (
          <FooterColumnView key={column.title} column={column} />
        ))}
      </nav>

      {/* ───── Bottom row ───── */}
      <div className="border-border/40 mx-auto flex max-w-7xl flex-col gap-2 border-t py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
          © {new Date().getFullYear()} {footer.copyright}
        </p>
        <p className="text-muted-foreground font-mono text-[10px] tracking-[0.2em] uppercase">
          {footer.signature}
        </p>
      </div>

      {/* Local style for the wordmark hover effect */}
      <style>{`
        .bid-wordmark-xl {
          font-size: clamp(4rem, 18vw, 16rem);
          color: transparent;
          -webkit-text-stroke: 1px hsl(0 0% 96% / 0.55);
          transition: color 600ms cubic-bezier(0.16, 1, 0.3, 1),
                      -webkit-text-stroke-color 600ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bid-wordmark-xl:hover {
          color: hsl(162 56% 57%);
          -webkit-text-stroke-color: transparent;
        }
      `}</style>
    </footer>
  );
}

function FooterColumnView({ column }: { column: FooterColumn }) {
  return (
    <div>
      <p className="text-primary font-mono text-xs tracking-[0.2em] uppercase">
        {column.title}
      </p>
      <ul className="mt-6 space-y-3">
        {column.links.map((link) => (
          <li key={link.href + link.label}>
            <a
              href={link.href}
              className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm transition-colors duration-300"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
