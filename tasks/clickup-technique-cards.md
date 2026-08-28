# Liste ClickUp « Technique » — fiches détaillées

Contenu des 17 tâches du dossier `beyours` → liste `Technique`.
Chaque fiche se veut exécutable sans contexte extérieur : chemins réels, code réel,
commandes copiables, critère de fin.

> Les chemins `apps/reference/…` valent pour le moteur. Chaque app cliente clonée
> depuis `apps/themes/` a le même fichier au même endroit.

---

# 1. 🔴 Sécurité — Régénérer le secret Deliveroo sandbox exposé

**Priorité : urgent**

## Le problème
`DELIVEROO_CLIENT_ID` et `DELIVEROO_CLIENT_SECRET` ont été commités en dur. Le code
actuel est propre, mais les valeurs restent lisibles dans l'historique git par
quiconque clone le dépôt.

## Où
- `scripts/deliveroo-menu-scenarios.sh` — commits `7cf4d41`, `c0f09cb` (corrigé en `bc8807a`)
- `apps/restaurant-theme/e2e/deliveroo/test-config.ts` — **18 commits**, oublié du runbook d'origine

## Où la valeur est lue aujourd'hui
```
apps/reference/convex/deliverooWebhook.ts:125      const clientSecret = pkg.DELIVEROO_CLIENT_SECRET
apps/reference/convex/deliverooWebhookHandler.ts:28
apps/reference/convex/validateIntegration.ts:198
packages/core/src/env/schemas.ts:28                DELIVEROO_CLIENT_SECRET: opt(z.string().min(1))
```

## Marche à suivre
Ordre imposé : **régénérer → propager → re-vérifier → révoquer**. Jamais la valeur dans le repo.

1. Portail développeur Deliveroo → app sandbox → *Credentials* → régénérer le `client_secret`
2. Propager sur chaque magasin de secrets :
```bash
npx convex env set DELIVEROO_CLIENT_SECRET "<nouvelle_valeur>"          # dev
npx convex env set DELIVEROO_CLIENT_SECRET "<nouvelle_valeur>" --prod   # prod
gh secret set DELIVEROO_CLIENT_SECRET                                   # si utilisé en CI
# Local : apps/reference/.env.local, apps/themes/.env.local, apps/themes/.env.convex
```
3. Re-vérifier avec un webhook signé
4. Révoquer l'ancien secret dans le portail

## Critère de fin
Webhook de test signé → `200`. Payload mal signé → `401`. Ancien secret révoqué.

**Source** : `tasks/secret-rotation-runbook.md` §A.1

---

# 2. 🔴 Sécurité — Invalider la session Better Auth fuitée

**Priorité : urgent**

## Le problème
Un token de session Better Auth et un `convex_jwt` ont été commités dans
`apps/restaurant-theme/e2e/.auth/admin.json` (commit `7cf4d41`, ligne 15).
Compte de **test** : `test.owner@beindigital.fr`, sur le déploiement dev.

## Deux options

**Ciblée (recommandée)** — Convex Dashboard → composant Better Auth → table `session`
→ supprimer la ou les lignes de cet utilisateur. Le `convex_jwt` fuité expire seul.

**Radicale** — faire tourner `BETTER_AUTH_SECRET`. Invalide **toutes** les sessions et
déconnecte tout le monde. À réserver au cas où un compte réel est en doute.

> ⚠️ Ne pas confondre avec `ENCRYPTION_KEY` : celle-là chiffre les tokens OAuth stockés
> (`uberEatsConnections`). La faire tourner rend les tokens illisibles et oblige chaque
> marchand à refaire le flux de connexion OAuth.

## Critère de fin
La session de `test.owner@beindigital.fr` n'existe plus dans la table `session`.

**Source** : `tasks/secret-rotation-runbook.md` §A.2

---

# 3. 🔴 Sécurité — Purger l'historique git

**Priorité : urgent**

