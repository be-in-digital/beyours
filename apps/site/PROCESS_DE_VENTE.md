# Process de vente — Be in Digital Restauration

La procédure qui manquait : comment on passe d'un restaurateur inconnu à un
client payé, en ligne et sous maintenance. Elle décrit **ce qui est déjà câblé
dans le produit**, **ce qui reste manuel**, et **qui fait quoi**.

Modèle de vente : **B2B assisté**, pas self-serve pur. Le checkout Stripe
fonctionne en autonomie, mais à 3 500-7 500 € le panier, la vente se gagne en
démo, pas au clic. Le self-serve sert de rampe de paiement, pas de canal
d'acquisition. Cadre GTM validé : porte-à-porte Bordeaux, cible = restaurants
déjà sur Uber Eats, accroche « 0 % de commission, récupérez vos clients »,
démo pré-remplie. Objectifs réalistes : 3-5 clients à 90 jours, 25-40 à 12 mois.

> À ce volume, **le provisioning manuel est le bon choix** — ne pas industrialiser
> l'automatisation tant qu'on n'a pas dépassé ~20-30 clients. Ce qu'il faut, c'est
> un runbook répétable (§5), pas un pipeline CI/CD de déploiement.

---

## Les 7 étapes

### 1. Prospection
**Qui** : commercial / fondateur · **Outil** : terrain + fichier prospects

- Cible stricte : resto déjà sur Uber Eats / Deliveroo (douleur commission réelle).
- Accroche unique : « Combien vous prend Uber Eats sur chaque commande ? Et si
  ces clients devenaient les vôtres, sans commission ? »
- Sortie de l'étape : un rendez-vous démo posé (Calendly).

### 2. Qualification & démo
**Qui** : commercial · **Outil** : `/decouvrir` (démo jouable) + Calendly (déjà câblés)

- Envoyer le lien `/decouvrir` AVANT le rdv (jeu de fidélité + KDS jouables).
- En rdv : dérouler la démo pré-remplie au nom du resto, montrer le storefront
  sans commission, la roue de fidélité, le back-office.
- Qualifier : nombre d'établissements, volume Uber Eats, qui décide, budget.
- Sortie : plan pressenti (Essentielle 3 500 € / Premium 7 500 €) + offre
  fondateurs si éligible (10 places à 2 500 €, compteur temps réel sur `/tarifs`).

### 3. Proposition
**Qui** : commercial · **Outil** : page `/tarifs` + devis

