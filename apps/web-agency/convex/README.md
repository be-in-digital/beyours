# Convex — Be in Digital Agency

Déploiement Convex **séparé** de celui du restaurant (Decision Log #13 + #21).

## Init manuel (one-time, par le founder)

```bash
cd apps/agency
pnpm dlx convex dev
```

Lors de la première exécution :

1. Choisir **"create a new project"** (NE PAS réutiliser le projet resto)
2. Nommer le projet `beindigital-agency` (ou similaire)
3. Choisir le team Convex existant
4. Le CLI génère :
   - `apps/agency/convex/_generated/`
   - `apps/agency/.env.local` avec `CONVEX_DEPLOYMENT=...` et `NEXT_PUBLIC_CONVEX_URL=...`

## Variables Vercel à configurer

Sur le projet Vercel `beindigital-agency` :

| Variable | Source |
|----------|--------|
| `CONVEX_DEPLOYMENT` | Convex dashboard projet agency |
| `NEXT_PUBLIC_CONVEX_URL_AGENCY` | URL HTTP du déployment |
| `CONVEX_DEPLOY_KEY` | Convex dashboard → Deploy Keys |

⚠️ **Toujours préfixer `AGENCY_*`** pour éviter la confusion avec les vars du resto (Decision Log #25, security review).

## Tables

- `contactSubmissions` — formulaire contact (anti-spam BotID + honeypot + rate limit)

Pas d'autres tables prévues. Le contenu (case studies, products) est en **MDX build-time** via `next-mdx-remote` (Decision Log #21).