## Prérequis bloquant
Le secret Deliveroo doit **déjà être régénéré** (fiche 1), pour que la valeur historique
soit morte même si la purge traîne.

## Avertissements
- Réécriture d'historique = **force-push**. Tout le monde devra re-cloner.
- À faire sur un **clone frais complet**. Pas dans un worktree lié (`.git` y est un
  fichier, `filter-repo` casse).
- Rayon d'impact mesuré : **387 commits**, **4 branches distantes toutes porteuses**,
  **10 tags sur 35** portant les deux artefacts.

## Marche à suivre
```bash
brew install git-filter-repo
cd /tmp && git clone https://github.com/be-in-digital/beyours.git purge && cd purge

# Lire la valeur depuis le commit qui l'a INTRODUITE (7cf4d41), pas depuis origin/main
# où le fichier est déjà corrigé — sinon le sed ne matche rien et la purge ne fait RIEN.
git show 7cf4d41:scripts/deliveroo-menu-scenarios.sh \
  | grep -E 'DELIVEROO_CLIENT_(ID|SECRET):-' \
  | sed -E 's/.*:-([^}]+)\}.*/literal:\1==>***REDACTED***/' \
  > secrets-to-redact.txt

grep -c '^literal:.*==>' secrets-to-redact.txt   # doit afficher exactement 2

# UN SEUL appel : filter-repo refuse de tourner deux fois sur le même clone
git filter-repo \
  --replace-text secrets-to-redact.txt \
  --path apps/restaurant-theme/e2e/.auth/admin.json --invert-paths

git remote add origin https://github.com/be-in-digital/beyours.git
git branch   # vérifier : main, changeset-release/main, chore/monorepo-beyours,
             #            claude/apps-reference-architecture-0e580f
git push --force --all && git push --force --tags
rm -f secrets-to-redact.txt
```

> Le chemin `apps/restaurant-theme/…` est **volontairement conservé** : `filter-repo`
> matche les chemins tels qu'ils étaient dans les commits. Le « corriger » ne purgerait rien.

## Angle mort
Le commit `c0f09cb` porte les deux fuites et n'est atteignable que depuis deux branches
**locales** : `archive/main-avant-monorepo` et `claude/repo-structure-review-468e64`.
Un clone d'origin ne les touchera jamais. Qui les détient garde le secret.

## Critère de fin
`gitleaks detect --source . --redact` → 0 finding. Équipe prévenue de re-cloner.

**Source** : `tasks/secret-rotation-runbook.md` Partie B

---

# 4. 🚀 Uber Eats — Migration de schéma (prérequis go-live)

**Priorité : high**

## Le problème
`schemaValidation` est repassé à `true`. Tout déploiement portant des données
pré-refonte refusera le nouveau schéma tant que les lignes divergentes ne sont pas
rattrapées.

## État
✅ Résolu sur dev (`reliable-parrot-452`) le 2026-07-04.
❌ À refaire sur **chaque déploiement client** portant des données antérieures.
Les déploiements neufs ou vides n'ont besoin de rien.

## Dérives connues, corrigées sur dev
- `products` : `stock.trackStock` → `tracked`, `stock.autoDisableOnZero` → `autoDisableWhenEmpty`, `isFeatured` → `false`, `source` → `"manual"`, `tags` → `[]` (7 documents)
- `stores` : `status` `"active"` → `"open"`, `isActive` obsolète supprimé (1 document)

## Marche à suivre
```bash
# 1. Si le schéma refuse de se déployer, passer temporairement :
#    apps/reference/convex/schema.ts -> schemaValidation: false
#    puis déployer (ça embarque migrations.ts)

# 2. Audit à blanc, puis rattrapage
npx convex run migrations:auditSchemaDrift
npx convex run migrations:backfillSchemaDrift          # ajouter --prod en prod

# 3. Repasser schemaValidation: true et redéployer -- doit passer
```

