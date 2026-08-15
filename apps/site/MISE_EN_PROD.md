# Mise en production — Be in Digital Restauration (site de vente)

Ce qui reste pour **vendre et encaisser pour de vrai** sur `web-restaurant` (le
site qui commercialise le produit). Le pendant côté produit livré au client est
`apps/restaurant-theme/MISE_EN_PROD.md` — ne pas confondre.

État : le socle commercial est **~70 % réel** (checkout Stripe, webhooks
idempotents et signés, abonnements, parrainage + versement Connect, offre
fondateurs). Ce qui suit sont les trous à combler, classés par gravité.
Le déroulé de vente lui-même est dans `PROCESS_DE_VENTE.md`.

Légende : 🔴 bloque l'ouverture de la vente · 🟠 à faire vite après · 🟡 confort.
Chaque item marque **[décision]** (choix humain) ou **[build]** (à coder) ou
**[config]** (paramétrage/compte).

---

## 1. Paiement Stripe — passer en réel

- [ ] 🔴 **[config] Basculer Stripe en mode Live** : `STRIPE_SECRET_KEY` en
  `sk_live_…`, recréer le webhook sur l'endpoint prod, mettre `STRIPE_WEBHOOK_SECRET`
  à jour. Aujourd'hui, clé absente = commande marquée `paid` sans Stripe (mode test).
- [ ] 🔴 **[config] Vérifier les 4 Price IDs de maintenance** (`price_1TEn…` dans
  `convex/stripe.ts:28-33`) : confirmer dans le dashboard qu'ils existent bien en
  **Live mode**, pas seulement en test. Recréer côté Live si besoin.
- [ ] 🟠 **[build] Dunning (paiement échoué)** : aujourd'hui `invoice.payment_failed`
  laisse la facture `open` et ne fait rien. Activer la relance Stripe (Smart
  Retries dans le dashboard) + un email de relance au client. Sinon un
  renouvellement qui échoue passe inaperçu.
- [ ] 🟡 **[build] Remboursements** : aucun flux refund. Ajouter une action admin
  (annulation création avant go-live, geste commercial). Peut attendre le 1ᵉʳ cas.

## 2. Facturation conforme (droit français) — 🔴 bloquant pour facturer

Aujourd'hui la « facture » = le PDF hébergé par Stripe. Insuffisant légalement.

