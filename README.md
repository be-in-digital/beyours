# BeInDigital

Monorepo pnpm + Turborepo regroupant le moteur produit vendu aux restaurateurs
et les deux sites web de l'entreprise.

## Deux familles de paquets, à ne pas confondre

Les deux scopes ne diffèrent que par des tirets, et ne partagent **aucune
dépendance** :

| Scope | Contenu | Livraison |
| --- | --- | --- |
| `@be-in-digital/*` | Le moteur produit : 11 paquets + l'app de référence | Versionné par changesets, publié sur GitHub Packages |
| `@beindigital/*` | Les sites web et leurs paquets partagés | Déploiement continu, exclu de changesets |

## Structure

```
apps/
  restaurant-theme/   Application de référence du moteur (storefront, admin, KDS, jeux)
  web-restaurant/     Site commercial de l'offre restauration (+ console interne)
  web-agency/         Site de l'agence (+ back-office CRM, Sanity Studio)
  docs/               Documentation (markdown, pas un workspace)

packages/
  ui/                 Composants React
  core/               Auth, i18n, AWS, env, Sentry
  restaurant/         Logique métier, hooks, stores Zustand
  admin/              Pages et composants d'administration
  cms/                Registre de blocs, validation, sanitisation
  convex-schema/      Tables et validateurs Convex
  convex-functions/   Fonctions backend Convex
  integrations/       Uber Eats, Deliveroo
  marketing/          Email, campagnes, segments
  mcp-server/         Serveur MCP exposant le registre des paquets

  web-config/         tsconfig + eslint partagés par les sites
  web-tokens/         Tokens CSS
  web-webgl-utils/    Utilitaires WebGL
```

## Démarrer

```bash
pnpm install
```

Les paquets `@be-in-digital/*` sont privés. Pour installer depuis un autre dépôt,
exporter un `NODE_AUTH_TOKEN` avec le scope `read:packages` (voir
`apps/docs/deployment/github-packages.md`).

### Lancer une application

```bash
pnpm dev                    # toutes les apps via turbo
pnpm dev:web-agency         # site agence, port 3001
pnpm dev:web-restaurant     # site restauration
```

Les applications à backend Convex ont besoin d'un second terminal :

```bash
pnpm --filter <app> dev:backend
```

## Scripts

| Commande | Effet |
| --- | --- |
| `pnpm build` | Build de tous les workspaces |
| `pnpm lint` | ESLint |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm test` | Tests unitaires Vitest |
| `pnpm test:e2e` | Tests end-to-end Playwright |
| `pnpm format` | Prettier en écriture |
| `pnpm changeset` | Déclarer un changement de version |

Lancer `pnpm test && pnpm test:e2e` avant de committer.

## Publication

Seuls les paquets `@be-in-digital/*` sont versionnés. Un changeset est requis
pour toute modification les concernant ; `release.yml` publie sur GitHub Packages
à la fusion dans `main`. Les sites web sont déployés en continu et explicitement
exclus de changesets et de l'étape de build de la CI.

## Documentation

- `CLAUDE.md` — architecture, conventions et contexte produit
- `apps/docs/` — guides, référence d'API, déploiement
- `apps/web-agency/CLAUDE.md`, `apps/web-restaurant/CLAUDE.md` — spécifique à chaque site
- `_project/`, `tasks/` — notes de conception et runbooks