> À vérifier au premier essai : `auditSchemaDrift` est un `internalQuery` et
> `backfillSchemaDrift` un `internalMutation`
> (`apps/reference/convex/migrations.ts:77` et `:102`). Selon la version de la CLI, une
> fonction interne peut exiger une syntaxe d'invocation différente.

## Critère de fin
`auditSchemaDrift` renvoie 0 dérive et le schéma se déploie avec validation active.

**Source** : `tasks/uber-eats-go-live-runbook.md` §0

---

# 5. 🚀 Uber Eats — Basculer les identifiants en production

**Priorité : high**

## Contexte
Validation sandbox **PASSÉE** au 2026-06-03. À exécuter quand Uber confirme l'accès prod.

- App prod (portail Uber) : **BeYours POS**
- Client ID prod : `RhJUZXI31BKM6QKxNJFee1AueQPgtwnn`
- Client ID sandbox : `BN3BbPRSpD7-TNs5DqC6fyq20n3rVLCF`

## Marche à suivre
Les fonctions Convex lisent l'environnement du **déploiement**, pas le `.env` local.
```bash
npx convex env set UBER_EATS_CLIENT_ID RhJUZXI31BKM6QKxNJFee1AueQPgtwnn
npx convex env set UBER_EATS_CLIENT_SECRET <secret prod, portail Uber>
npx convex env set UBER_EATS_WEBHOOK_SECRET <clé de signature prod>
npx convex env set UBER_EATS_SANDBOX_MODE false
```

Le client change d'hôte tout seul : `test-api.uber.com` → `api.uber.com`,
auth `sandbox-login` → `login`/`auth.uber.com`.

## Où le drapeau est lu
`apps/reference/convex/uberEatsActions.ts:33` → `sandboxMode: site.UBER_EATS_SANDBOX_MODE === "true"`
(et 33 autres occurrences, voir fiche 13).

## Critère de fin
`npx convex env list` montre les 4 variables, `UBER_EATS_SANDBOX_MODE=false`.

**Source** : `tasks/uber-eats-go-live-runbook.md` §1

---

# 6. 🚀 Uber Eats — Enregistrer l'URI de redirection OAuth

**Priorité : high**

## Le problème
Sans cette URI déclarée côté Uber, le flux de connexion marchand échoue en production.

## Marche à suivre
Portail développeur Uber → app **BeYours POS** → *Redirect URIs* → ajouter :
```
https://<deploiement-convex-prod>.convex.site/connect/uber-eats/callback
```
Référence sur l'app de test « Base Theme » :
`https://reliable-parrot-452.convex.site/connect/uber-eats/callback`

## Le chemin est défini ici
```
apps/reference/convex/uberEatsOAuth.ts:18   const REDIRECT_PATH = "/connect/uber-eats/callback"
apps/reference/convex/http.ts:67            path: "/connect/uber-eats/callback"
```

## À savoir
Le callback valide désormais un `state` à usage unique de 10 minutes (table `oauthStates`)
avant d'échanger le code — correctif CSRF P1 de l'audit.

## Critère de fin
`generateAuthorizeUrl` → consentement marchand → token stocké, sans erreur `redirect_uri_mismatch`.

**Source** : `tasks/uber-eats-go-live-runbook.md` §2

---

# 7. 🚀 Uber Eats — Smoke test en production

**Priorité : high**

> ⚠️ Vraies commandes, vrai argent. À faire après le déploiement Convex.

## Checklist
- [ ] OAuth : `generateAuthorizeUrl` → consentement → vérifier que le token est stocké
- [ ] `activateAndListStores` sur un vrai magasin prod → `200`
- [ ] Passer une vraie commande de test → webhook reçu → flux accept/ready → `200`
- [ ] Vérifier que la signature du webhook utilise bien le secret **de prod**