- Prix HT (franchise en base, pas de TVA aujourd'hui — voir MISE_EN_PROD.md).
- Poser le cadre maintenance : 1ʳᵉ année incluse dans la création, puis
  1 000 €/an (Essentielle) ou 2 000 €/an (Premium), mensualisable.
- Leviers : offre fondateurs (contreparties = étude de cas + témoignage + droit
  de référence), paiement création en 3-4× (Alma/Klarna, déjà au checkout),
  parrainage (−10 % création, 500 € au parrain).
- Sortie : accord verbal + email récap avec le lien de commande.

### 4. Signature & paiement
**Qui** : client · **Outil** : `/checkout?plan=…` → Stripe (déjà câblé)

- Le client remplit ses infos (resto, ville, SIRET) et paie par carte, Alma ou
  Klarna. Le montant est calculé côté serveur, jamais côté client.
- Le webhook Stripe crée automatiquement : commande `paid`, abonnement
  maintenance, ligne de parrainage si code appliqué.
- **⚠️ Trou à combler avant prod** : aucun email de confirmation n'est envoyé, et
  `/checkout/success` renvoie juste vers Calendly. Voir MISE_EN_PROD.md §4.
- Contrat : la signature YouSign est câblée pour les **apporteurs d'affaires**.
  Pour un **contrat client** (prestation + maintenance), l'adaptateur existe mais
  le flux n'est pas branché — à décider (§ MISE_EN_PROD.md).
- Sortie : commande `paid` visible dans `/admin/ventes`.

### 5. Provisioning (go-live) — RUNBOOK MANUEL
**Qui** : dev / ops · **Outil** : console `/admin/parametres` + comptes Convex/Vercel

C'est l'étape 100 % manuelle. Le runbook est déjà affiché dans la console
(`GO_LIVE_STEPS`), à exécuter dans l'ordre pour chaque nouveau client :

1. **Cloner le boilerplate** restaurant-theme pour ce client (repo git séparé
   `beindigital-boilerplate`).
2. **Provisionner Convex** (déploiement prod dédié) + **Vercel** (projet dédié).
   → cf. la note d'estimation infra : two-tier par siège dev, ~50-250 €/an/client.
   Ne PAS créer un compte séparé par client (10× plus cher).
3. **Renseigner les variables** : Stripe (clé, webhook, price maintenance), AWS
   SES (expéditeur vérifié, région), les intégrations activées.
4. **Déclarer le webhook Stripe** côté dashboard sur l'URL Convex du client.
5. **Déployer le schéma Convex** (`convex deploy`) — tables, index, fonctions.
6. **Smoke tests** : un achat + une commande de bout en bout en conditions réelles.
7. **Bascule DNS** : le domaine final pointe sur l'instance, certificat actif.
8. **Enregistrer le client dans la flotte** : `/admin/parametres` → « Provisionner »
   (email client, domaine, plan, région). **Renseigner l'`orderId`** pour tracer
   paiement → déploiement.

- Sortie : instance en ligne, enregistrée dans `saDeployments`, statut `live`.

### 6. Kickoff & onboarding
**Qui** : commercial + client · **Outil** : rendez-vous (Calendly) + livraison

- Rdv de lancement : récupérer le contenu réel (menu, photos, horaires, logo,
  moyens de paiement du resto), configurer le premier établissement.
- Former le staff : back-office, écran cuisine (KDS), validation des lots du jeu.
- Remettre : accès admin, lien du site, QR codes de fidélité à imprimer.
- Sortie : le resto prend ses premières vraies commandes.

### 7. Maintenance & renouvellement
**Qui** : système + ops · **Outil** : `maintenance.ts` + Stripe (déjà câblé)

- 1ʳᵉ année incluse. À l'échéance, l'abonnement maintenance se renouvelle via
  Stripe (webhook BID → `maintenance._applyStripeRenewal`, déjà branché).
- Le client peut demander une migration de site depuis son back-office
  (Système → Maintenance) — demande + emails, traitée par l'équipe.
- **⚠️ Trou** : aucune relance sur paiement échoué. À combler (MISE_EN_PROD.md §2).

---

## Qui fait quoi (RACI condensé)

| Étape | Commercial | Dev/Ops | Système (auto) | Client |
|---|---|---|---|---|
| 1 Prospection | **R** | | | |
| 2 Démo | **R** | | démo `/decouvrir` | participe |
| 3 Proposition | **R** | | | |
| 4 Paiement | accompagne | | commande+abo+parrainage | **R** paie |
| 5 Provisioning | | **R** (runbook) | webhook→flotte (partiel) | |
| 6 Kickoff | **R** | configure | | fournit contenu |
| 7 Maintenance | | relances | renouvellement Stripe | |

---

## Ce qui est solide vs fragile aujourd'hui

**Solide (déjà câblé, exploitable)** : tarifs clairs et alignés back/front,
checkout Stripe (carte/Alma/Klarna), calcul serveur-side, offre fondateurs avec
compteur réel, parrainage + versement des commissions (Stripe Connect),
console `/admin` (ventes, clients, prospects, flotte), démo `/decouvrir`,
renouvellement maintenance.

**Fragile (à combler avant d'ouvrir la vente)** — détail et priorités dans
`MISE_EN_PROD.md` :
1. Le formulaire `/contact` ne fait rien (les prospects écrivent dans le vide).
2. Aucun email de confirmation ni de suivi après paiement.
3. Pas de facture conforme FR (aujourd'hui = PDF Stripe brut).
4. Pas de page légale (CGV, mentions, confidentialité).
5. Provisioning 100 % manuel — acceptable à ce volume, mais le runbook ci-dessus
   doit être suivi à la lettre.

---

**Version** : 1.0 · **Créé** : 2026-07-19 · basé sur l'audit du code réel et le
plan GTM validé. À revoir après les 3 premières ventes.
