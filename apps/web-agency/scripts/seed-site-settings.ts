/**
 * Seed du singleton `siteSettings` — initial state qui reflète exactement
 * la navbar et le footer actuels du code.
 *
 * Run : pnpm tsx scripts/seed-site-settings.ts (depuis apps/agency)
 *
 * Idempotent : utilise createOrReplace avec _id fixe.
 */
import { createClient } from "@sanity/client";

import { loadEnv } from "./lib/env";

const env = loadEnv();

const client = createClient({
  projectId: env.projectId,
  dataset: env.dataset,
  apiVersion: "2025-04-27",
  token: env.token,
  useCdn: false,
});

async function main() {
  const doc = {
    _id: "siteSettings",
    _type: "siteSettings",
    navItems: [
      { _key: "n1", label: "Études de cas", href: "/work" },
      { _key: "n2", label: "Produits", href: "/products" },
      { _key: "n3", label: "À propos", href: "/about" },
      { _key: "n4", label: "Contact", href: "/contact" },
    ],
    ctaLabel: "Démarrer un projet",
    ctaHref: "/contact",
    footer: {
      wordmarkText: "Be in Digital",
      columns: [
        {
          _key: "c1",
          title: "Studio",
          links: [
            { _key: "l1", label: "À propos", href: "/about" },
            { _key: "l2", label: "Contact", href: "/contact" },
          ],
        },
        {
          _key: "c2",
          title: "Travaux",
          links: [
            { _key: "l1", label: "Selected work", href: "/work" },
            { _key: "l2", label: "Produits", href: "/products" },
            { _key: "l3", label: "BiD Restaurant", href: "https://restaurant.beindigital.fr" },
          ],
        },
        {
          _key: "c3",
          title: "Légal",
          links: [
            { _key: "l1", label: "Mentions légales", href: "/mentions-legales" },
            { _key: "l2", label: "Confidentialité", href: "/confidentialite" },
            { _key: "l3", label: "Cookies", href: "/cookies" },
          ],
        },
        {
          _key: "c4",
          title: "Contact",
          links: [
            { _key: "l1", label: "hello@beindigital.fr", href: "mailto:hello@beindigital.fr" },
            { _key: "l2", label: "LinkedIn", href: "https://www.linkedin.com/company/beindigital-fr" },
            { _key: "l3", label: "Démarrer un projet", href: "/contact" },
          ],
        },
      ],
      copyright: "Be in Digital · Paris",
      signature: "Crafted in France · 100% in-house",
      contactEmail: "hello@beindigital.fr",
      location: "Paris",
    },
  };

  const res = await client.createOrReplace(doc);
  console.log(`✓ siteSettings → ${res._id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