## Ce que ce déploiement embarque
Actions de commande sur `/v1/delivery/order/...`, corps deny/cancel
(`deny_reason`/`cancellation_reason` `{info,type}`), durcissement webhook v0.1 +
gestion `orders.failure`, provisioning OAuth.

## Critère de fin
Une commande réelle traversée de bout en bout, ticket cuisine créé, aucun 4xx/5xx.

**Source** : `tasks/uber-eats-go-live-runbook.md` §3-4

---

# 8. 💳 Stripe — Créer les produits live (Auto Blog)

**Priorité : high**

## Le problème
Les identifiants actuels sont en mode **test**. Aucun paiement réel n'est possible.

## Produits à créer (Dashboard Stripe en mode live, ou CLI avec `--live`)

| Plan | Mensuel | Annuel |
|---|---|---|
| Auto Blog — Starter | 9 € | 75,60 € |
| Auto Blog — Pro | 29 € | 243,60 € |
| Auto Blog — Enterprise | 79 € | 663,60 € |

## Ce qu'il faut récupérer
Les **6 `price_...` live**, qui alimentent la fiche 10.
Pour référence, les IDs de test actuels : `price_1T6zX9K8R9QQdjlQi9OztwRa` (Starter),
`price_1T6zXAK8R9QQdjlQfUGoJZxD` (Pro), `price_1T6zXBK8R9QQdjlQqzIRvk9F` (Enterprise).

## Où ils sont consommés
```
packages/convex-functions/src/bidSubscription.ts:36-39   STRIPE_BID_PRICE_STARTER / _PRO / _ENTERPRISE / _STARTER_ANNUAL
apps/reference/convex/bidSubscription.ts:179             STRIPE_BID_PRICE_MAINTENANCE
```

## Critère de fin
6 price IDs live notés, prêts à être posés en variables d'environnement.

**Source** : `tasks/production-checklist.md` §1

---

# 9. 💳 Stripe — Créer le webhook live

**Priorité : high**

## Marche à suivre
Dashboard Stripe en mode live → Webhooks → Add endpoint.

**URL** :
```
https://<domaine-convex-prod>.convex.site/webhooks/stripe-bid
```

**Événements à cocher** :
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

## Où l'endpoint est déclaré
```
apps/reference/convex/http.ts:100          path: "/webhooks/stripe-bid"
apps/reference/convex/bidStripeWebhook.ts  handler
```

## Ce qu'il faut récupérer
Le `whsec_...` généré → alimente `STRIPE_BID_WEBHOOK_SECRET` (fiche 10).

## Critère de fin
Le webhook apparaît en mode live avec les 4 événements, et un « Send test webhook »
depuis Stripe renvoie `200`.

**Source** : `tasks/production-checklist.md` §2

---

# 10. 💳 Stripe — Mettre à jour les 9 variables de facturation

**Priorité : high**

> ✅ **Débloqué par la fiche 15.** Le déploiement cible est **`robust-elephant-263`**
> — la **production** du projet `beindigital-engine`, confirmée au dashboard le
> 2026-08-28 (même projet que `reliable-parrot-452`, qui en est le dev perso
> `dev/mamadou-seck`). Le nom n'était consigné que dans un seul fichier, d'où le
> doute ; il était juste.
>
> Deux points de vigilance avant de lancer les commandes :
> - `--prod` passe par le `CONVEX_DEPLOYMENT` local, et `apps/reference` a aussi
>   été relié à un projet parasite (`beyours-reference`). Lancer
>   `pnpx convex env list --prod` **d'abord** et vérifier qu'il affiche bien
>   `robust-elephant-263`.
> - `BID_APP_URL` n'est pas une URL Convex : c'est la base des redirections
>   Stripe, donc une page publique (voir la fiche 15).

## Variables à remplacer