- [ ] 🔴 **[décision] Entité + mentions** : figer la structure émettrice (SASU
  validée d'après les décisions projet), SIRET, RCS, adresse siège, capital.
- [ ] 🔴 **[build] Facture PDF en marque propre** : numérotation **séquentielle
  et continue** (obligation FR), mentions légales, détail des prestations
  (création vs maintenance), date, coordonnées client. Générer à la réception du
  webhook `invoice.payment_succeeded` (le champ `invoicePdfUrl` stocke actuellement
  le PDF Stripe — le remplacer par le PDF maison).
- [ ] 🔴 **[décision] TVA** : rester en **franchise en base** (art. 293 B, TVA à 0,
  état actuel) OU passer au réel. Si passage : activer Stripe Tax (dashboard +
  immatriculation), `tax_behavior=exclusive` sur les Prices, `STRIPE_TAX_ENABLED=true`
  (Convex) et `NEXT_PUBLIC_TVA_ENABLED=true` (Next). Le code est déjà prêt pour ce flip.
- [ ] 🟠 **[build] Facturation électronique 2026-2027** : anticiper l'obligation
  Plateforme Agréée (l'adaptateur enfichable existe déjà côté web-agency ; prévoir
  le même ici avant 09/2027).

## 3. Contrats & signature

- [ ] 🔴 **[config] YouSign en prod** : `YOUSIGN_API_KEY` de production (aujourd'hui
  défaut sandbox `api-sandbox.yousign.app/v3`).
- [ ] 🔴 **[build] Vérifier la signature du webhook YouSign** : `convex/http.ts:476`
  porte un `TODO` — le webhook n'est pas vérifié. Implémenter la vérification HMAC +
  `YOUSIGN_WEBHOOK_SECRET`. Trou de sécurité tant que non fait.
- [ ] 🟠 **[décision] Contrat client** : la signature YouSign est câblée pour les
  **apporteurs**. Décider si la **prestation client** (création + maintenance)
  passe par un contrat signé avant go-live, et brancher le même flux si oui.

## 4. Parcours de vente — combler les trous (détail dans PROCESS_DE_VENTE.md)

- [x] ✅ **Formulaire `/contact` réparé** (2026-07-19) : branché sur
  `contactLeads.submit` → persiste le lead + email de confirmation au prospect +
  email de notification à l'équipe. Leads visibles dans `/admin/prospects`
  (section « Messages de contact »). Ne fuit plus.
- [x] ✅ **Emails transactionnels branchés** (2026-07-19) : confirmation de
  commande (`checkout.session.completed`), reçu de renouvellement
  (`invoice.payment_succeeded`, vrais renouvellements), relance dunning
  (`invoice.payment_failed`), + bienvenue/versement affiliés. Système brandé
  (`convex/email/`), envoi SES best-effort (ne bloque jamais un webhook), testé
  (10 tests). **Reste** : configurer SES + les env vars (§7) pour l'envoi réel.
- [ ] 🟠 **[build] Page de suivi / mini-portail client** : une page où le client
  retrouve sa commande, sa facture, l'état de mise en ligne, et les ressources
  d'onboarding. Aujourd'hui `/checkout/success` = un simple bouton Calendly.

## 5. Provisioning & flotte (voir aussi PROCESS_DE_VENTE.md §5)

Le provisioning est **100 % manuel**, et **c'est acceptable au volume visé**
(≤ ~20-30 clients). Ne pas sur-industrialiser maintenant. À faire quand même :

- [ ] 🟠 **[build] Lier commande → déploiement** : `saDeployments.orderId` existe
  mais n'est jamais rempli. Passer l'`orderId` dans le formulaire « Provisionner »
  pour tracer paiement → instance (audit + suivi).
- [ ] 🟡 **[build] Monitoring réel** : `saMonitoringChecks` est une table vide de
  sens sans boucle. Ajouter un cron (toutes les 5-10 min) qui ping chaque instance
  `live` et enregistre un check. À faire quand il y aura plusieurs instances.
- [ ] 🟡 **[décision] Automatisation du provisioning** : à repousser jusqu'à ~20-30
  clients. Le runbook manuel (PROCESS_DE_VENTE.md §5) suffit d'ici là.

## 6. Légal & conformité — 🔴 obligatoire avant d'encaisser

- [ ] 🔴 **[build] Pages légales absentes** : aucune CGV, mentions légales, ni
  politique de confidentialité sur le site. Obligatoires pour vendre en France.
  Créer les 3 pages + liens footer.
- [ ] 🔴 **[décision] CGV de prestation** : durée, livraison, maintenance,
  résiliation, propriété du site à la fin, rétractation (ou son exclusion en B2B).
- [ ] 🟠 **[build] RGPD** : mentionner la collecte (leads, clients, gagnants du jeu),
  cookies si analytics ajouté, durées de rétention.

## 7. Déploiement du site de vente lui-même

- [ ] 🔴 **[config] Convex prod + Vercel** pour `web-restaurant` (l'app de vente),
  avec toutes les env vars Live (Stripe, YouSign, AWS SES, Calendly).
- [ ] 🔴 **[config] Domaine** de la vitrine (ex. `beyours.fr`) +
  `/decouvrir` public (le lien envoyé aux prospects).
- [ ] 🟠 **[config] Emails transactionnels** : le système est construit et branché
  (§4). Pour l'activer en réel, poser les env vars sur le déploiement Convex de
  web-restaurant : `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
  `AWS_SES_FROM_EMAIL` (expéditeur vérifié), `BID_NOTIFY_EMAIL` (boîte équipe pour
  les leads), `SITE_URL` (liens + logo absolus), `CALENDLY_URL` (optionnel, bouton
  rdv). Puis **sortir SES du sandbox** (eu-west-3) pour livrer aux vrais clients.
- [ ] 🟡 **[config] Analytics** : brancher un suivi conversion (déjà PostHog dans
  l'org) sur le funnel tarifs → checkout → paiement, pour piloter.
- [ ] 🟠 **[config] Email — provider au choix (SES OU Resend)** : `deliver()` est
  désormais multi-provider (`convex/email/providers.ts`). Défaut = SES (rien ne
  change). Pour NE PAS gater le lancement sur la sortie de sandbox AWS (déjà
  refusée), poser sur le Convex prod : `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`,
  `RESEND_FROM_EMAIL` (domaine vérifié chez Resend, approuvé en jours). Les
  instances clients restent sur SES.

### Checklist cutover env (anti-récidive bug #6)

Les `NEXT_PUBLIC_*` sont **inlinées au `next build`** ; changer la variable Vercel
ne suffit pas, il faut re-builder. Valeurs de prod dans `.env.production.example`.

- [ ] 🔴 **[config]** Poser `NEXT_PUBLIC_CONVEX_URL=https://fearless-poodle-133.convex.cloud`
  (+ `…_CONVEX_SITE_URL`, `…_SITE_URL`) sur l'env **Production** Vercel.
- [ ] 🔴 **[config] REBUILD SANS CACHE** (Vercel → Redeploy, **décocher** « Use
  existing Build Cache »). Un redeploy simple réutilise l'ancien bundle et NE
  ré-inline PAS.
- [ ] 🔴 **[config]** Vérifier le bundle servi :
  `node scripts/check-prod-bundle.mjs https://beyours.fr` → doit
  finir sur **✓** (exit 0).
- [ ] 🔴 **[config]** Ouvrir `/decouvrir` en **navigation privée** → **200** +
  données live (un chargement infini = URL Convex morte).

---

## Ordre recommandé

1. **Bloquer la fuite** : formulaire `/contact` + email post-paiement (§4) — cheap,
   gros impact, chaque prospect perdu coûte cher à ce stade.
2. **Rendre l'encaissement légal** : facture PDF conforme + pages légales +
   décision TVA (§2, §6).
3. **Passer Stripe/YouSign en Live** et vérifier les Price IDs (§1, §3).
4. **Déployer** web-restaurant en prod + SES hors sandbox (§7).
5. **Le reste** (portail client, monitoring, dunning fin, automatisation
   provisioning) au fil des premières ventes.

Les **décisions** qui te reviennent (personne d'autre ne peut les prendre) :
statut TVA, contrat client signé ou non, entité émettrice des factures, et le
seuil à partir duquel on automatise le provisioning.

---

**Version** : 1.0 · **Créé** : 2026-07-19 · basé sur l'audit du code réel.
