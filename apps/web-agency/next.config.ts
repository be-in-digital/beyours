import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@beindigital/webgl-utils"],
  images: {
    remotePatterns: [
      // Sanity asset CDN — toutes les covers de case studies + médias.
      { protocol: "https", hostname: "cdn.sanity.io" },
    ],
  },
  /**
   * Redirects 301 — vieilles URLs de l'ancien domaine `be-in-digital.fr`
   * (resto avant la migration) qui pointent vers le subdomain restaurant.
   * Aucune capture de trafic legacy attendu — Vercel les retournera en 301
   * permanent vers `restaurant.beindigital.fr`.
   *
   * Note : ces redirects matchent uniquement quand la requête arrive sur
   * beindigital.fr (le domaine actuel de l'agence). Les vieilles URLs de
   * `be-in-digital.fr` doivent d'abord arriver ici via un alias domaine
   * Vercel.
   */
  async redirects() {
    return [
      // Anciennes routes du resto (avant la migration vers /restaurant)
      // qui pourraient encore être indexées dans Google. Toutes vont vers
      // restaurant.beindigital.fr (préserve le slug).
      {
        source: "/menu/:slug*",
        destination: "https://restaurant.beindigital.fr/menu/:slug*",
        permanent: true,
      },
      {
        source: "/commande/:slug*",
        destination: "https://restaurant.beindigital.fr/commande/:slug*",
        permanent: true,
      },
      {
        source: "/parrainage/:slug*",
        destination: "https://restaurant.beindigital.fr/parrainage/:slug*",
        permanent: true,
      },
      {
        source: "/tarifs",
        destination: "https://restaurant.beindigital.fr/tarifs",
        permanent: true,
      },
      {
        source: "/fonctionnalites",
        destination: "https://restaurant.beindigital.fr/fonctionnalites",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