| Variable | Valeur cible |
|---|---|
| `STRIPE_BID_SECRET_KEY` | `sk_live_...` |
| `STRIPE_BID_WEBHOOK_SECRET` | `whsec_...` du webhook live (fiche 9) |
| `STRIPE_BID_PRICE_STARTER` | price ID Starter mensuel live |
| `STRIPE_BID_PRICE_PRO` | price ID Pro mensuel live |
| `STRIPE_BID_PRICE_ENTERPRISE` | price ID Enterprise mensuel live |
| `STRIPE_BID_PRICE_STARTER_ANNUAL` | price ID Starter annuel live |
| `STRIPE_BID_PRICE_PRO_ANNUAL` | price ID Pro annuel live |
| `STRIPE_BID_PRICE_ENTERPRISE_ANNUAL` | price ID Enterprise annuel live |
| `BID_APP_URL` | URL de prod (ex. `https://app.beindigital.fr`) |

## Commande
```bash
cd apps/reference        # pour une instance client : cd apps/themes
pnpx convex env set STRIPE_BID_SECRET_KEY "sk_live_..." --prod
# ... idem pour les 8 autres
pnpx convex env list --prod   # vérification
```

> Le `cd apps/restaurant-theme` du checklist d'origine était un chemin mort. Corrigé en PR 50.

## Critère de fin
`pnpx convex env list --prod` montre les 9 variables, aucune valeur `sk_test_`/`whsec_` de test.

**Source** : `tasks/production-checklist.md` §3

---

# 11. 💳 Stripe — Déployer les fonctions Convex en prod

**Priorité : high**

## Ordre imposé
1. Migration de schéma (fiche 4)
2. Variables d'environnement à jour (fiche 10)
3. **Puis seulement** le déploiement

Inverser l'ordre fait tourner le webhook live avec les secrets de test.

## Commande
```bash
cd apps/reference
pnpx convex deploy
```

## Critère de fin
Déploiement sans erreur, et `/webhooks/stripe-bid` répond en prod.

**Source** : `tasks/production-checklist.md` §4

---

# 12. 💳 Stripe — Tester le paiement complet avec une vraie carte

**Priorité : high**

Dernier verrou avant le lancement commercial.

## Checklist
- [ ] Checkout complet avec une vraie carte
- [ ] `checkout.session.completed` reçu par le webhook
- [ ] Abonnement créé côté Convex
- [ ] Accès effectivement débloqué pour le compte
- [ ] Si possible : provoquer un `invoice.payment_failed` et vérifier le traitement

## Critère de fin
Un paiement réel abouti et un accès ouvert, tracés de bout en bout.

**Source** : `tasks/production-checklist.md` §5

---

# 13. ⚠️ P1 — Les drapeaux sandbox basculent en production quand ils sont absents

**Priorité : normal**

## Le problème
`UBER_EATS_SANDBOX_MODE` et `DELIVEROO_IS_SANDBOX` sont testés par comparaison stricte
à la chaîne `"true"`. Non définie, la variable vaut `undefined`, la comparaison est
fausse, et le code appelle les **API de production réelles**.

## Ampleur exacte
**34 occurrences dans 22 fichiers** — et non « plus de 6 » comme l'annonce l'audit.

```
apps/{reference,themes}/convex/
  validateIntegration.ts   uberEatsActions.ts    uberEatsOAuth.ts
  uberEatsWebhook.ts       uberEatsMenuSync.ts   uberEatsImport.ts
  deliverooWebhook.ts      deliverooMenuSync.ts  deliverooOrders.ts
  deliverooImport.ts       kitchenTickets.ts
```

Exemples :
```
apps/reference/convex/uberEatsActions.ts:33   sandboxMode: site.UBER_EATS_SANDBOX_MODE === "true"
apps/reference/convex/deliverooWebhook.ts:126 const sandboxMode = site.DELIVEROO_IS_SANDBOX === "true"
apps/reference/convex/validateIntegration.ts:132 et :199
```

## Commande de contrôle
```bash
grep -rn 'SANDBOX_MODE === "true"\|IS_SANDBOX === "true"' apps packages --include='*.ts' | grep -v node_modules
```

