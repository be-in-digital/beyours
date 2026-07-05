import Link from "next/link";
import { FadeIn } from "@/components/ui/motion";
import { Logo } from "@/components/ui/logo";

const footerLinks = [
  {
    title: "Plateforme",
    links: [
      { label: "Site web", href: "#features" },
      { label: "Commande en ligne", href: "#features" },
      { label: "Menu digital", href: "#features" },
      { label: "Dashboard", href: "#features" },
      { label: "Fidélisation", href: "#features" },
      { label: "Analytics", href: "#features" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "À propos", href: "/a-propos" },
      { label: "Contact", href: "/contact" },
      { label: "Devenir apporteur d'affaires", href: "/parrainage" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Mentions légales", href: "#" },
      { label: "Confidentialité", href: "#" },
      { label: "CGU", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border/50 overflow-hidden">
      {/* Background glow */}
      <div className="blur-orb w-[500px] h-[300px] bg-primary/4 bottom-0 left-1/2 -translate-x-1/2" />

      {/* Light streaks background — anchored at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[60%] pointer-events-none"
        style={{
          backgroundImage: "url(/footer-bg.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
          backgroundRepeat: "no-repeat",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,0.6) 60%, black 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,0.6) 60%, black 100%)",
          opacity: 0.9,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-8">
        {/* Top area */}
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 mb-16">
          {/* Brand column */}
          <FadeIn direction="up" className="lg:max-w-sm">
            <Logo width={220} height={73} />
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              La plateforme digitale premium conçue pour les restaurants
              ambitieux. Centralisez, digitalisez, grandissez.
            </p>
            <div className="mt-6">
              <a
                href="mailto:hello@beindigital.fr"
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                hello@beindigital.fr
              </a>
            </div>

            {/* Social links */}
            <div className="mt-6 flex items-center gap-3">
              {[
                {
                  label: "Instagram",
                  href: "https://instagram.com/beindigital.fr",
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="20" x="2" y="2" rx="5" />
                      <circle cx="12" cy="12" r="5" />
                      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                    </svg>
                  ),
                },
                {
                  label: "TikTok",
                  href: "https://tiktok.com/@beindigital.fr",
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.07 2.49 5.44 5.59 5.44 3.19 0 5.7-2.55 5.7-5.7V8.81a7.35 7.35 0 0 0 4.3 1.38V7.1s-1.88.09-3.24-1.28z" />
                    </svg>
                  ),
                },
                {
                  label: "X",
                  href: "https://x.com/beindigital_fr",
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  ),
                },
                {
                  label: "LinkedIn",
                  href: "https://linkedin.com/company/beindigital-fr",
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  ),
                },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:text-primary hover:border-primary/20 hover:bg-primary/[0.06] transition-all duration-200"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </FadeIn>

          {/* Link columns */}
          <FadeIn delay={0.15} className="flex flex-wrap gap-12 lg:gap-16 flex-1">
            {footerLinks.map((group) => (
              <div key={group.title}>
                <h4 className="text-sm font-semibold mb-4">{group.title}</h4>
                <ul className="space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </FadeIn>
        </div>

        {/* Giant wordmark */}
        <div
          className="mt-4 select-none overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          <div
            className="font-medium tracking-[-0.04em] leading-[0.85] text-center whitespace-nowrap"
            style={{
              fontSize: "clamp(2.25rem, 13vw, 14rem)",
              backgroundImage:
                "linear-gradient(to bottom, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.5) 55%, rgba(82,207,175,0.22) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              marginBottom: "-0.12em",
            }}
          >
            Be in{" "}
            <span className="font-serif italic font-normal">Digital</span>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/20">
          <p className="text-xs text-white/80">
            &copy; {new Date().getFullYear()} Be in Digital. Tous droits
            réservés.
          </p>
          <a
            href="#"
            className="text-xs text-white/80 hover:text-white transition-colors flex items-center gap-1"
          >
            Retour en haut
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
