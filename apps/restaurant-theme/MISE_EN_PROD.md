# Mise en production — restaurant-theme

Checklist de tout ce qui reste à faire **par toi** pour passer officiellement en prod.
État au 18/07/2026 : le code est prêt (type-check 18/18, tests verts, flow jeu QA de bout
en bout, dashboard audité et corrigé). Tout ce qui suit est de la configuration, des
comptes, du légal et des décisions — pas du code.

---

## 1. Infrastructure & déploiements

- [ ] **Créer le déploiement Convex de PRODUCTION** (`npx convex deploy` depuis
  `apps/restaurant-theme`). Aujourd'hui tout tourne sur le dev
  `dev:reliable-parrot-452` (team momoseck8, projet beindigital-engine).
- [ ] **Reporter les env vars sur le déploiement prod Convex** (`npx convex env set` ×
  chaque clé du dev, avec les valeurs LIVE, pas les valeurs de test) — voir sections
  suivantes pour celles qui changent.
- [ ] **`BID_APP_URL` et `SITE_URL`** sur le déploiement prod = l'URL publique réelle du
  restaurant (aujourd'hui `http://localhost:3000`). C'est ce qui fabrique les liens des
  tickets gagnants dans les emails.
- [ ] **Déployer le front** (Vercel) avec `NEXT_PUBLIC_CONVEX_URL`,
  `NEXT_PUBLIC_CONVEX_SITE_URL`, `CONVEX_SITE_URL` (les 3 !), `CONVEX_DEPLOYMENT`,
  `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` = domaine public. Piège rencontré en dev :
  `CONVEX_SITE_URL` manquant ⇒ toute l'auth renvoie 500.
- [ ] **Domaine** : DNS, HTTPS, et mettre le domaine dans `trustedOrigins`
  (`convex/auth.ts` lit `SITE_URL` — vérifier après déploiement qu'on peut se connecter).
- [ ] **Plafond de dépenses Convex** : vérifier le spending cap de la team — un cap trop
  bas **coupe TOUS les projets de la team** (déjà vécu). Mettre une alerte plutôt qu'un
  cap serré.

## 2. Emails (AWS SES)

- [ ] **Sortir SES du sandbox** (console AWS eu-west-3 → SES → Request production
  access). Aujourd'hui : seules les adresses vérifiées reçoivent des emails ⇒ les emails
  de vérification de compte, reset password, **tickets gagnants du jeu** et notifications
  ne partent pas vers de vrais clients.
- [ ] **Vérifier le domaine d'envoi** dans SES (DKIM) + SPF/DMARC sur le DNS, et aligner
  `AWS_SES_FROM_EMAIL` (aujourd'hui `noreply@beindigital.fr`) sur un domaine vérifié.
- [ ] Tester en réel : inscription (email de vérification), reset password, gain au jeu.

## 3. Paiements

- [ ] **Stripe : passer en clés LIVE** (`STRIPE_SECRET_KEY` actuel = `sk_test…`), recréer
  les webhooks sur l'endpoint prod et mettre à jour `STRIPE_WEBHOOK_SECRET` +
  `STRIPE_BID_WEBHOOK_SECRET`, recréer les Price IDs live (tous les `STRIPE_PRICE_*` et
  `STRIPE_BID_PRICE_*` actuels sont des prix de test).
- [ ] PayPal : passer l'app en live (client ID/secret actuels = sandbox).
- [ ] SumUp / Square si utilisés par le client : idem, credentials production.
- [ ] Un paiement réel de bout en bout sur chaque moyen activé (petite commande, puis
  remboursement depuis l'admin).

## 4. Intégrations livraison

- [ ] **Uber Eats** : `UBER_EATS_SANDBOX_MODE=true` aujourd'hui → passer en prod exige la
  **validation de l'app par Uber** (dossier en cours, cf. mémoire projet : scopes +
  redirect URI à enregistrer dans le portail Uber avec le domaine prod).
- [ ] **Deliveroo** : `DELIVEROO_IS_SANDBOX=true` → basculer les credentials en live +
  re-vérifier le webhook secret sur l'URL prod.
- [ ] Refaire un import de menu + une commande test sur chaque plateforme après bascule.

## 5. Données & comptes

- [ ] **Purger les données de test** du déploiement de prod avant ouverture : commandes
  `#TEST-*` / `#UE-*` à 0,00 €, jeux « Test Game »/« Carte test », lots de test, parties
  `gamePlays`/`prizeRedemptions` de QA, produits « Delicious … », code promo « TEXT ».
  (Si la prod part d'un déploiement vierge, rien à faire — ne PAS cloner le dev.)
- [ ] **Compte QA** : `qa-claude@beindigital.local` existe sur le DEV (rôle client_admin,
  mot de passe `QaImpeccable2026!`) — utile pour tes tests, à ne pas recréer en prod.
- [ ] **Compte du restaurateur** : créer le compte owner réel, vérifier l'email, dérouler
  l'onboarding (le tour guidé fonctionne — bug corrigé le 18/07).
- [ ] **Établissement** : passer le store de `draft` à `open`, horaires réels, adresse
  géocodée, moyens de paiement activés.

## 6. Gamification (nouveau flow)

- [ ] Créer les vrais jeux + lots + ratio de victoire voulu, **vérifier qu'au moins un
  lot est en stock** (sans stock, personne ne peut gagner — l'admin l'affiche désormais).
- [ ] Configurer les **actions requises** avec les VRAIS liens (page d'avis Google,
  Instagram…) — champ URL dans Gamification → Actions.
- [ ] **Imprimer les QR** : Gamification → Codes QR → bouton PNG par table, imprimer,
  plastifier, poser. Le lien encodé pointe sur le domaine depuis lequel tu télécharges
  le PNG : télécharge-les depuis la PROD, pas depuis localhost.
- [ ] Former le staff à la validation : scanner le QR du ticket client (bouton « Valider
  ce lot » apparaît si connecté) ou taper le code dans Gamification → Gagnants.
- [ ] **Légal jeu-concours (France)** : rédiger un règlement de jeu (gratuit sans
  obligation d'achat, dotations, dates), le rendre accessible depuis la page du jeu,
  et mentionner la collecte de données (prénom/nom/email/téléphone) dans la politique de
  confidentialité. Le formulaire affiche déjà « Vos coordonnées servent uniquement à vous
  remettre votre lot » — la politique doit le couvrir.

## 7. Légal & RGPD

- [ ] Mentions légales, CGV/CGU, politique de confidentialité, bannière cookies si
  analytics ajouté.
- [ ] Registre des traitements : commandes (données clients), jeu (coordonnées gagnants,
  empreinte appareil pour l'anti-triche 24 h), emails marketing (consentement).
- [ ] Durées de rétention : gamePlays/redemptions expirés, commandes.

## 8. QA finale sur le vrai environnement

- [ ] **Jouer au jeu sur de vrais téléphones** (iPhone Safari + Android Chrome) : sons
  (débloqués au premier tap), vibrations (Android seulement — normal), roue fluide,
  grattage au doigt, email reçu, QR du ticket scannable par l'appareil photo.
- [ ] Passer une commande réelle de bout en bout : storefront → paiement → KDS cuisine →
  statuts → notification.
- [ ] Lancer la suite e2e (`pnpm test:e2e`) sur un environnement de staging avec auth
  configurée (le spec Gamification a été réaligné sur la nouvelle interface le 18/07).
- [ ] Vérifier l'admin sur mobile/tablette (le KDS sert souvent sur tablette en cuisine).

## 9. Ops & suivi

- [ ] Sauvegardes : activer les backups Convex (snapshot export planifié) sur la prod.
- [ ] Monitoring : alertes sur erreurs Convex (dashboard → Logs), uptime du front.
- [ ] Rotation des secrets copiés du dev vers la prod (le dev a beaucoup circulé — les
  clés AWS/Stripe test ne doivent PAS être réutilisées telles quelles en live).
- [ ] Nettoyer/committer la branche : les changements du 16-18/07 (jeu complet, refonte
  Gamification admin, corrections P0 dashboard, override pnpm `convex`) sont dans le
  working tree de `doums85/maintenance-renewal-migration` — à committer et merger.

---

### Corrections livrées pendant l'audit du 18/07 (pour mémoire)

1. **P0** — Le dashboard crashait pour tout nouvel utilisateur (tour d'onboarding monté
   hors du SidebarProvider) : corrigé (`useOptionalSidebar`).
2. **P0** — Double copie de `convex` (1.34.1 dans packages/admin vs 1.31.7 dans l'app) ⇒
   `useQuery` sans provider : override pnpm `"convex": "1.31.7"` ajouté à la racine.
3. **P0** — Métrique « Commandes actives : 97 » absurde : bornée aux 24 h et renommée
   « À traiter (24h) ».
4. **P0** — Timers KDS « 2237h 47m » : plafonnés à « +24h ».
5. **P1** — Page Commandes sans pagination (des centaines de lignes) : paginée (15/page).
6. **IA Gamification** : 3 impasses « ComingSoon » remplacées par de vraies pages (vue
   d'ensemble, Jeux & Lots avec toggles actif/stock, **Codes QR imprimables avec vrais
   QR + compteur de scans + copie de lien**) ; « Paramètres » retiré de la nav.
7. Nav honnête : « Clients » et « Composants » retirés de la nav tant que non construits.
8. Statut d'établissement « draft » traduit (« Brouillon »), statuts de lots expirés
   corrigés pour l'ancien statut `claimed`, auth locale : `localhost:3001-3003` ajoutés
   aux origins de confiance.