## Palliatif actuel
Les gabarits `.env.example` mettent `true` par défaut et la doc avertit. Ça ne protège
pas un déploiement où la variable est absente.

## À trancher
Soit un helper unique à défaut sûr (`isSandbox(env)` renvoyant `true` si non défini),
soit on assume et on vérifie explicitement à chaque déploiement.

## Critère de fin
0 occurrence du test brut, et un test unitaire vérifiant qu'une variable absente donne
bien le mode sandbox.

**Source** : `tasks/production-readiness-audit.md`

---

# 14. 🔧 P2 — Durcissements listés pour suite

**Priorité : low**

Relevés dans l'audit, hors périmètre P0/P1 :

- [ ] Backoff sur 429 / rate-limit
- [ ] Échecs de `acceptOrder` avalés silencieusement
- [ ] Comparaison à temps constant sur le chemin Uber
      (voir `apps/reference/convex/deliverooWebhookHandler.ts:97` pour le pattern signature)
- [ ] Scan de déduplication non indexé
- [ ] Repli cross-store en cas d'échec de fetch
- [ ] Captures d'écran de scratch à la racine

**Source** : `tasks/production-readiness-audit.md` — P2 hardening

---

# 15. ✅ Infra — Clarifier quel déploiement Convex est la prod

**Priorité : normal** · **Fiche 10 débloquée**

## Ce qui a été produit
Un inventaire app → déploiement → projet → team dans le **README**, section
« Convex deployments » : les **six** noms qui circulent, pas trois. Les documents
qui se contredisaient ont été corrigés (`tasks/production-checklist.md`,
`apps/reference/MISE_EN_PROD.md`, `apps/site/.env.production.example`,
`tasks/convex-spending-cap-runbook.md` §2).

