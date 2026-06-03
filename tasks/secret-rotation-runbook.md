# Runbook — Rotation des secrets & purge de l'historique git

> Procédure opérationnelle suite à l'audit production. Ce fichier ne contient
> **aucun secret** : les valeurs sont extraites de l'historique au moment de la
> purge, ou saisies par toi dans les portails. Ne jamais committer de secret.

## Contexte (ce qui a fuité)

| Élément | Où | Gravité | Action |
|---------|-----|---------|--------|
| `DELIVEROO_CLIENT_ID` + `DELIVEROO_CLIENT_SECRET` (sandbox) | en dur dans `scripts/deliveroo-menu-scenarios.sh`, présent dans l'historique git | Élevée | Régénérer + purger l'historique |
| Token de session Better Auth + `convex_jwt` | `apps/restaurant-theme/e2e/.auth/admin.json`, dans l'historique | Moyenne (compte de test) | Invalider la session + purger le fichier |

> Le code actuel ne contient plus ces valeurs (corrigé sur la branche d'audit),
> mais **supprimer un fichier ne purge pas l'historique** : les commits passés
> les exposent toujours tant que l'historique n'est pas réécrit.

---

## Partie A — Rotation des secrets

Ordre général pour **tout** secret : **régénérer → propager partout → re-vérifier → révoquer l'ancien**. Ne jamais mettre la valeur dans le repo.

### A.1 — Deliveroo (sandbox), prioritaire

1. **Régénérer** : Deliveroo Developer Portal → ton app sandbox → *Credentials* → régénérer le `client_secret`.
2. **Propager** la nouvelle valeur dans chaque store qui en a besoin :
   ```bash
   # Convex (runtime des webhooks/actions) — sur CHAQUE déploiement
   npx convex env set DELIVEROO_CLIENT_SECRET "<nouvelle_valeur>"          # dev
   npx convex env set DELIVEROO_CLIENT_SECRET "<nouvelle_valeur>" --prod   # prod
   # Vercel (si lu côté Next) : Dashboard → Settings → Environment Variables
   # GitHub (si un jour utilisé en CI) : gh secret set DELIVEROO_CLIENT_SECRET
   # Local : apps/restaurant-theme/.env.local (jamais committé)
   ```
3. **Re-vérifier** : envoyer un webhook signé de test (voir option 3 de l'audit : simulateur de webhooks) → doit répondre `200` ; un payload mal signé → `401`.
4. **Révoquer** l'ancien secret dans le portail une fois le trafic sain.

### A.2 — Invalider la session Better Auth fuitée

C'est un compte **de test** (`test.owner@beindigital.fr`) sur le déploiement dev :

- **Option simple (ciblée)** : Convex Dashboard → table `session` du composant Better Auth → supprimer la/les ligne(s) de ce user (et/ou supprimer le user de test). Le `convex_jwt` fuité expire de lui-même.
- **Option radicale** : faire tourner `BETTER_AUTH_SECRET` (invalide **toutes** les sessions/JWT → déconnecte tout le monde). À réserver si un doute existe sur un compte réel.

### A.3 — Référence : où vit chaque secret (pour les rotations futures)

| Secret | Convex env | Vercel env | GitHub Secrets | `.env.local` |
|--------|:---------:|:----------:|:--------------:|:------------:|
| `UBER_EATS_CLIENT_SECRET` / `_WEBHOOK_SECRET` | ✅ | — | (E2E_*) | ✅ |
| `DELIVEROO_CLIENT_SECRET` / `_WEBHOOK_SECRET` | ✅ | — | (E2E_*) | ✅ |
| `STRIPE_*`, `PAYPAL_*`, `SUMUP_*` | ✅ | ✅ | — | ✅ |
| `AWS_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` | ✅ | ✅ | (E2E_*) | ✅ |
| `OPENAI_API_KEY` | ✅ | — | (E2E_*) | ✅ |
| `BETTER_AUTH_SECRET` | ✅ | ✅ | (E2E_*) | ✅ |
| `ENCRYPTION_KEY` | ✅ | ✅ | (E2E_*) | ✅ |

> ⚠️ **`ENCRYPTION_KEY`** chiffre les tokens OAuth stockés (`uberEatsConnections`).
> Le faire tourner rend les tokens existants illisibles → les marchands devront
> **relancer le flux OAuth de connexion**. À planifier, pas à improviser.

---

## Partie B — Purge de l'historique git

> ⚠️ **Réécriture d'historique = force-push.** À coordonner avec l'équipe : tout
> le monde devra **re-cloner**. Fais-le sur un **clone neuf complet**, PAS dans le
> workspace Conductor (worktree lié, `.git` est un fichier → filter-repo casse).
> Pré-requis : le secret Deliveroo doit déjà être **régénéré** (Partie A.1), pour
> que la valeur historique soit morte même si la purge tarde.

### B.1 — Préparer un clone neuf + l'outil

```bash
brew install git-filter-repo          # ou: pipx install git-filter-repo
cd /tmp && git clone git@github.com:be-in-digital/<repo>.git purge && cd purge
```

### B.2 — Générer le fichier de remplacement depuis l'historique (aucun secret saisi à la main)

Ce one-liner lit l'ancienne version du script et écrit `secrets-to-redact.txt`
au format attendu par git-filter-repo, sans que tu copies la valeur :

```bash
git show origin/main:scripts/deliveroo-menu-scenarios.sh \
  | grep -E 'DELIVEROO_CLIENT_(ID|SECRET):-' \
  | sed -E 's/.*:-([^}]+)}.*/literal:\1==>***REDACTED***/' \
  > secrets-to-redact.txt

# Contrôle (n'affiche que la structure, pas la valeur) :
sed -E 's/literal:.*==>/literal:<masqué>==>/' secrets-to-redact.txt
# Doit afficher 2 lignes "literal:<masqué>==>***REDACTED***"
```

> `secrets-to-redact.txt` est déjà dans `.gitignore`. Supprime-le après la purge.

### B.3 — Réécrire l'historique

```bash
# 1) Remplacer les valeurs de secret dans TOUT l'historique
git filter-repo --replace-text secrets-to-redact.txt

# 2) Supprimer le fichier d'auth state fuité de TOUT l'historique
git filter-repo --path apps/restaurant-theme/e2e/.auth/admin.json --invert-paths
```

### B.4 — Republier + nettoyer

```bash
git remote add origin git@github.com:be-in-digital/<repo>.git   # filter-repo retire le remote par sécurité
git push --force --all
git push --force --tags
rm -f secrets-to-redact.txt
```

Puis : prévenir l'équipe de **re-cloner** (les anciens clones gardent l'historique
fuité), et re-baser/fermer-rouvrir les PR ouvertes si nécessaire. GitHub peut
garder des vues en cache quelques temps ; ouvrir un ticket support GitHub si le
repo est public et qu'une purge immédiate du cache est requise.

> Alternative : [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
> (`bfg --replace-text secrets-to-redact.txt` + `bfg --delete-files admin.json`).
> git-filter-repo est l'outil recommandé aujourd'hui.

---

## Checklist

- [ ] A.1 Deliveroo secret régénéré dans le portail
- [ ] A.1 Propagé : Convex (dev + prod), Vercel, GitHub (si CI), `.env.local`
- [ ] A.1 Webhook signé de test → `200` ; mal signé → `401`
- [ ] A.1 Ancien secret Deliveroo révoqué
- [ ] A.2 Session Better Auth fuitée supprimée (ou `BETTER_AUTH_SECRET` tourné)
- [ ] B Purge d'historique faite sur un clone neuf + force-push
- [ ] B Équipe prévenue de re-cloner ; PR ouvertes traitées
- [ ] B `secrets-to-redact.txt` supprimé
- [ ] Propriétaire + cadence de rotation définis (rotation périodique)