| Déploiement | App | Rôle | Projet |
|---|---|---|---|
| `fearless-poodle-133` | `apps/site` | **prod** (beyours.fr) | `wedilybird` |
| `capable-crocodile-720` | `apps/site` | dev | non consigné |
| `reliable-parrot-452` | `apps/reference` | dev **perso** (`dev/mamadou-seck`) | `beindigital-engine` |
| `youthful-goose-352` | `apps/reference` | dev parasite | `beyours-reference` |
| `robust-elephant-263` | `apps/reference` | **prod** du moteur (dont facturation BID) | `beindigital-engine` |
| `happy-otter-123` | `apps/site` | mort (bug #6) | — |

## Les fausses contradictions, levées
- **Trois noms de projet ≠ trois noms pour un projet.** `wedilybird`,
  `beindigital-engine` et `beyours-reference` sont trois projets Convex distincts.
  Rien n'était contradictoire ; aucun fichier ne l'avait jamais écrit.
- **Les « deux prod » ne se contredisaient pas.** `check-prod-bundle.mjs` garde le
  *bundle navigateur* de beyours.fr (`apps/site`). Les variables `STRIPE_BID_*`
  vont sur le backend du **moteur** : `apps/site/convex/` ne contient aucun
  fichier `bid*` et ne lit aucun `STRIPE_BID_*` (vérifié). Deux apps, deux
  artefacts.

## Les vraies trouvailles
- **`apps/reference` traîne un projet Convex parasite.** Son dev légitime est
  `reliable-parrot-452` (dev perso, projet `beindigital-engine`) ;
  `youthful-goose-352` vit dans un **autre** projet, `beyours-reference`, apparu
  le 2026-08-27 (#79) — signature d'un `npx convex dev` sans `CONVEX_DEPLOYMENT`,
  qui crée un projet neuf au lieu de rejoindre l'existant. Aucune variable d'env
  partagée : un `convex env set` sur l'un laisse l'autre intact.
- **Un `200` sur `/version` ne prouve pas la propriété.** Les cinq déploiements
  vivants renvoient le **même** build stamp (`20260824T183734Z-bd777bce25d6`),
  dont deux à coup sûr dans des projets différents : `/version` est servi par la
  plateforme. C'est pourquoi les rôles du tableau viennent du dashboard et non de
  la sonde — le `200` de `robust-elephant-263` ne prouvait rien, c'est le
  dashboard qui a tranché.
- **`BID_APP_URL` était du mauvais *type* de valeur**, pas juste du dev au lieu de
  la prod : c'est la base des URLs de redirection Stripe (`bidSubscription.ts:38`),
  donc une page — pas un host `.convex.site` qui ne sert que des HTTP actions.
- **Le repli e2e est retiré.** `apps/reference/e2e/deliveroo/test-config.ts` et son
  jumeau dans `apps/themes` ne retombent plus sur `reliable-parrot-452` :
  `sendWebhook()` refuse une cible vide. Au passage : la copie `apps/themes` n'a
  **aucune** garde `hasWebhookTarget` (dormant — Vitest y exclut tout `e2e/`) ;
  noté dans le fichier.

## Tranché au dashboard (2026-08-28)
**`robust-elephant-263` est bien à nous : c'est la production du projet
`beindigital-engine`**, le même projet dont `reliable-parrot-452` est le dev
perso (`dev/mamadou-seck`). Le projet ne contient que ces deux déploiements.
Conséquences :
- `tasks/production-checklist.md` avait raison depuis le début ; c'est
  `apps/reference/MISE_EN_PROD.md` §1 qui était périmé (« créer le déploiement de
  PROD » : c'était fait depuis le 2026-03-03, jamais coché). Corrigé.
- La **fiche 10 est débloquée** : cible `robust-elephant-263`, via `--prod` depuis
  `apps/reference`.
- La prod du moteur est **dans le rayon de souffle** du plafond de dépenses de la
  team : un seuil franchi coupe aussi la facturation Stripe BID.

## Rayon de souffle : bouclé
Confirmé par le propriétaire de la team le 2026-08-28 : **`beyours-reference` est
aussi sur `momoseck8`**. Donc les cinq déploiements vivants, trois projets, sont
sur **une seule team** — et le seuil de désactivation du plafond de dépenses est
le seul bouton capable de tout couper d'un coup :

| Si le seuil saute | Ce qui s'arrête |
|---|---|
| `fearless-poodle-133` | beyours.fr — le site où les prospects achètent |
| `robust-elephant-263` | les restaurants clients **et** la facturation Stripe BID |
| les trois déploiements de dev | toute l'équipe, au même instant |

Pas de seconde team en filet, aucun projet isolé. Conséquence directe pour
LAUNCH-07 : privilégier un **seuil d'alerte qu'on lit** plutôt qu'un seuil de
désactivation qui coupe la boutique et le produit ensemble
(`tasks/convex-spending-cap-runbook.md` §1 et §3).

## Ce qui reste — du ménage, pas un blocage
- **Supprimer le projet `beyours-reference` ?** Il ne contient qu'un déploiement de
  dev parasite (`youthful-goose-352`, 2026-08-27) dont rien ne dépend, et il
  consomme les mêmes ressources incluses que la prod. Le supprimer retire au
  passage une façon de pointer un checkout sur le mauvais backend.
- **Le projet de `capable-crocodile-720`** n'a jamais été consigné (c'est le dev de
  `apps/site`, donc `wedilybird` attendu — non vérifié).

---

# 16. 🔑 Comptes — Créer les comptes tiers sous developers@beyours.fr

**Priorité : urgent**

## Prérequis
La boîte `developers@beyours.fr` doit exister et être relevée : chaque inscription envoie
une vérification, et plusieurs fournisseurs y envoient les codes de récupération.

## Règle de propriété
**Niveau package** (BeYours détient, partagé entre tous les clients) → sous `developers@beyours.fr` :
AWS, OpenAI, Uber Eats, Deliveroo.

**Niveau site** (le restaurant détient, un par client) → **ne pas** créer sous cette adresse,
ils suivent le client s'il part : son Convex, son Stripe/PayPal/SumUp, son bucket S3,
son expéditeur SES, son DSN Sentry, sa clé Maps.

## Les 18 services
- **Infra** : GitHub (org + Packages privés + budget Actions), Convex, Vercel, AWS (S3 + SES), domaine/DNS `beyours.fr`
- **Paiement** : Stripe (2 flux distincts), PayPal, SumUp, Square
- **Livraison** : Uber Eats (app « BeYours POS » — confirmer qui la détient), Deliveroo, Uber Direct
- **Site commercial** : Yousign, Calendly, Resend
- **Contenu/IA** : OpenAI, Unsplash
- **Monitoring** : Sentry, Google Maps Platform

## À trancher avant de créer
Deux marques, deux adresses. BeYours = produit, BeInDigital = agence. Certains comptes
existent déjà sur `hello@beindigital.fr` (le workspace ClickUp notamment). Décider
service par service pour éviter les doublons.

## Bloquants connus
- SES démarre **en sandbox** (eu-west-3) : demande de sortie obligatoire pour écrire à de vrais clients
- Stripe live est conditionné au chantier facturation/TVA (`apps/site/MISE_EN_PROD.md` §2-3)

**Source** : `tasks/production-accounts-checklist.md`

---

# 17. 🛡️ Sécurité — 43 vulnérabilités de dépendances restantes

**Priorité : high**

## Déjà fait
- `@auth/core` 0.37.4 → **0.41.3** (critique GHSA-xmf8-cvqr-rfgj, CVSS 7.5). Impossible
  seul : `@convex-dev/auth@0.0.91` exigeait le peer `^0.37.0`. Bump couplé vers **0.0.95**.
- **Lot A** : 15 overrides transitifs → **111 avis ramenés à 43**. Build vérifié 10/10.

## Reste, une PR par ligne

**1. `next` → 16.2.12** — 28 avis, verdict SAFE.
Dérive de versions à corriger : `apps/site` est en 16.2.4 mais `apps/reference` et
`apps/themes` sont en **16.1.6**, donc aussi exposées aux 5 avis `<16.1.7`.
`eslint-config-next` doit monter en verrou dans les trois apps.

**2. `better-auth` 1.4.9 → 1.6.29** — 11 avis, mais **moins urgent qu'il n'y paraît** :
10 des 11, dont le critique, sont dans des plugins jamais chargés (oidc-provider, mcp,
oauth-provider, organization, magic-link). Seul **GHSA-p6v2-xcpg-h6xw** mord
(contournement du rate-limit en IPv6), corrigé dès 1.4.17.
- Bump couplé obligatoire : `@convex-dev/better-auth` `^0.10.10` → `^0.12.5`
- ⚠️ **Risque réel** : les tables `passkey`/`twoFactor` sortent du composant Convex en
  0.11. Un schéma qui rétrécit **échoue s'il reste des lignes**. À vérifier sur chaque
  déploiement, y compris chaque client cloné.
- Migration officielle : `npx auth upgrade`

**3. `sanitize-html` → 2.17.7** — 2 avis, trivial, dans `apps/reference` et `apps/themes`.

**4. `vitest` → 3.2.7** — 1 avis critique, mais devDependency qui ne remonte en `--prod`
que via un peer de `better-auth`. Exposition réelle faible.

**5. `sharp` → 0.35.3** — **en dernier**, sous réserve : `next` déclare
`optionalDependencies.sharp: "^0.34.5"`, la compat avec l'optimiseur d'images n'est pas
établie.

## Commande de mesure
```bash
export NODE_AUTH_TOKEN="$(gh auth token)"
pnpm audit --prod --audit-level high
```

## Critère de fin
`pnpm audit --prod --audit-level high` sort en 0, et le job CI `pnpm audit` passe au vert.
