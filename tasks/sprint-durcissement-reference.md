# Plan de durcissement — `apps/reference`

Établi le 2026-08-20, à partir de l'audit du 2026-08-19 (branche
`claude/referent-site-full-test-d4eea0`). Objectif : amener le référent à un état
utilisable, vérifié et tenable — pas seulement corrigé une fois.

> **Une précision de vocabulaire, parce qu'elle change le plan.** « 100 % sécurisé »
> n'est pas un état qu'on atteint et qu'on coche. Ce qu'on peut atteindre, et ce que
> ce plan vise : **zéro défaut connu ouvert**, un **socle vérifié par des tests qui
> échouent quand on casse quelque chose**, et des **garde-fous automatiques** qui
> empêchent la même classe de défaut de revenir. Sans le troisième point, le même
> audit se reproduit dans trois mois — c'est pourquoi les garde-fous sont des tickets
> à part entière et non un « si on a le temps ».

---

## 0. Journal d'avancement

Mis à jour à chaque ticket clos. Un ticket n'entre ici qu'une fois les cinq
critères de la section 11 satisfaits.

| Ticket | État | Preuve |
| --- | --- | --- |
| **S1-1** Remise recalculée côté serveur | ✅ **clos** | `promotionDiscount.ts` + 25 tests ; `discountAmount` retiré des args publics et de l'appel client |
| **S1-2** Validation de la promotion (store, activité, fenêtre, plafonds, minimum) | ✅ **clos** | 10 tests d'intégration sur `create.handler` ; contournement du plafond par client refermé (voir revue ci-dessous) |
| **S1-4** SumUp : référence + montant vérifiés | ✅ **clos** | `paymentSettlement.ts` + 22 tests ; câblé dans `verifyCheckout` |
| **S1-5** PayPal : référence + montant vérifiés, sandbox explicite | ✅ **clos** | `readPayPalCapture` lit enfin `purchase_units[0]` ; heuristique sandbox remplacée par `PAYPAL_SANDBOX_MODE` |
| **S1-6** Remboursement réel au lieu d'un `db.patch` | ✅ **clos** | `refundPolicy.ts` + 22 tests ; actions `internalRefund` Stripe/SumUp/PayPal ; enregistrement **après** confirmation du prestataire |
| **S1-7** Les 4 routes post-paiement manquantes | ✅ **clos** | `/checkout/success`, `/checkout/cancel`, `/checkout/pay`, `/track/[token]` — vérifiées en HTTP réel : 404 → 200 |
| **S1-8** `viewToken` rendu au client après commande | ✅ **clos** | La page de succès affiche « Suivre ma commande » avec le token retourné par la vérification |
| **S1-9** Total affiché aligné sur le total facturé | ✅ **clos** | `orderTotals.ts` + 13 tests — une seule arithmétique pour le serveur et la vitrine ; ligne TVA visible |
| **S1-10** Frais de livraison en mode pourcentage | ✅ **clos** | Table `deliveryQuotes` : le serveur lit le devis qu'il a émis. `uberDirectFee` retiré des arguments clients |
| **S2-1** Seam d'autorisation déplacé dans le package | ✅ **clos** | Fabrique `createStoreFunctions` ; `apps/themes` a enfin un seam |
| **S2-2** `authed*` migrés vers le seam store-scopé | ✅ **clos** (référent) | 69 → 11, les 11 restants justifiés. `themes` : passe séparée à prévoir |
| **S2-4** Permission déclarée sur chaque fonction store-scopée | ✅ **clos** (référent) | **178/178** ; 2 ressources RBAC manquantes ajoutées |
| **S2-8** `teamMembers` branché sur la chaîne d'auth | ✅ **clos** | Accepter une invitation provisionne enfin le profil |
| **S2-10** Suite de tests d'autorisation | ✅ **clos** | 17 tests `convex-test` sur les vraies fonctions Convex, en mémoire |
| **S2-11** Règle ESLint anti-régression | ✅ **clos** | 2 règles ; morsure vérifiée. Voir S2-12 ci-dessous |
| **S2-12** Trier 20 modules jamais audités | ✅ **clos** | 58 exports triés ; **5 nouvelles failles** trouvées ; règle ESLint sans exemption |
| **S2-9** Mutations d'équipe sécurisées | ✅ **clos** | `teamAccess.ts` + 23 tests ; les 2 actions d'invitation gardées |
| **S2-3** Exports Convex non gardés classés | ✅ **clos** (2 apps) | référent 43 → 29, `themes` 37 → 24 ; les publics annotés `@public-by-design` |
| **S2-5** `userProfiles.upsert` verrouillé | ✅ **clos** | `profileProvisioning.ts` + 20 tests — politique complète de qui provisionne quoi |
| **S2-6** `userProfiles.getByUserId` supprimé | ✅ **clos** | `AdminAuthSync` routé vers `getMyProfile` dans les deux apps |
| **S2-7** Amorçage du premier super-admin | ✅ **clos** | `claimFirstAdmin`, auto-refermante dès qu'un super-admin existe |
| **S4-1** Rôles fantômes bloquant les réglages | ✅ **clos** | Garde basée sur `settings:write` ; 2 tests de régression dans `rbac.test.ts` |
| **S0-1** Déploiement Convex de test + secrets CI | ⛔ **bloqué** | Nécessite les credentials du propriétaire du dépôt — hors de portée de l'agent |
| **S0-9** *(nouveau)* Stabiliser les tests sensibles au temps de `packages/core` | 🔜 à faire | Voir ci-dessous |

**Portée élargie sur S1-4/S1-5 — `apps/themes` était concerné.** Les fichiers
`sumup.ts` et `paypal.ts` du livrable client étaient **strictement identiques**
(`diff` vide) à ceux du référent, donc porteurs de la même faille. Corriger le
banc d'essai en laissant la fraude au paiement dans ce qui est cloné chez chaque
client aurait été l'inverse de l'objectif : le correctif a été appliqué aux deux.
Le contrat de `orders.create` ayant changé, le checkout de `themes` a dû être
aligné lui aussi — exactement le risque anticipé au registre (section 12), et
attrapé par le type-check.

**S0-9 — un test instable détecté au passage.** Lors d'un `pnpm test` complet,
`@be-in-digital/core` a rapporté `1 failed | 170 passed`, puis **190/190 sur
trois exécutions suivantes**. Les suspects sont les tests sensibles au temps du
même paquet : `ses.test.ts` (« splits into batches of 50 emails », 9,4 s) et
`i18n.test.ts` (retry/backoff, 3,1 s). Un test instable est un défaut à part
entière ici : il apprend à l'équipe à relancer une CI rouge au lieu de la lire,
ce qui annule le bénéfice de tout ce plan. À traiter dans le Sprint 0 (injecter
l'horloge plutôt que dormir, ou augmenter le budget de temps explicitement).

**Preuve de morsure obtenue sur S1-1** (méthode du ticket S0-8) : la ligne
vulnérable d'origine (`const discount = args.discountAmount ?? 0`) a été
réintroduite temporairement, **7 tests sont passés au rouge** — dont
« IGNORES a forged discountAmount smuggled by the client » — puis le correctif a
été restauré. Les tests mordent réellement.

**Preuve de morsure sur S1-4/S1-5** : les gardes de référence et de devise ont
été neutralisées temporairement, **5 tests sont passés au rouge** — dont
« refuses a payment made for a different order » — puis restaurées.

**État des portes après ces cinq tickets** : `pnpm test` → **1 257 tests, 18/18
tâches** ; `turbo run type-check` → propre sur `apps/reference`, `apps/themes` et
les 10 packages ; `pnpm lint` → 0 erreur (71 warnings sur `reference`, 75 sur
`themes`, inchangés).

> Piège d'outillage rencontré : `pnpm --filter <app> type-check` court-circuite
> le `dependsOn: ["^build"]` de turbo et rapporte ~120 fausses erreurs contre le
> `dist/` obsolète de `packages/restaurant`. Toujours passer par
> `npx turbo run type-check --filter=…` pour un verdict fiable.

### Revue de contrôle du 20 août

Relecture complète des 19 fichiers touchés avant de poursuivre. Un défaut
introduit par mes propres correctifs a été trouvé et corrigé :

- **Plafond `maxUsagePerCustomer` contournable.** Ma première version comptait un
  client sans email comme « n'ayant jamais utilisé la promo ». Or
  `customerInfo.email` est optionnel : **omettre un seul champ suffisait à
  ignorer le plafond**. `resolvePromotionDiscount` refuse désormais une promotion
  plafonnée par client sur une commande anonyme (`customer_unidentified`), avec
  3 tests dédiés. Le ticket S1-2 n'était pas réellement clos sans cela.

Points vérifiés et jugés corrects :

| Vérification | Résultat |
| --- | --- |
| Tous les appelants de `orders.create` | 2 storefronts (reference, themes) — les deux alignés. Les webhooks passent par `createFromWebhook`, chemin distinct et non impacté |
| `discountAmount` résiduels | Tous légitimes : type d'affichage, chemin webhook partenaire (Uber signe ses propres montants), champ de schéma, valeur calculée serveur |
| `apps/site` | Aucune dépendance moteur, backend Convex séparé, `discountAmount` absent de son `orders.ts` — hors d'atteinte |
| Index `by_promotionId_customerEmail` | Existe bien (`tables/promotions.ts:91`) |
| `hasPermission` sur rôle inconnu | Retourne `false` — échoue en refusant, donc le cast `as Role` est sûr |
| Double comptage livraison offerte | Corrigé pendant l'implémentation : la remise vaut les frais, les frais restent sur la commande, soustraction unique |
| Marqueurs de debug laissés | Aucun (`console.log`, `TODO`, `debugger`, résidus de preuve de morsure) |
| Fichiers temporaires | Aucun résidu |

**Portes rejouées sans cache après revue** : `turbo run test --force` → **18/18
tâches, 1 260 tests** · `turbo run type-check --force` sur `reference`, `themes`
et les 10 packages → **17/17** · `next build` sur `reference` → **compilé, 90
pages** · lint → **0 erreur** partout (71 warnings reference, 75 themes, 2
convex-functions, 4 core — tous dans des fichiers non touchés).

**Preuves de morsure rejouées** : remise serveur → 8 tests au rouge sans le
correctif ; règlement de paiement → 5 tests au rouge. Restauration vérifiée à
356/356.

> Échec préexistant sans rapport, constaté au build : `[sitemap] Failed to
> generate sitemap` — l'erreur est capturée et le build continue ; le sitemap a
> besoin d'un backend Convex.

### S1-6 — remboursement réel (20 août)

Le remboursement était un `ctx.db.patch` et rien d'autre : `refundedAmount` mis à
jour, paiement et commande passés à « remboursé », **aucun appel prestataire**
nulle part. Il acceptait en outre n'importe quel statut, y compris `failed`, et
était exposé en `authedMutation` — tout compte authentifié pouvait « rembourser »
le paiement de n'importe quel établissement.

Nouvelle chaîne, du plus pur au plus concret :

1. `packages/convex-functions/src/refundPolicy.ts` — décisions pures, 22 tests.
   `planRefund` valide statut, montant entier positif et solde restant ;
   `routeRefund` décide *comment* le remboursement peut être exécuté.
2. `defs.refund` → `defs.recordRefund` : n'écrit plus qu'**après coup**, avec
   `externalRefundId`, `refundedAt` et `refundMethod` comme preuve, et
   revalide contre le document fraîchement relu (course concurrente).
3. `stripe.ts`, `sumup.ts`, `paypal.ts` : une `internalRefund` chacun, qui parle
   au prestataire et rapporte ce qu'il a répondu.
4. `payments.refundPayment` : action publique qui autorise
   (`payments:refund` + accès à l'établissement), planifie, appelle le
   prestataire, **puis seulement** enregistre.

Trois décisions à connaître :

- **Espèces** : aucun prestataire à appeler. Le remboursement est enregistré
  comme `refundMethod: "manual"` — déclaration du personnel, jamais présentée
  comme confirmée par une API. Le toast le dit explicitement.
- **Square et paiements sans identifiant de transaction** : `routeRefund`
  renvoie `unsupported` et l'action **refuse**, avec un message qui renvoie au
  tableau de bord du prestataire. Refuser est le correctif : c'est précisément
  la promesse creuse qu'on supprime.
- **PayPal remboursait contre le mauvais identifiant.** `capturePayPalOrder`
  stockait l'id de *commande* dans `externalId`, or un remboursement PayPal
  s'émet contre une *capture*. `readPayPalCapture` extrait désormais le
  `captureId` et c'est lui qui est stocké — sans quoi chaque remboursement
  PayPal aurait échoué côté prestataire.

Schéma : trois champs optionnels ajoutés à `payments` (`externalRefundId`,
`refundedAt`, `refundMethod`) — aucune migration nécessaire.

**Portée élargie à `apps/themes`**, même raisonnement que S1-4/S1-5 : le livrable
client portait le même remboursement fictif. Les trois fichiers prestataires ont
été resynchronisés (vérifiés identiques au `HEAD` du référent avant copie) et son
`payments.ts` + `RefundDialog.tsx` alignés.

**Preuve de morsure** : gardes de statut et de routage neutralisées →
**7 tests au rouge**, dont « refuses a refund on a failed payment » et
« refuses a card payment with no stored transaction id ». Restauration
vérifiée à 378/378.

### S1-7 / S1-8 — les quatre routes post-paiement (20 août)

Les quatre URL étaient émises par le checkout et n'existaient pas. Sondées en
HTTP sur un serveur de production local : **404 avant, 200 après**.

| Route | Rôle |
| --- | --- |
| `/checkout/success` | Fait confirmer le paiement par le prestataire (Stripe via `session_id`, PayPal via `token`, SumUp via `checkoutId`), vide le panier, remet un lien de suivi |
| `/checkout/cancel` | Panier laissé intact — le client a annulé un paiement, pas sa commande. Propose de réessayer |
| `/checkout/pay` | Hôte du widget carte SumUp, avec dégradation explicite si le SDK ne charge pas |
| `/track/[token]` | Suivi public par token opaque, adossé à `getByTrackingToken` qui ne renvoie aucune donnée client |

**Deux défauts trouvés en écrivant ces pages :**

- **Le panier n'était jamais vidé après un paiement carte.** `clearCart()`
  n'était appelé que dans la branche espèces (`checkout/page.tsx:316`) : après
  un paiement Stripe ou PayPal, le client revenait avec son panier intact et
  pouvait recommander la même chose. Le vidage se fait maintenant sur la page de
  succès, **et seulement quand le paiement est confirmé** — un paiement
  abandonné doit conserver le panier.
- **Un lien de suivi mort pour les invités.** Ma première version proposait
  « Suivre ma commande » vers `/order/[orderId]` même sans `viewToken`, alors
  que cette page ne résout rien pour un visiteur sans compte. Le bouton n'est
  affiché que si un token est disponible.

**Limite assumée sur `/checkout/pay`** : SumUp n'est pas configuré sur ce
déploiement. La page suit le contrat publié du widget mais n'a pas été exercée
contre un compte réel — d'où la revue dédiée des intégrations prestataires
prévue sur une branche séparée.

**Portée élargie à `apps/themes`** : il émettait exactement les mêmes quatre URL
et n'avait aucune des routes. Les quatre pages y ont été ajoutées à l'identique.

### S1-9 / S1-10 — le prix affiché et les frais de livraison (20 août)

**S1-9.** La vitrine affichait `sous-total + livraison − remise` sous la mention
« Taxes incluses », pendant que le serveur facturait `sous-total + TVA +
livraison − remise`, TVA **ajoutée**. Sur un panier de 20 € à 10 % : 20 € à
l'écran, 22 € débités.

La cause n'est pas une erreur de calcul mais l'existence de **deux calculs**.
`packages/convex-functions/src/orderTotals.ts` (13 tests) porte désormais
l'arithmétique unique, appelée par le handler qui facture *et* par le
récapitulatif qui affiche. Le récapitulatif montre une ligne « TVA (x %) » et le
libellé du total dit la vérité (`TVA incluse` / `Hors taxes`).
`resolveTaxRatePercent` respecte un taux magasin **explicitement à 0** — un
restaurant non taxé est une configuration réelle, qu'un `??` aurait écrasée.

**S1-10.** Le ticket disait « envoyer `uberDirectFee` depuis le checkout, ou
retirer le mode pourcentage ». Aucune des deux options n'était bonne : envoyer
le montant depuis le navigateur aurait **recréé la faille de S1-1**, puisque le
serveur facturait un pourcentage du nombre reçu — `uberDirectFee: 0` achetait la
livraison gratuite.

Correctif retenu : nouvelle table **`deliveryQuotes`**. `getDeliveryQuote`
enregistre le devis Uber qu'il vient d'obtenir ; `orders.create` reçoit
uniquement l'`uberDirectEstimateId`, relit le devis stocké, **vérifie qu'il
appartient au bon restaurant et qu'il n'a pas expiré**, puis applique le
pourcentage. `uberDirectFee` a disparu des arguments publics, comme
`discountAmount` avant lui.

Côté vitrine, le checkout demande le devis quand — et seulement quand — le mode
le requiert, affiche les frais réels et remonte une erreur lisible sur une zone
non desservie.

**Limite connue** : les adresses enregistrées ne portent pas de coordonnées
(`checkout-form.tsx` ne les recopie pas dans `deliveryAddress`). En mode
pourcentage, seule une adresse saisie via l'autocomplétion permet d'obtenir un
devis. À traiter avec le modèle d'adresses, hors de ce ticket.

> ⚠️ **Dette d'outillage à solder après S0-1.** Ajouter une table et un module
> Convex exige un `convex codegen`, qui refuse de tourner sans déploiement
> (`No CONVEX_DEPLOYMENT set`) — le blocage S0-1 lui-même. Les entrées
> `deliveryQuotes` de `apps/*/convex/_generated/api.d.ts` ont donc été **écrites
> à la main**, à leur place alphabétique exacte. `pnpm convex:codegen` doit être
> relancé dès qu'un déploiement existe, et son résultat comparé : c'est du code
> généré, il n'a pas vocation à être maintenu à la main.

**Preuve de morsure** : TVA neutralisée dans `orderTotals.ts` → **7 tests au
rouge**, dont « reproduces the mismatch the storefront used to display ».
Restauration vérifiée à 391/391.

---

## Sprint 2 — cloisonnement multi-locataire (en cours)

### S2-5 / S2-6 / S2-7 — identité et rôles (20 août)

Les deux escalades de privilèges bloquantes de l'audit, plus le verrou qu'elles
imposaient de poser.

**S2-5.** `userProfiles.upsert` ne rejetait que deux chaînes littérales,
`"super_admin"` et `"client_admin"`. Tout le reste passait — dont `manager`, qui
porte `products:write`, `orders:read/write` et `customers:read` — sur n'importe
quel `storeId` choisi par l'appelant. `stores.list` étant public, l'attaque
tenait en trois appels : s'inscrire sur la vitrine, lister les établissements,
s'attribuer `manager` sur celui d'un concurrent. La variante symétrique était
pire : réécrire le profil du vrai propriétaire en `customer` sans établissement
pour l'éjecter de son propre restaurant.

Toute la politique vit désormais dans
`packages/convex-functions/src/profileProvisioning.ts` (20 tests) :

| Acteur | Peut provisionner |
| --- | --- |
| `super_admin` | Tout — sauf retirer son propre rôle de super-admin |
| `client_admin` | Les rôles non-administratifs, **uniquement sur ses établissements**, sans permissions sur mesure |
| Tous les autres | Rien |

Deux garde-fous méritent d'être signalés. Le refus d'auto-rétrogradation évite
qu'un déploiement se retrouve sans aucun administrateur. Et l'interdiction des
listes de permissions sur mesure pour un `client_admin` ferme la porte de côté :
une permission accordée nommément court-circuite entièrement la table des rôles.

**S2-6.** `getByUserId` était exporté en `query(defs.getByUserId)` — son cœur ne
fait aucun contrôle d'identité, donc n'importe qui pouvait lire le rôle, les
permissions et la liste d'établissements de n'importe quel utilisateur en
devinant un identifiant. Son unique appelant, `AdminAuthSync`, lisait en réalité
**son propre** profil : il est routé vers `getMyProfile`, et l'export public a
disparu des deux apps.

**S2-7.** Verrouiller `upsert` créait un problème de poule et d'œuf : provisionner
exige un super-admin, et un déploiement neuf n'en a aucun. `claimFirstAdmin`
promeut l'appelant authentifié **si et seulement si** aucun super-admin n'existe
— auto-refermante, donc non rejouable une fois le déploiement configuré.

> Constat au passage : `upsert` n'avait **aucun appelant fonctionnel**. Le seul,
> `scripts/seed-users.mts`, appelle Convex sans `setAuth` et échouait déjà en
> silence (erreurs avalées). D'où l'ajout d'`internalUpsert`, réservé au chemin
> serveur.

**Preuve de morsure** : gardes `not_permitted` et `store_not_owned` neutralisées
→ **4 tests au rouge**, dont « refuses a customer promoting themselves to
manager ». Restauration vérifiée à 411/411.

### S2-3 — les 43 exports Convex non gardés (21 août)

**43 avant, 29 après** — et les 29 restants sont désormais *justifiés par écrit*,
pas simplement laissés en l'état.

**Fermés (14 lectures + 11 écritures dans les mêmes fichiers) :**

| Fonction | Ce qui fuitait |
| --- | --- |
| `games.list` | Le `winRatio` configuré par le propriétaire |
| `gameQRCodes.list` | **Tous les codes QR** d'un établissement — de quoi jouer à distance sur toutes ses tables |
| `prizes.list` | Catalogue des lots et stock restant |
| `requiredActions.list` | Configuration du jeu |
| `promotions.list` / `getById` | Toutes les promotions, inactives et expirées comprises, avec leurs compteurs |
| `promotions.getCustomerUsageCount` | Sonde d'appartenance : « cette adresse a-t-elle utilisé cette promo ? » → passée en `internalQuery` |
| `paymentConnections.getByProvider` / `getAll` | `merchantId`, prestataire et état de connexion → `authedQuery` + `payments:read` |
| `orphanProducts.*` (2) | Plomberie d'intégration |
| `externalProductMappings.*` (3) | Correspondances produits ↔ plateformes |
| Écritures `prizes`, `gameQRCodes`, `orphanProducts`, `translations`, `externalProductMappings` | Tout compte authentifié pouvait écrire dans **n'importe quel** établissement |

**Le piège de ce ticket.** Trois de ces fonctions sont appelées côté serveur par
`deliverooWebhook.processOrderWebhook`, un `internalAction` déclenché par le
webhook — **sans identité utilisateur**. Les passer en `storeQuery` aurait
rejeté Uber Eats et Deliveroo eux-mêmes et cassé la réception des commandes.
`externalProductMappings` expose donc deux surfaces : les fonctions
store-scopées pour l'admin, et des variantes `internal*` vers lesquelles les
trois appelants serveur ont été repointés.

**Les 29 restantes, annotées `@public-by-design` avec leur raison** (8 fichiers) :
catalogue vitrine (`products`, `categories`, `menus`), sélecteur de langue
(`languages`), parcours de jeu anonyme (`gamePlay`), accès par jeton
(`orders.getByViewToken`, `kitchenTickets.getByTrackingToken`,
`teamMembers.getByInvitationToken`), code promo saisi avant connexion
(`promotions.getByCouponCode`, `listActiveAuto`), et traductions de contenu déjà
public (`translations` — lectures publiques, **écritures fermées**).

Le marqueur `@public-by-design` est le crochet que lira la règle ESLint de S2-11.

### S2-1 — le seam d'autorisation rejoint le moteur (21 août)

`convex/lib/storeFunctions.ts` n'existait que dans `apps/reference`. Le livrable
cloné chez chaque client n'avait **aucun** seam : il réécrivait des gardes
inline, fichier par fichier. La politique d'autorisation du moteur vivait donc
dans son banc d'essai, et pas dans ce qui est vendu.

Le blocage était réel : le seam importe `../_generated/server` et
`../_generated/dataModel`, propres à chaque app. Il ne pouvait pas être déplacé
tel quel. Il est devenu une **fabrique** — `createStoreFunctions<QCtx, MCtx>({
query, mutation })` — que chaque app instancie avec ses propres builders
générés. Les types de contexte sont fixés par la fabrique, les constructeurs
retournés restent génériques sur leurs arguments et leur sortie.

| | Avant | Après |
| --- | --- | --- |
| Implémentation | 164 lignes dans `apps/reference` | 194 lignes dans `packages/convex-functions` |
| `apps/reference` | l'implémentation | instanciation de 21 lignes |
| `apps/themes` | **rien** | instanciation de 21 lignes |

Bénéfice immédiat : **les 23 fichiers qui importaient `./lib/storeFunctions` n'ont
pas changé d'une ligne** — l'instanciation ré-exporte les mêmes noms. Et `themes`
a pu recevoir S2-3 dans la foulée : **37 exports nus → 24**, avec les mêmes
fermetures (lots, codes QR, promotions, connexions de paiement, correspondances
produits, orphelins, traductions).

Un détail à ne pas rater au passage : `themes/deliverooWebhook.ts` appelait
encore `api.externalProductMappings.getByExternal`, supprimée de la surface
publique. Le type-check l'a attrapé ; le webhook a été repointé vers la variante
interne, sans quoi la réception des commandes Deliveroo aurait cassé chez tous
les clients.

### S2-2 — les gardes « auth seule » deviennent store-scopées (21 août)

**69 usages d'`authedQuery`/`authedMutation` → 11**, et les 11 restants sont
justifiés, pas oubliés.

Migrés vers `storeQuery` / `storeMutation` : les 5 modules email (31 fonctions),
`kitchenTickets` (10), `storeIntegrations` (5), `cms` (3), `payments` (3),
`blog` (2). Motif uniforme : `create` porte un `storeId` et prend le résolveur
par défaut ; tout le reste référence un document et passe par
`storeIdFromDocument`.

**Le seam manquait un outil.** Plusieurs fonctions atteignent leur établissement
par un champ qui n'est pas `id` — `orderId`, `articleId` — et c'est précisément
pour ça qu'elles étaient restées en auth seule : le seam n'avait rien à leur
offrir. `storeIdFromField(champ, message)` comble ce trou et débloque
`payments.getByOrder`, `kitchenTickets.getByOrder`, `blog.getAdminArticle`.

**Trois découvertes en chemin :**

1. **Une permission fantôme.** `emailCampaignActions` exige `marketing:write`,
   mais ni la ressource `marketing` ni la permission n'existaient dans le RBAC.
   `hasPermission` échouant en refusant, **seul un super-admin pouvait envoyer
   une campagne** — le propriétaire du restaurant, jamais. Même classe de bug
   que les rôles fantômes de S4-1. Ressource ajoutée, permissions accordées à
   SUPER_ADMIN et CLIENT_ADMIN, 2 tests de régression.

2. **Un IDOR sur l'historique client.** `orders.getByCustomer` acceptait un
   `customerId` arbitraire et renvoyait toutes les commandes de cette personne —
   nom, téléphone, adresse de livraison, articles — derrière un simple « êtes-vous
   connecté ». **Aucun appelant** : `getMyOrders`, qui dérive l'identité de la
   session, est ce qu'utilise la page compte. Export supprimé.

3. **Trois recherches inter-établissements.** `storeIntegrations.listByPlatformEnabled`,
   `getBySiteId` et `getByBrandId` cherchent à travers *tous* les établissements —
   c'est leur raison d'être : résoudre à quel restaurant appartient un événement
   Uber Eats ou Deliveroo entrant. Elles ne peuvent pas être store-scopées, et
   les webhooks qui les appellent n'ont pas d'identité. Passées en interne, avec
   les trois appelants repointés. Leurs exports publics permettaient d'énumérer
   tous les restaurants connectés.

**Les 11 restants et pourquoi :**

| Fonction(s) | Raison |
| --- | --- |
| `paymentConnections.getByProvider` / `getAll` | Données au niveau du déploiement, pas de l'établissement. Gardées par `payments:read` depuis S2-3 |
| `stores.create` | Aucun établissement n'existe encore à qui rattacher la garde. Désormais protégée par `stores:write` — elle était en auth seule, donc tout client inscrit pouvait créer des restaurants |
| `teamMembers` (8) | Périmètre de S2-8 / S2-9, traités ensemble avec le câblage de la chaîne d'authentification |

> ⚠️ **`apps/themes` n'a pas reçu cette migration.** Ses 12 fichiers équivalents
> divergent tous du référent — ils utilisent des gardes inline, et son
> `orders.ts` est un vrai fork qui réimplémente le ticket cuisine. Copier à
> l'aveugle risquerait de casser le template client d'une manière que le
> type-check ne verrait pas. Le seam y est désormais disponible (S2-1) : la
> migration de `themes` est une passe à part entière, fichier par fichier.

### S2-4 — une permission sur chaque fonction store-scopée (21 août)

Après S2-2, l'application comptait **178 fonctions store-scopées et 14
permissions déclarées**. `storeQuery`/`storeMutation` sans `permission:` ne
vérifie que *l'appartenance* à l'établissement : un compte `kitchen` rattaché au
restaurant pouvait supprimer l'établissement, publier une page ou effacer un
article.

**178 / 178** désormais. Correspondance retenue :

| Domaine | Permission |
| --- | --- |
| `products`, `categories`, `orphanProducts`, `externalProductMappings` | `products:read/write/delete` |
| `orders` | `orders:read/write/delete` |
| `kitchenTickets` | `kitchen:read/write` |
| `stores` | `stores:read/write/delete` |
| `menus` | `menus:read/write` |
| `payments` | `payments:read` / `payments:refund` |
| `promotions`, les 6 modules `email*` | `marketing:read/write` |
| `cms`, `blog`, `cmsMedia` | `content:read/write/delete` |
| `games`, `prizes`, `gameQRCodes`, `requiredActions`, `prizeRedemptions` | `games:read/write` |
| `languages`, `translations` | `translations:read/write` |
| `storeIntegrations` | `settings:read/write` |
| `contactMessages` | `customers:read/write` |
| `teamMembers` | `team:read` |

**Deux ressources RBAC manquaient.** `marketing` (découverte en S2-2 : la
permission était exigée sans exister) et `content` — le CMS et le blog n'avaient
aucune ressource à eux, ce qui explique en partie pourquoi personne n'avait posé
de permission dessus. Les deux sont ajoutées à l'énumération `Resource` et
accordées : lecture/écriture/suppression pour SUPER_ADMIN et CLIENT_ADMIN,
lecture/écriture seulement pour MANAGER — un gérant rédige et publie, le
propriétaire supprime.

**Vérification de la matrice obtenue** : 16 cas exécutés contre `hasPermission`,
tous conformes. Le point qui comptait le plus — le rôle `kitchen` conserve
`kitchen:read/write` et `orders:read`, donc le KDS reste opérable — et il n'a
toujours ni `content:write`, ni `marketing:write`, ni `stores:delete`.
5 tests de régression ajoutés.

> Même réserve que S2-2 : appliqué au référent seul. `apps/themes` a le seam
> depuis S2-1 mais ses wrappers divergent et demandent une passe dédiée.

### S2-8 / S2-9 — l'équipe (21 août)

**S2-8 — pourquoi l'écran équipe était décoratif.** `acceptInvitation` estampait
`teamMembers.userId` et s'arrêtait là, alors que `getAuthUser` résout les droits
exclusivement depuis `userProfiles` et ne lit **jamais** cette table. Un gérant
invité avec un jeu complet de permissions acceptait… et ne recevait rien.

Le correctif garde **une seule source d'autorité**, `userProfiles` :
`teamMembers` reste le registre et la trace d'invitation, et accepter provisionne
le profil que la chaîne d'autorisation consulte déjà. `invitationGrant` fait le
pont — c'est la fonction qui manquait.

Un choix explicite : une adhésion `allStores` ne produit **aucune** liste
d'établissements. Énumérer tous les magasins élargirait silencieusement l'accès
à chaque nouveau restaurant créé ; ces adhésions restent l'affaire d'un super
administrateur, qui est aussi le seul à pouvoir les créer.

**S2-9 — trois trous distincts.**

1. **`acceptInvitation` n'avait aucune authentification** et prenait le `userId`
   à lier comme simple argument. Un jeton d'invitation capté permettait donc
   d'attacher **n'importe quel compte** au poste. L'appelant est désormais dérivé
   de la session.
2. **Toutes les mutations d'équipe étaient des `authedMutation`** — « êtes-vous
   connecté » et rien d'autre. `assertCanManageMember` (23 tests) porte la règle :
   seuls SUPER_ADMIN et CLIENT_ADMIN gèrent un registre, un CLIENT_ADMIN
   uniquement sur ses propres établissements, et une adhésion `allStores` exige
   un super administrateur. `update` vérifie le membre **tel qu'il est et tel
   qu'il deviendrait**, sinon un propriétaire pourrait promouvoir un membre local
   en accès chaîne.
3. **Le vrai point d'entrée n'était pas gardé.** L'écran équipe n'appelle pas
   `invite` mais l'action `teamMembersEmail.sendInvitationEmail`, qui atteint le
   registre via `inviteInternal` et **contournait donc entièrement** la garde.
   Elle ne vérifiait que « connecté » : n'importe quel compte pouvait s'inviter
   `manager` sur n'importe quel établissement, ou en accès chaîne. Les deux
   actions d'invitation passent maintenant par une requête interne qui applique
   la même politique.

**Deux IDOR fermés au passage.** `getByUser` acceptait un `userId` arbitraire et
`getByEmail` un email arbitraire, tous deux en auth seule — de quoi lire le rôle,
les permissions et les établissements de n'importe qui, ou sonder si une adresse
appartient à une équipe. Le premier devient `getMyMemberships` (dérivé de la
session), le second passe en `storeQuery` avec `team:read`.

> Constat : **aucune interface d'acceptation d'invitation n'existe**. Aucun
> appelant d'`acceptInvitation` dans tout le dépôt, aucune route contenant
> « invit ». Le mail part avec son lien, et rien ne le consomme. La chaîne est
> désormais correcte de bout en bout côté serveur ; il manque la page.

**Preuve de morsure** : gardes `not_permitted` et `chain_wide` neutralisées →
**6 tests au rouge**. Restauration vérifiée à 434/434.

**État final des `authed*` dans le référent : 3**, tous justifiés —
`stores.create` (aucun établissement à qui se rattacher, gardé par
`stores:write`) et les deux `paymentConnections` (niveau déploiement, gardés par
`payments:read`).

### S2-10 / S2-11 — les garde-fous (21 août)

**S2-10 — 17 tests d'autorisation** (`apps/reference/tests/convex/`) qui exécutent
les **vraies** fonctions Convex contre le **vrai** schéma, en mémoire, via
`convex-test` (déjà utilisé par `apps/site`). Ils assertent ce qui doit être
**refusé** :

- sans session : lecture et écriture store-scopées rejetées ;
- inter-établissement : un propriétaire de A ne lit, n'écrit ni ne supprime chez B ;
- rôle insuffisant : la cuisine ne supprime pas l'établissement, ne lit pas les
  campagnes email, un serveur ne voit pas les taux de gain ;
- escalade : un client ne se promeut pas `manager`, un propriétaire n'accorde pas
  d'accès à un établissement tiers ni ne crée un autre admin ;
- identité jamais en argument : `orders.getByCustomer` et
  `userProfiles.getByUserId` ne doivent plus **exister**, ce que deux tests
  vérifient explicitement.

Trois tests miroirs vérifient l'inverse — le propriétaire passe, le super-admin
traverse, **et la cuisine lit toujours son propre écran**. C'était le vrai risque
de S2-4 : verrouiller la cuisine hors de l'outil qu'elle utilise.

**S2-11 — deux règles ESLint** (`@be-in-digital/convex-functions/eslint/convex-auth`,
déplacées le 21 août depuis `apps/reference/eslint-rules/`), appliquées à
`convex/*.ts` :

| Règle | Interdit |
| --- | --- |
| `no-unguarded-convex-function` | `query(…)`, `mutation(…)`, `authedQuery(…)`, `authedMutation(…)` sans annotation |
| `require-convex-permission` | `storeQuery`/`storeMutation` sans `permission:` |

Deux échappatoires, **délibérément distinctes** : `@public-by-design` (joignable
par tous — catalogue vitrine, accès par jeton) et `@guarded-inline` (autorisée,
mais par une politique que le seam ne peut pas exprimer). Les confondre
laisserait lire une mutation gardée comme « publique », soit exactement la
confusion qui a produit ce sprint.

> **Erreur commise et corrigée.** Mon premier script d'annotation a tamponné
> `@public-by-design` sur 7 mutations de `teamMembers`, `categories.reorder` et
> deux requêtes d'`orders` — toutes gardées en interne, aucune publique. C'est le
> blanchiment que ce ticket est censé empêcher, produit par l'outil censé
> l'empêcher. D'où la seconde annotation, et une reprise manuelle.

**Morsure vérifiée** : réintroduire `export const list = query(defs.list)` dans un
fichier migré produit une erreur ESLint immédiate.

### S2-12 — clos : 58 exports triés, 5 failles de plus (21 août)

Chaque module a été **lu** avant d'être classé. Cinq défauts réels sont sortis de
ce tri, dont trois que l'audit initial n'avait jamais vus :

| Défaut | Ce qu'il permettait |
| --- | --- |
| `cmsMedia.*` (4 fonctions) | Auth seule avec un `storeId` client : parcourir **et supprimer** la médiathèque d'un autre restaurant |
| `emailEvents.listByCampaign` / `listBySubscriber` | Lire l'historique d'ouvertures et de clics d'un concurrent |
| `blogAutoConfig.upsert` | Vérifiait le *forfait* de l'appelant, jamais son accès au `storeId` : un abonné pouvait activer l'auto-publication chez autrui, et `targetStoreIds` visait plusieurs établissements |
| `seedKitchenOrders` / `cleanKitchenSeed` | Fixtures de démo déployées en prod : injecter de fausses commandes dans **n'importe quelle** cuisine |
| `ownerEntitlements.upsert` | **Contournement de facturation** — voir ci-dessous |
| `ownerEntitlements.getByOwnerId`, `paymentConnections.disconnect`, `uberEatsConnections.disconnect` | IDOR sur l'état d'abonnement ; couper le prestataire de paiement ou l'intégration Uber Eats depuis n'importe quel compte |

**Le plus instructif : `ownerEntitlements.upsert`.** Sa garde disait « les
utilisateurs ne peuvent modifier que **leurs propres** droits » — formulation qui
sonne protectrice et fait exactement l'inverse. Les entitlements ouvrent des
fonctionnalités payantes (autoBlog et ses plafonds) : laisser chacun écrire les
siens permettait de s'attribuer un forfait non acheté. Le schéma le disait
pourtant : « source de vérité : webhooks Stripe ; pour l'instant modifiable
manuellement par un admin ». Réservé au super-admin, avec un chemin interne pour
Stripe.

**Classement final : 50 `@public-by-design`, 43 `@guarded-inline`**, chacun avec
sa raison écrite. La liste d'exemption de `eslint.config.mjs` a été **supprimée** :
les deux règles sont désormais en `error` sur `convex/*.ts` sans aucune
échappatoire de fichier. Morsure revérifiée après suppression.

### Historique — ce que la règle avait révélé

Activer les règles a fait apparaître **~58 exports non gardés dans 20 modules que
l'audit initial n'avait jamais énumérés** : `maintenance`, `system`, `cmsMedia`,
`blogAutoConfig`, `ownerEntitlements`, `favorites`, `globalSettings`,
`uberEatsConnections`, `seedKitchenOrders`, `emailEvents`, `blogAutoUsage`,
`auth`, `prizeRedemptions`, `emailSubscribers`, `contactMessages`,
`userProfiles`, `stores`, `paymentConnections`, `blog`, `cms`.

Ils sont **listés dans `eslint.config.mjs` en `warn`, pas annotés**. Poser
`@public-by-design` sur du code que personne n'a lu ferait passer une surface non
revue pour une surface revue — pire que la dette visible. Chaque fichier doit
recevoir le traitement de S2-3 ; la liste atteignant zéro est ce qui clôt S2-12.

> Note d'outillage : `tests/` est exclu du `tsconfig` du référent, comme dans
> `apps/site` — les suites `convex-test` s'appuient sur `import.meta.glob` de
> Vite et sur les génériques du harnais. Elles restent vérifiées à l'exécution
> par vitest.

### Reste du Sprint 2

`S2-1` (déplacer le seam vers le package), `S2-2` (68 `authed*` à migrer),
`S2-3` (44 exports nus à classer), `S2-4` (83 permissions manquantes),
`S2-8`/`S2-9` (`teamMembers`), `S2-10` (suite `convex-test`), `S2-11` (règle
ESLint anti-régression).

Note d'implémentation pour S2-1 : `convex/lib/storeFunctions.ts` importe
`../_generated/server` et `../_generated/dataModel`, propres à chaque app. Il ne
peut donc pas être déplacé tel quel — il doit devenir une **fabrique**
(`createStoreFunctions({ query, mutation })`) que chaque app instancie avec ses
propres builders générés.

> Note : `@beyours/site` échoue au type-check sur `@calcom/embed-react`, déclaré
> dans son `package.json` mais absent du `node_modules` de ce worktree. Défaut
> préexistant, sans rapport avec ces tickets.

---

## 1. La contrainte qui ordonne tout le reste

Aujourd'hui, **la CI est incapable d'échouer** sur une régression fonctionnelle :

- Dernier rapport Playwright : **510 tests, 0 passé, 510 *skipped***, rapport `ok: true`.
- Trois verrous en série : `vars.CONVEX_E2E_ENABLED` absent → job non déclenché ;
  `secrets.E2E_NEXT_PUBLIC_CONVEX_URL` absent → étape sautée ; projets `setup`/`admin`
  non enregistrés sans backend réel → 33 specs sur 43 désactivées.
- Le job de statut passe au vert quand le job est *skipped*.

**Conséquence directe sur l'ordre des travaux** : tant que ce point n'est pas réglé,
chaque correctif des sprints suivants est livré **non vérifié**, et rien n'empêche
de le casser à nouveau la semaine d'après. Le Sprint 0 n'est donc pas une phase de
confort : c'est une dépendance dure. Aucun ticket des sprints 1 à 6 ne doit être
déclaré « fait » avant que la porte du Sprint 0 soit franchie.

Second levier structurant : **les packages ont 50 fichiers de tests, l'app en a 2**
(dont un couvre du code jamais appelé). La règle d'implémentation qui en découle est
constante dans tout ce plan — **on corrige dans le package, on câble dans l'app**.
Un correctif écrit dans `apps/reference/convex/` est un correctif non testé.

---

## 2. Forme réelle du chantier

Le périmètre ne tient pas dans un sprint. Chiffrage honnête, en jours-développeur :

| Sprint | Thème | Charge | Bloquant pour la prod |
| --- | --- | --- | --- |
| **S0** | Restaurer la capacité d'échouer | 3–4 j | Prérequis absolu |
| **S1** | L'argent | 4–5 j | Oui |
| **S2** | Cloisonnement multi-locataire | 6–8 j | Oui |
| **S3** | Surface exposée | 4–5 j | Oui |
| **S4** | Pannes silencieuses | 4–5 j | Oui |
| **S5** | Vitrine et panier | 3–4 j | Oui |
| **S6** | Architecture et propreté | 5–6 j | Non |
| | **Total** | **29–37 j** | |

Soit **3 sprints de deux semaines à deux développeurs**, ou 6 à 7 semaines à un seul.
S0 → S5 constituent le lot « prêt pour un premier client réel » ; S6 est de la dette
technique à traiter juste après, pas avant.

**Découpage recommandé en trois itérations :**

- **Itération 1** — S0 + S1 : la CI mord, et plus aucun euro ne fuit.
- **Itération 2** — S2 + S3 : plus aucune donnée ne traverse la frontière d'un client.
- **Itération 3** — S4 + S5, puis S6 : plus aucune fonctionnalité ne ment, puis on nettoie.

**Porte de sortie entre chaque itération** (go / no-go) : la CI est verte *et* la
preuve de morsure du Sprint 0 est rejouée (voir S0-8).

---

## 3. Sprint 0 — Restaurer la capacité d'échouer

**But** : à la fin du sprint, casser volontairement une assertion fait rougir la CI.
Rien d'autre ne compte.

| ID | Ticket | Où | Fait quand |
| --- | --- | --- | --- |
| **S0-1** | Provisionner un déploiement Convex dédié aux tests, poser `CONVEX_E2E_ENABLED=true` et les secrets `E2E_*` | GitHub repo settings, `.github/workflows/e2e.yml:14,17-28` | Le job `e2e` se déclenche sur une PR et exécute réellement Playwright |
| **S0-2** | Supprimer le vert silencieux : le job échoue si la suite est sautée ou si `expected === 0` | `e2e.yml:64-72,100`, job `e2e-status` `:126-143` | Une PR avec 0 test exécuté est **rouge** |
| **S0-3** | Réparer les specs écrites contre une interface périmée | `e2e/auth/sign-in.spec.ts:10,19,29`, `sign-up.spec.ts:80`, `storefront/public-pages.spec.ts:60,68,91,99,122,130`, `storefront-layout.spec.ts:18,28,52` | Ces specs passent contre l'UI réelle (français), sans adapter l'UI au test |
| **S0-4** | Éliminer le motif `if (hasX) { …assertions… }` sans `else` — **80 occurrences sur 15 specs** ; remplacer par des fixtures semées ou de vrais `test.skip` visibles | `admin/store-detail.spec.ts` (17), `order-detail.spec.ts` (10), `inventory.spec.ts` (10), `kitchen.spec.ts` (7), `email-campaigns.spec.ts` (7), + 10 autres | Zéro assertion enfermée dans une condition sans `else` ; les tests sautés apparaissent *skipped*, pas *passed* |
| **S0-5** | Resserrer le filtre d'erreurs console : retirer `/convex/i`, `/401/`, `/403/`, `/500 …/`, `/Internal Server Error/i`, `/Failed to fetch/i`, `/Module not found/i`, `/@be-in-digital/i` | `e2e/helpers/console.helpers.ts:7-32` | Les 13 tests « pas d'erreur console » détectent une panne backend simulée |
| **S0-6** | Seed e2e déterministe : établissement, catalogue, commandes, tickets — de quoi rendre les 80 conditions de S0-4 inutiles | `apps/reference/scripts/seed-users.mts` (corriger l'absence de `setAuth`, qui fait échouer la création de profils en silence) + nouveau seed de données | Une base fraîche produit un jeu de données stable ; le script échoue bruyamment s'il n'a pas pu écrire |
| **S0-7** | Installer `convex-test` dans `packages/convex-functions` (déjà utilisé en `^0.0.44` dans `apps/site`) et poser des seuils de couverture | `packages/convex-functions/package.json`, `vitest.config.ts` de l'app et du package | `pnpm test` échoue sous le seuil ; un premier test d'autorisation tourne |
| **S0-8** | **Preuve de morsure** : casser volontairement une assertion, une garde d'auth et un calcul de total ; vérifier que la CI rougit à chaque fois ; documenter la manip | `tasks/` (annexe de ce document) | Trois rouges obtenus et documentés. **C'est la porte du sprint.** |

> Sans S0-8, on n'a aucune preuve que la CI protège quoi que ce soit. Ce ticket n'est
> pas une formalité : c'est le seul qui valide les sept autres.

---

## 4. Sprint 1 — L'argent

**But** : plus aucun chemin ne permet de payer moins que dû, de valider un paiement
qui n'a pas eu lieu, ou de perdre le client après le paiement.

| ID | Ticket | Défaut d'audit | Où |
| --- | --- | --- | --- |
| **S1-1** | Retirer `discountAmount` des arguments publics ; recalculer la remise côté serveur depuis `promotionId` | **B-02** — `discountAmount: 99999999` → total 0 €, ticket cuisine émis | `packages/convex-functions/src/orders.ts:202,291-292` ; exposition `apps/reference/convex/orders.ts:71` |
| **S1-2** | Valider la promotion au moment du calcul : existence, activité, fenêtre de dates, plafond, usage par client | Même chemin : `usageCount` est incrémenté sans qu'aucune règle ne soit vérifiée | `packages/convex-functions/src/orders.ts:325-334` |
| **S1-3** | Dériver `customerId` de `identity.subject` au lieu de l'accepter en `v.string()` | Une commande peut être attribuée à un autre client | `packages/convex-functions/src/orders.ts:163` |
| **S1-4** | SumUp : comparer `checkout_reference` à `orderId` **et** `checkout.amount` à `order.total` ; rendre le `checkoutId` non rejouable | **B-03** — un paiement d'1 € valide une commande de 200 € | `apps/reference/convex/sumup.ts:108-183` (réf. lue l.141, jamais comparée) |
| **S1-5** | PayPal : relire `reference_id` à la capture, vérifier le montant ; corriger la détection sandbox (`clientId.startsWith("A") === false` bascule des clés live en sandbox) | **B-03** (variante) + paiements jamais encaissés | `apps/reference/convex/paypal.ts:30-31,141-208` |
| **S1-6** | Brancher un vrai appel de remboursement au prestataire — ou retirer le bouton de l'interface | **B-04** — la mutation ne fait qu'un `db.patch`, aucun appel PSP nulle part | `packages/convex-functions/src/payments.ts:109-137` |
| **S1-7** | Écrire les quatre routes manquantes : `/checkout/success`, `/checkout/cancel`, `/checkout/pay`, `/track/[token]` | **B-01** — sondées en HTTP : 404 sur les quatre | `app/(storefront)/checkout/page.tsx:323,325,330,331,344,345` ; `order/[orderId]/page.tsx:138` |
| **S1-8** | Retourner le `viewToken` au client après commande et l'afficher sur l'écran de confirmation | Un invité n'a aujourd'hui aucun moyen de retrouver sa commande | `packages/convex-functions/src/orders.ts:297,321,344` |
| **S1-9** | Aligner le total affiché sur le total facturé (TVA) | Sous-total 20 € à 10 % : la page annonce « 20 € taxes incluses », Stripe débite 22 € | `components/storefront/order-summary.tsx:52,242` |
| **S1-10** | Envoyer `uberDirectFee` / `uberDirectEstimateId` depuis le checkout, ou retirer le mode `percentage` | Toute commande en livraison échoue en mode pourcentage | `checkout/page.tsx:275-306` vs `orders.ts:279-281` |

**Tests exigés pour clore le sprint** (dans `packages/convex-functions/src/__tests__/`,
à côté de `orders.test.ts` qui existe déjà) :
remise forgée rejetée · promotion expirée rejetée · plafond d'usage respecté ·
référence SumUp/PayPal non concordante rejetée · montant non concordant rejeté ·
les quatre routes répondent 200 en e2e.

---

## 5. Sprint 2 — Cloisonnement multi-locataire

**But** : aucune donnée d'un restaurant n'est lisible ou modifiable par un compte
rattaché à un autre. C'est le sprint le plus lourd, et le plus mécanique.

**Volume mesuré** : 68 usages de `authedQuery`/`authedMutation` sur 13 fichiers,
44 fonctions exportées en `query(defs.X)` / `mutation(defs.X)` nus, et **83 des 102
fonctions `storeQuery`/`storeMutation` ne déclarent aucune `permission:`**
(19 seulement le font).

| ID | Ticket | Où | Fait quand |
| --- | --- | --- | --- |
| **S2-1** | Déplacer le seam d'autorisation vers `packages/convex-functions` pour que `apps/themes` en hérite | `apps/reference/convex/lib/storeFunctions.ts` (exemplaire unique dans tout le dépôt ; `apps/themes/convex/lib/` ne l'a pas) | Le livrable client applique la même politique que le banc d'essai |
| **S2-2** | Migrer les 68 `authedQuery`/`authedMutation` vers `storeQuery`/`storeMutation` avec `storeIdFrom` | `blog.ts`, `cms.ts`, `emailSubscribers.ts`, `emailCampaigns.ts`, `emailSegments.ts`, `emailTemplates.ts`, `emailAutomations.ts`, `kitchenTickets.ts`, `orders.ts`, `payments.ts`, `storeIntegrations.ts`, `stores.ts`, `teamMembers.ts` | Zéro `authedMutation` restant sur une ressource rattachée à un établissement. Le helper `storeIdFromDocument` existe déjà (`storeFunctions.ts:115-125`) |
| **S2-3** | Classer les 44 exports nus : marquer explicitement ceux qui sont **publics par intention** (catalogue vitrine), migrer les autres | `prizes.ts:4`, `gameQRCodes.ts:4`, `games.ts:5`, `requiredActions.ts:5`, `paymentConnections.ts:9,24`, `orphanProducts.ts:4-5`, `externalProductMappings.ts:4-6`, `translations.ts`, `cmsMedia.ts` | Chaque export public porte un commentaire justifiant son exposition ; les autres sont gardés |
| **S2-4** | Déclarer `permission:` sur les 83 fonctions qui n'en ont pas | `stores`, `orders`, `promotions`, `languages`, `menus`, `cms`, `blog`, `teamMembers`, `kitchenTickets` | Un compte `kitchen` ne peut plus supprimer l'établissement ni publier une page. Modèle à répliquer : `convex/products.ts` (11/11) |
| **S2-5** | Verrouiller `userProfiles.upsert` : forcer `userId = identity.subject`, sortir `role`, `storeIds` et `permissions` des arguments client | **B-05** — `manager` passe le garde ; `userId` et `storeIds` viennent du client | `apps/reference/convex/userProfiles.ts:26-48` ; `packages/convex-functions/src/userProfiles.ts:37-47` |
| **S2-6** | Supprimer `userProfiles.getByUserId` au profit de `getMyProfile` (un seul appelant à router) | **B-06** — rôle et périmètre de n'importe qui, sans authentification | `convex/userProfiles.ts:6` ; appelant `components/admin/AdminAuthSync.tsx:20` |
| **S2-7** | Créer un chemin d'amorçage du premier `super_admin` (aujourd'hui : poule/œuf, seul un `super_admin` peut en désigner un) | `convex/userProfiles.ts:34-43` | Un déploiement neuf peut désigner son premier administrateur sans accès direct à la base |
| **S2-8** | Brancher `teamMembers` sur la chaîne d'authentification — ou retirer l'écran | L'auth lit `userProfiles` et ne consulte jamais `teamMembers` : un gérant invité avec 8 permissions n'obtient aucun droit | `packages/convex-functions/src/auth.ts:35-53`, `teamMembers.ts:224-229` |
| **S2-9** | Sécuriser `teamMembers.create/update/acceptInvitation` (aujourd'hui `authedMutation`, ou sans auth du tout pour `acceptInvitation`) | Tout compte peut s'insérer `allStores: true, role: "manager"` | `convex/teamMembers.ts:53-58,73-88` |
| **S2-10** | **Suite de tests d'autorisation** avec `convex-test` : pour chaque fonction gardée, un cas « utilisateur du store A rejeté sur le store B » et un cas « rôle insuffisant rejeté » | Nouveau `packages/convex-functions/src/__tests__/authorization.test.ts` | Chaque fonction gardée a son test négatif. C'est ce qui rend S2-2 à S2-4 vérifiables |
| **S2-11** | **Garde-fou** : règle ESLint interdisant `query(defs.` / `mutation(defs.` nus et `authedMutation` dans `apps/*/convex/`, sauf annotation `// @public-by-design: <raison>` | `eslint.config.mjs` | Une PR qui réintroduit une fonction non gardée est rouge |

> **Pourquoi S2-11 est un ticket et pas une bonne intention.** Les 112 sites à corriger
> ne sont pas 112 erreurs indépendantes : c'est une seule habitude, répétée. Corriger
> les sites sans corriger l'habitude garantit la réapparition.

---

## 6. Sprint 3 — Surface exposée

| ID | Ticket | Défaut | Où |
| --- | --- | --- | --- |
| **S3-1** | Authentifier `api/files`, imposer une allowlist de préfixes, résoudre la clé via un enregistrement rattaché à l'établissement du demandeur | **B-07** — proxy S3 non authentifié sur tout le bucket ; seule protection `key.includes("..")`, inopérante sur S3 | `app/api/files/[...key]/route.ts:19-57` |
| **S3-2** | Préfixer les clés d'upload par `storeId` | Tous les locataires écrivent dans le même préfixe | `app/api/upload/route.ts:104` |
| **S3-3** | Vérifier réellement la signature SNS (téléchargement du certificat, chaîne canonique) et épingler le `TopicArn` | **B-08** — seule la *forme* de l'URL fournie par l'appelant est validée | `convex/emailHttpHandlers.ts:178-207` |
| **S3-4** | Assainir les SVG côté serveur dans `api/upload` ; remplacer le sanitiseur à base d'expressions régulières par DOMPurify en mode SVG | XSS stocké sur l'origine de la boutique. `<svg/onload=…>` passe le filtre actuel, qui exige un espace avant `on` | `app/api/upload/route.ts:76-82`, `packages/cms/src/sanitize/svgSanitizer.ts:31-34` |
| **S3-5** | Assainir le HTML riche **à l'écriture** et pas seulement à l'affichage | La seule barrière est un `DOMPurify` côté client, en aval | `packages/convex-functions/src/blog.ts:421-463` ; réutiliser `sanitizeContent` de `blogAutoGenerate.ts:307-321` |
| **S3-6** | Ajouter une `Content-Security-Policy` | Absente ; les autres en-têtes sont bien posés | `next.config.ts:12-25` |
| **S3-7** | Introduire une limitation de débit — **il n'en existe aucune dans toute l'application** — sur `api/contact`, `contactMessages.create`, `gamePlay.play`, `recordScan`, `translateUIStrings`, `api/upload`, et les tentatives de connexion | Relais d'inondation, drain de la clé OpenAI, parties illimitées | transverse |
| **S3-8** | Scoper et plafonner `getPresignedUploadUrl` (aucun `requireStoreAccess`, aucune contrainte de taille sur l'URL présignée) | Écriture d'un objet de taille arbitraire par tout compte | `convex/storageUpload.ts:68-117` |
| **S3-9** | Secret dédié pour `api/email/send` au lieu de réutiliser `BETTER_AUTH_SECRET` ; valider que `resetLink` appartient au domaine | La clé de signature des sessions sert de jeton d'API ; `resetLink` arbitraire = hameçonnage depuis un domaine vérifié | `app/api/email/send/route.ts:4`, `packages/core/src/aws/ses/route-handler.ts:21` |
| **S3-10** | Valider les 6 routes API avec Zod, comme l'impose le `CLAUDE.md` | Zéro Zod aujourd'hui ; seule une regex manuelle dans `contact-service` | `app/api/**/route.ts` |
| **S3-11** | Trancher l'incohérence de modèle : `storageUpload.ts:112` affirme que le bucket est public en lecture, `api/upload/route.ts:120` affirme l'inverse | L'une des deux hypothèses est fausse — donc l'une des deux protections est illusoire | — |
| **S3-12** | Idempotence des webhooks : stocker `sequence_guid` / `event_id` pour rejeter les rejeux | Un payload signé capté est rejouable indéfiniment | `deliverooWebhookHandler.ts`, `uberEatsWebhook.ts` |
| **S3-13** | Corriger l'attribution multi-locataire du webhook Uber Eats : en cas d'échec de `fetchOrder`, l'intégration retenue est `allIntegrations[0]` | La commande d'un restaurant atterrit chez un autre | `convex/uberEatsWebhook.ts:110-112` |

---

## 7. Sprint 4 — Pannes silencieuses

**But** : plus aucune fonctionnalité n'affiche un succès qu'elle n'a pas produit.
C'est la catégorie la plus dangereuse commercialement — le restaurateur découvre le
problème par son client, jamais par un message d'erreur.

| ID | Ticket | Symptôme | Où |
| --- | --- | --- | --- |
| **S4-1** | Corriger les rôles fantômes `["owner", "admin", "super_admin"]` — ces deux-là n'existent pas au schéma | **B-09** — le propriétaire (`client_admin`) ne peut rien enregistrer dans les réglages | `convex/globalSettings.ts:42,63` vs `packages/convex-schema/src/tables/userProfiles.ts:10-18` |
| **S4-2** | Réenregistrer `executeTranslation` et `batchChunk` en `internalAction` | `fetch` n'existe pas dans le runtime des mutations ; l'erreur est avalée et le job marqué `completed` | `convex/autoTranslate.ts:19,21` ; motif correct juste à côté dans `cmsAutoTranslate.ts:10` |
| **S4-3** | Rendre `getForDisplay` accessible sans session (requête publique ou jeton d'écran opaque) | L'écran TV en salle n'a pas de session : il reste bloqué sur « Chargement ». La charge utile est déjà anonyme | `convex/kitchenTickets.ts:86-89` ; motif disponible : `getByTrackingToken` `:275-307` |
| **S4-4** | Créer `convex/crons.ts` — **il n'en existe aucun** | Campagnes planifiées, autoBlog hebdomadaire/mensuel et `resetDailyQuota` ne se déclenchent jamais | nouveau fichier ; `emailCampaigns.ts:157-171`, `blogAutoConfig.ts:61` |
| **S4-5** | Découper l'envoi de campagne en lots planifiés (aujourd'hui : boucle séquentielle avec pause de 100 ms dans une seule action) | 5 000 abonnés ≈ 8 min d'attente pure → dépassement, campagne bloquée en `sending`, aucune reprise, doublons au retry | `convex/emailCampaignActions.ts:122-183` |
| **S4-6** | Envoyer réellement l'email de double opt-in | Le jeton et le statut `pending` sont créés, l'email n'est jamais construit ni envoyé ; l'inscrit reste `pending` à vie alors que l'UI dit « Vérifiez votre boîte mail ». **Obligation RGPD non tenue** | `packages/convex-functions/src/emailSubscribers.ts:140-161` ; le code sûr existe et est testé dans `packages/marketing/src/double-opt-in.ts` mais n'est appelé nulle part |
| **S4-7** | Ajouter les en-têtes `List-Unsubscribe` et `List-Unsubscribe-Post` | Exigence Gmail/Yahoo depuis 2024 ; en GET simple, les scanners anti-spam désabonnent les destinataires en préchargeant le lien | `convex/emailCampaignActions.ts:135-159` |
| **S4-8** | Asseoir le cooldown du jeu sur une identité serveur (IP ou cookie signé httpOnly) et non sur un UUID client | Le cooldown 24 h tombe avec `localStorage.clear()` → parties illimitées, stock de lots vidé en quelques secondes. Le champ `ipAddress` existe au schéma et n'est jamais écrit | `lib/game/fingerprint.ts:11-21`, `packages/convex-functions/src/gamePlay.ts:382,399-408` |
| **S4-9** | Corriger le repli `"anonymous"` : tous les appareils en navigation privée partagent une seule ligne de cooldown | Le premier joueur bloque tous les suivants pendant 24 h | `lib/game/fingerprint.ts:24` |
| **S4-10** | Exiger côté serveur que les actions requises soient couvertes avant `play` | `completedActions` est accepté tel quel : un appel direct saute tout l'écran d'actions | `packages/convex-functions/src/gamePlay.ts:364,432` |
| **S4-11** | Codes de lot : passer à un tirage cryptographique et échouer explicitement sur collision (aujourd'hui `Math.random()` et insertion malgré la collision après 5 essais) | Un doublon masque définitivement un lot ; `findRedemptionByCode` utilise `.first()` | `packages/convex-functions/src/gamePlay.ts:27-33,537-541` |
| **S4-12** | Impression cuisine : implémenter les trois fournisseurs cloud **ou** les retirer de la liste | `if (printConfig.provider !== "browser") return` — un restaurateur qui choisit Star/Epson/Sunmi voit ses tickets rester `pending` indéfiniment, sans erreur | `components/admin/kitchen/KitchenPrintTrigger.tsx:11,45` |
| **S4-13** | Ne plus marquer un ticket imprimé sur `onafterprint` (qui se déclenche aussi à l'annulation) ; ajouter un verrou serveur contre la double impression | Faux positif d'impression ; deux écrans cuisine ouverts = double impression | `KitchenPrintTrigger.tsx:38,50,135` |
| **S4-14** | Exposer une UI pour `stores.updatePrintConfig` | La mutation existe, aucune interface ne l'appelle : impossible d'activer l'impression | `convex/stores.ts:91` |
| **S4-15** | Désactiver les boutons du KDS pendant la mutation | Double-clic sur « Accepter » = double acceptation côté partenaire | `components/admin/kitchen/TicketCard.tsx:83-139` |
| **S4-16** | Borner `getByStore` et les requêtes du tableau de bord (`.collect()` non borné) | Tous les tickets depuis toujours chargés dans le navigateur de la cuisine ; le dashboard dépasse la limite de lecture Convex sur un restaurant actif | `packages/convex-functions/src/kitchenTickets.ts:21-30`, `orders.ts:21-30` |
| **S4-17** | Ajouter des frontières d'erreur (`error.tsx`) — **il n'en existe aucune** | Une requête Convex qui lève remonte en écran d'erreur Next au lieu d'un 403 lisible | `apps/reference/app/` |
| **S4-18** | Traiter le retour de Stripe Checkout côté abonnement : `replaceState(…, "/admin/subscription")` pointe vers une route inexistante | Après paiement, l'URL devient une 404 | `components/admin/subscription/SubscriptionPage.tsx:24` |

---

## 8. Sprint 5 — Vitrine et panier

| ID | Ticket | Symptôme | Où |
| --- | --- | --- | --- |
| **S5-1** | Indexer `removeItem` / `updateQuantity` sur une ligne (`lineId`) et non sur `productId` | Deux tailles de la même pizza : modifier l'une modifie les deux, supprimer l'une supprime les deux | `packages/restaurant/src/stores/cart.ts:79-96` ; surfaces `cart/page.tsx:234,301,316,339`, `cart-sheet.tsx:238,305,319,343` |
| **S5-2** | **Ajouter le test qui manque** : `cart.test.ts:49` crée bien deux lignes du même produit avec options différentes, mais n'en retire jamais une — exactement le cas qui casse | Le défaut S5-1 est passé sous un test existant | `packages/restaurant/src/__tests__/cart.test.ts` |
| **S5-3** | Bloquer l'ajout au panier sans options obligatoires depuis les favoris | Un plat avec option obligatoire part en cuisine sans taille | `components/storefront/favorites-grid.tsx:62-74` |
| **S5-4** | Supprimer le `productId` de repli fabriqué par `MealCard` | `"__fallback_…"` est rejeté par `v.id("products")` au checkout → **toute la commande échoue**, panier bloqué jusqu'à vidage | `components/website/meal-card.tsx:49`, `HomepageContent.tsx:44-47` |
| **S5-5** | Cloisonner la page produit par établissement | Un lien partagé ajoute au panier un produit d'un autre restaurant ; la commande échoue au checkout | `app/(storefront)/product/[productId]/page.tsx:42-44`, `client.tsx:41` |
| **S5-6** | Unifier les favoris sur Convex (deux systèmes déconnectés : localStorage sur l'accueil, Convex dans le compte) ; corriger le sélecteur zustand qui ne re-rend jamais | Un favori posé sur l'accueil n'apparaît jamais dans « Mes favoris » | `lib/stores/favorites-store.ts`, `lib/hooks/use-favorites.ts:15`, `components/website/favorite-button.tsx:26` |
| **S5-7** | Rattacher les adresses enregistrées à l'utilisateur | Persistance localStorage globale : sur un poste partagé, B voit et sélectionne l'adresse personnelle de A | `lib/stores/addresses-store.ts:41-99` |
| **S5-8** | Durcir la validation du checkout : téléphone et email requis en livraison, échec d'adresse explicite (aujourd'hui `return` sec, le bouton ne fait rien) | Livreur sans moyen de joindre le client ; commande envoyée en livraison sans adresse | `components/storefront/checkout-form.tsx:34-38,175-188` |
| **S5-9** | Avertir avant de vider le panier au changement d'établissement | Panier perdu sans confirmation ni message | `packages/restaurant/src/stores/cart.ts:106-114` |
| **S5-10** | **Décision produit** — Blog : brancher `listPublishedArticles` et créer `/blog/[slug]`, **ou** retirer la section | 6 articles codés en dur, aucune route d'article (tous les liens en 404), tout le pipeline éditorial (TipTap, publication, autoBlog, traduction) ne débouche sur rien | `app/(storefront)/blog/_components/BlogContent.tsx:18-73` |
| **S5-11** | **Décision produit** — i18n vitrine : brancher `createTranslator`, **ou** retirer le sélecteur de langue | Le traducteur et 3 locales existent ; aucune page de la vitrine ne les appelle. Le sélecteur recharge la page et tout reste en français | `lib/i18n/index.ts`, `components/storefront/language-selector-dropdown.tsx` |
| **S5-12** | Retirer la newsletter décorative du pied de page (affiche « Vous êtes inscrit » sans appel réseau) ou la brancher | Promesse fausse à l'utilisateur | `storefront-footer.tsx:29-34` |
| **S5-13** | Corriger le décalage sous l'en-tête fixe sur les pages qui ne compensent pas | Titres masqués sur `/product/[productId]` et `/store-selector` | `storefront-shell.tsx:32` — traiter au niveau du `<main>` plutôt que page par page |

> **S5-10 et S5-11 sont des décisions produit, pas techniques.** L'état actuel — une
> fonctionnalité visible qui ne fait rien — est la pire des trois options. Retirer est
> légitime et rapide ; brancher est légitime et coûte plus cher. Ne rien décider ne
> l'est pas.

---

## 9. Sprint 6 — Architecture et propreté

Non bloquant pour la mise en production, à traiter immédiatement après.

| ID | Ticket | Ampleur | Note |
| --- | --- | --- | --- |
| **S6-1** | Supprimer `lib/i18n.ts` — **en premier** | 91 lignes | Masque le dossier `lib/i18n/` (la résolution préfère le fichier), ce qui a déjà forcé un import de contournement en `@/lib/i18n/index`. Piège qui explosera au prochain import naïf |
| **S6-2** | Supprimer le code mort prouvé (zéro import, barrels inclus dans la recherche) | ~2 000 lignes | `components/admin/categories/` (451), `components/ui/` breadcrumb+chart+input-group+popover+scroll-area (783), `components/examples/` (185), `lib/json-ld.tsx` (137), `lib/seo.ts` (90), `lib/stores/marketing-store.ts` (89), `LanguageSwitcher.tsx` (61), `lib/store-url.ts` + `resolve-default-store.ts` (85), `app/api/translate/route.ts` (6) |
| **S6-3** | Faire de `packages/ui` la source unique des composants | 21 divergents, 0 identique | Deux design systems qui dérivent, dans l'app censée valider le design system. L'app consomme les deux : 109 imports locaux, 77 depuis le package |
| **S6-4** | Supprimer le fork de `useAdminStoreId` | 36 usages | **Deux sources de vérité pour l'établissement courant**, synchronisées seulement par un effet de bord dans `store-guard.tsx:48`. Une désynchronisation donne un filtrage multi-locataire faux dans la moitié de l'admin |
| **S6-5** | Supprimer `lib/admin/formatters.ts` (copie littérale, seuls les commentaires diffèrent) et `lib/admin/types.ts` (318 lignes redéclarant des types dérivés de Zod dans `packages/convex-schema`) | 400+ lignes | Le package les exporte déjà |
| **S6-6** | Remonter la logique métier dans les packages | ~3 700 lignes | `imageToProduct.ts` (774, aucun jumeau), `blogAutoGenerate.ts` (622, jumeau existant non importé), webhooks et actions Deliveroo/Uber Eats/Uber Direct (~1 900, alors que `packages/integrations` existe avec ses tests). 56 % de `convex/` ne délègue rien |
| **S6-7** | Migrer les 19 `goTo()` codés en dur du tour d'onboarding vers `adminRoutes`, puis remplacer les 37 stubs de redirection par `redirects()` dans `next.config.ts` | 190 lignes → une entrée de config | Les stubs ne survivent que pour rattraper ces 19 chemins ; ils violent la règle écrite dans `admin-routes.ts` lui-même |
| **S6-8** | Créer `dashboard/games/settings` (elle existe dans `apps/themes`) ou supprimer `adminRoutes.gamesSettings` + le stub + la ligne du spec ; durcir l'assertion `status < 500` qui laisse passer un 404 | — | `e2e/admin/coming-soon.spec.ts:11,28` |
| **S6-9** | Conditionner `address-test` hors production | 1 ligne | Fixture buildée en prod, hors `AuthGuard`, instanciant Google Maps avec la clé publique. Utilisée par une spec : conditionner, pas supprimer |
| **S6-10** | Compléter ou supprimer les 6 barrels morts | — | `components/ui/index.ts` n'exporte que `button` sur 36 composants ; la règle « barrel files » du `CLAUDE.md` n'est respectée qu'en façade |
| **S6-11** | Réduire le typage flou : 78 `: any`, 23 `as any`, 79 `eslint-disable no-explicit-any` | — | Prioriser `systemInternal.ts:84-111` (insertion sur table nommée dynamiquement, dans une fonction qui vide la table avant d'écrire). Laisser le cast de `storeFunctions.ts`, justifié et confiné. À noter : **zéro `@ts-ignore`** — la discipline de base est là |
| **S6-12** | Arbitrer la documentation | — | Supprimer `DASHBOARD_IMPLEMENTATION.md` (décrit un dossier disparu et une lecture par cookies qui se fait en Zustand) et `SETUP_SUMMARY.md` (promeut un composant mort et un package supprimé). **Trancher** la contradiction entre `MISE_EN_PROD.md` et `README.md:6,125` : banc d'essai, ou application déployable ? |
| **S6-13** | Aligner le `CLAUDE.md` sur la réalité | — | Il annonce « Vitest 80 %+ coverage » et un dossier `apps/reference/__tests__/` qui n'existe pas |
| **S6-14** | Fusionner `hooks/` et `lib/hooks/`, les deux vivants | — | Convention incohérente |
| **S6-15** | Découpler le démarrage des clés d'infrastructure | — | L'app refuse de démarrer sans `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` et `OPENAI_API_KEY`, y compris pour rendre la page d'accueil publique. Exiger ces clés à l'usage, pas au démarrage |

---

## 10. Garde-fous permanents

Ce qui distingue ce plan d'une session de rattrapage. Chacun est un ticket réel,
rattaché au sprint indiqué.

| Garde-fou | Empêche | Sprint |
| --- | --- | --- |
| La CI échoue si la suite e2e est sautée ou si `expected === 0` | Le retour du vert silencieux | S0-2 |
| Filtre console restreint aux bruits réellement inoffensifs | Qu'une 500 ou un `Access denied` passe inaperçu | S0-5 |
| Seuils de couverture sur `pnpm test` | L'érosion silencieuse des tests | S0-7 |
| Règle ESLint : pas de `query(defs.` / `authedMutation` nus dans `apps/*/convex/` sans annotation justifiée | La réapparition de fonctions non gardées | S2-11 |
| Test de registre : toute mutation `store*` déclare une `permission:` | Le retour du RBAC absent | S2-4 |
| Suite `convex-test` : un test négatif par fonction gardée | Les régressions de cloisonnement | S2-10 |
| Test qui résout toutes les cibles de `redirect()` et de `href` internes | Le retour des routes fantômes (les 4 routes de paiement en 404) | S1-7 |
| Interdiction d'un second design system : lint sur les imports `@/components/ui/*` une fois S6-3 fait | La redivergence des composants | S6-3 |

---

## 11. Définition de « fini »

Un ticket n'est fini que si les cinq points sont vrais :

1. Le correctif est écrit **dans le package** quand la logique y appartient, câblé dans l'app.
2. Un test **échoue sans le correctif** et passe avec. Pour les tickets de sécurité,
   c'est un test **négatif** (l'accès est refusé), pas seulement un test positif.
3. `pnpm lint && pnpm type-check && pnpm test && pnpm test:e2e` passent — avec la
   suite e2e **réellement exécutée**, pas sautée.
4. Aucun nouveau `any`, aucun nouveau `eslint-disable`, aucune nouvelle route sans garde.
5. Si le ticket retire une promesse de l'interface, l'interface est mise à jour dans
   le même commit — pas de fonctionnalité visible qui ne fait rien.

**Porte de mise en production** : S0 à S5 clos, plus une repasse de l'audit sur les
9 défauts bloquants, plus la preuve de morsure (S0-8) rejouée sur la branche finale.

---

## 12. Registre de risques

| Risque | Probabilité | Impact | Parade |
| --- | --- | --- | --- |
| S2 déborde : 112 sites à migrer, dépendances croisées | Élevée | Décale toute l'itération 2 | Migrer fichier par fichier avec son test négatif ; livrer par lots mergeables plutôt qu'en une PR géante |
| Réparer les specs (S0-3, S0-4) révèle des défauts encore inconnus | **Élevée** | Le périmètre grandit en cours de route | C'est attendu, pas subi : prévoir 20 % de marge sur l'itération 1. Une suite qui n'a jamais tourné cache forcément des choses |
| Le déploiement Convex de test coûte ou tarde | Moyenne | Bloque tout le plan | Le lancer **avant** le début du sprint — c'est le seul prérequis d'infrastructure |
| Les correctifs de S1 changent le contrat de `orders.create` | Moyenne | Casse `apps/themes` | Vérifier `apps/themes` à chaque changement de signature ; il consomme les mêmes packages |
| Retirer blog/i18n (S5-10, S5-11) est perçu comme une régression | Moyenne | Débat en fin de sprint | Trancher **avant** l'itération 3, pas pendant |
| S6-3 (design system unique) casse des écrans en silence | Moyenne | Régressions visuelles | Le faire après S0 : la suite e2e réparée devient le filet |

---

## 13. Hors périmètre

À nommer explicitement pour éviter le glissement :

- Toute évolution fonctionnelle nouvelle.
- La refonte du modèle de données ou du schéma Convex.
- `apps/site` et `apps/themes`, sauf le point S2-1 (héritage du seam d'autorisation)
  et les vérifications de non-régression.
- Les performances, hors les deux `.collect()` non bornés de S4-16 qui sont des
  pannes en devenir, pas des optimisations.
- L'accessibilité : les specs `auth-a11y` / `admin-a11y` sont référencées dans
  `playwright.config.ts:64,80` mais **n'existent pas sur disque**. À traiter dans un
  lot dédié, après celui-ci.

---

## Revue de contrôle du 21 août — trois escalades refermées

Trois relecteurs indépendants ont passé le diff complet (130 fichiers) au
crible. Ils ont trouvé des défauts **dans les correctifs eux-mêmes**. Les trois
escalades de privilèges sont refermées ci-dessous ; le reste est listé en
section « Reste à traiter ».

### E1 — Plafond global de promotion contournable

`usageCount` n'était incrémenté que si un email était fourni. Une promotion
`maxTotalUsage: 1` restait donc utilisable indéfiniment par des commandes
anonymes : la remise s'appliquait, le compteur ne bougeait jamais. Le plafond
*par client* avait été fermé, le plafond *global* non.

Le compteur avance maintenant dès qu'une promotion est appliquée ; seul le
registre `promotionUsages`, qui est indexé par email, reste conditionné. Les
emails sont normalisés en minuscules **des deux côtés** — sans quoi `A@b.com` et
`a@b.com` étaient deux clients distincts.

### E2 — Un propriétaire pouvait éjecter le super-administrateur

`assertCanAssignProfile` ne raisonnait que sur le rôle **demandé**. Or `upsert`
écrase. Un `client_admin` écrivait donc
`{ userId: <le super-admin>, role: "customer", storeIds: [] }` : rôle non
administratif, aucun établissement étranger, toutes les vérifications
passaient — et le déploiement se retrouvait sans administrateur.

La politique reçoit désormais le **profil existant** de la cible et refuse deux
choses de plus : toucher à quelqu'un qui détient déjà un rôle d'administration,
et réassigner un membre rattaché à un établissement qu'on n'administre pas
(sinon on débauche le personnel d'un confrère).

### E3 — Accepter une invitation écrasait le profil

Trois conséquences réelles : inviter le super-administrateur en `kitchen` le
rétrogradait dès qu'il cliquait ; un gérant invité dans un second restaurant
perdait le premier ; et une adhésion « tous établissements » produisait une liste
vide, donc le membre ne recevait **rien** tout en perdant ce qu'il avait — le bug
de l'écran décoratif, recréé.

`invitationGrant` fusionne maintenant au lieu de remplacer : jamais de
rétrogradation, jamais de perte d'établissement. Une invitation **ajoute** un
lieu de travail, elle ne redéfinit pas la personne.

### E3bis — La révocation, moitié manquante du pont

J'avais construit l'octroi sans la reprise. Retirer un membre supprimait la ligne
`teamMembers` et laissait `userProfiles` intact : un employé licencié disparaissait
de l'écran d'équipe en gardant `manager` sur le restaurant. `revocationEffect`
retire l'établissement concerné et rend le rôle `customer` quand il n'en reste
aucun — sans jamais rétrograder un administrateur, dont l'autorité ne vient pas
du registre.

### Aussi corrigé

`globalSettings.get` ne retirait que 2 des 4 credentials Uber Direct :
`customerId` et `apiKey` étaient servis à tout visiteur anonyme, alors que mon
annotation `@public-by-design` affirmait le contraire. C'est exactement le
blanchiment que la double annotation devait empêcher.

**Preuves de morsure** : garde E2 neutralisée → 3 tests au rouge ; fusion E3
désactivée → 3 tests au rouge. Restauration vérifiée à **448/448**.

### Reste à traiter (relecture du 21 août)

| Sujet | Origine |
| --- | --- |
| La règle ESLint ignore `action(…)` — ~56 actions publiques non couvertes, dont `kitchenTickets.acceptTicket/completeTicket/cancelTicket` pilotables par tout compte | mien |
| `orders.updateStatus` sous `orders:write` : le rôle `delivery` ne peut plus faire avancer une commande | mien |
| `payments.create` / `updateStatus` sous `payments:refund` — mauvais verbe | mien |
| `MANAGER` privé de `marketing:*` alors que l'UI équipe le lui promet | arbitrage à trancher |
| `client_admin` bloqué sur `orders.remove` et `contactMessages.updateStatus` | mien |
| Page de succès : la branche sans référence prestataire déclare le paiement reçu et vide le panier sans rien vérifier (retour 3-D Secure SumUp) | mien |
| `/track/[token]` inatteignable : le bouton pointe vers `/order/…`, qui plante pour un invité | mien |
| Rechargement de la page de succès PayPal → `ORDER_ALREADY_CAPTURED` → écran d'échec sur une commande payée | mien |
| Mode `percentage` : adresse enregistrée sans coordonnées = impasse silencieuse | mien |
| Devis de livraison non lié à l'adresse commandée ni à usage unique | mien |
| Remboursement : pas de verrou avant l'appel prestataire, `externalRefundId` scalaire écrasé par un second remboursement partiel | mien |
| `claimFirstAdmin` : course ouverte sur un déploiement neuf | mien |
| Sync menu Deliveroo/Uber Eats morte (`getByStorePlatform` store-scopée appelée par un planificateur) | **préexistant** |
| `duplicateCatalog` garde la source au lieu de la cible | **préexistant** |
| `uberEatsActions` (10 actions) et `getDeliveryQuote` sans garde | **préexistant** |

---

## Passe `apps/themes` — étape 1 : le seam et la garde (21 août)

Le seam était **déjà** en place : `apps/themes/convex/lib/storeFunctions.ts` est
identique à celui de reference et instancie la même fabrique du paquet. Rien à
porter de ce côté.

La règle ESLint, elle, n'existait que dans `apps/reference`. Elle vit maintenant
dans `packages/convex-functions/eslint/convex-auth.mjs`, à côté du seam qu'elle
protège, et les deux applications l'importent. Une règle qui n'aurait existé que
dans le banc d'essai aurait laissé le gabarit client — celui qu'on clone chez le
restaurateur — redériver vers exactement l'habitude qu'elle existe pour arrêter.

**Ce que la règle a trouvé en arrivant dans `apps/themes` :**

| | reference | themes |
| --- | --- | --- |
| `no-unguarded-convex-function` | 0 | **230** |
| `require-convex-permission` | 0 | **29** |
| | | **259 erreurs sur 38 fichiers** |

Reference reste à 0 erreur / 70 avertissements après le déplacement.

### Ce que la mesure a révélé sur la dérive themes ↔ reference

`apps/themes/convex` ne porte **aucun** marqueur `PATCH BOILERPLATE` : c'est un
miroir pur de `apps/reference/convex`, pas une variante. Sur 92 fichiers :

- **47 identiques**
- **45 divergents** — la divergence est le durcissement des sprints 1 et 2
- **6 absents de themes** : `prizeRedemptions.ts`, `gamePlay.ts`,
  `requiredActions.ts`, `gameEmail.ts`, `maintenance.ts`, `maintenanceEmail.ts`

Ces six-là expliquent le plantage signalé en relecture : `GamesPage` appelle
`api.prizeRedemptions.*`, module absent. **Tout le parcours jeu QR est mort dans
le gabarit client** — pas seulement la page des lots.

Comparaison des surfaces exportées, fichier par fichier : elles coïncident
partout sauf six exports, et les six sont précisément les fuites que reference a
fermées.

| Fichier | themes seul | reference seul |
| --- | --- | --- |
| `orders.ts` | `getByCustomer` | — |
| `teamMembers.ts` | `getByUser` | `getMyMemberships`, `internalAssertCanManage`, `internalAssertCanManageMember` |
| `ownerEntitlements.ts` | `getByOwnerId` | `internalGetByOwnerId`, `internalUpsert` |
| `storeIntegrations.ts` | `getByBrandId`, `getBySiteId`, `listByPlatformEnabled` | `internalGetByBrandId`, `internalGetBySiteId` |
| `bidSubscription.ts` | — | `createMaintenanceCheckoutSession` |

Conclusion opérationnelle : la suite n'est pas 38 corrections à la main mais un
**alignement du miroir**, reference → themes, appelants compris. Reference a déjà
mis à jour ses propres appelants (`deliverooWebhook`, `deliverooMenuSync`,
`uberEatsMenuSync` pointent vers les versions internes), donc l'opération est
cohérente d'un bloc. À vérifier avant de la lancer : les appelants hors `convex/`
(`app/`, `components/`, `lib/`) qui référencent encore les noms publics
supprimés.

### Étape 1 bis — vérification des appelants hors `convex/` (21 août)

Avant d'aligner le miroir, il fallait s'assurer que les six exports que
reference a supprimés ou rendus internes ne sont appelés nulle part ailleurs
dans themes. Ils ne le sont pas :

| Zone balayée | Appelants de `getByCustomer`, `getByUser`, `getByOwnerId`, `getByBrandId`, `getBySiteId`, `listByPlatformEnabled` |
| --- | --- |
| `apps/themes/{app,components,lib,hooks}` | 0 |
| `packages/*` | 0 |

Confrontation exhaustive : chaque `api.<module>.<fn>` du code applicatif de
themes, vérifié contre la surface que `convex/` exposera après alignement.
**Aucun appel ne casserait.** L'alignement du miroir `convex/` est sûr.

#### Ce que la vérification a trouvé en plus

Le premier balayage ne couvrait que `apps/themes` et n'a rien vu. C'était le
mauvais périmètre : les pages admin de themes montent des composants venus de
**`packages/admin`**, et c'est là que vivent les appels. Élargi au paquet :

| Module appelé | Par | État dans themes |
| --- | --- | --- |
| `prizeRedemptions.getStats`, `.listPlays`, `.listRedemptions`, `.redeemByCode` | `games-page.tsx`, `winners-page.tsx` | **module absent** |
| `requiredActions.list`, `.create`, `.update`, `.remove` | `actions-page.tsx` | **module absent** |

themes route bien vers ces pages (`dashboard/games`, `games/winners`,
`games/actions`). Elles plantent au rendu.

**Pourquoi `tsc` ne le voit pas** : `app/(admin)/layout.tsx` injecte l'api via
`setApi(api as unknown as Record<string, unknown>)`, et le store la stocke en
`any`. Le typage est perdu à la frontière — la seule sanction est un
`TypeError` au rendu. Une classe de panne que ni le typecheck ni le lint ne
peuvent attraper, et que seul l'alignement ferme.

#### Ce que l'alignement de `convex/` ne réparera PAS

- **Le parcours jeu QR vitrine est un placeholder**, pas un bug. themes livre
  un `GameContent.tsx` de 28 lignes affichant « Gamification flow will be
  implemented here ». Manquent aussi les 10 composants de jeu, les 8 fichiers
  `lib/game/` (roue, confettis, empreinte, sons) et toute la route
  `/game/prize/[code]`. Le gabarit client vend une fonctionnalité qu'il
  n'embarque pas.

#### Fausses pistes écartées (vérifiées, non défectueuses)

- `maintenance.ts` / `maintenanceEmail.ts` absents : **correct**. C'est le
  verrou de mise à jour du moteur, et themes ne l'appelle nulle part.
- `lib/services/contact-service.ts` absent : inutilisé dans themes.
- Les routes Next `api/webhooks/{stripe,deliveroo/*}` propres à themes ne sont
  pas un second chemin non gardé : ce sont des pierres tombales renvoyant
  `410` vers l'endpoint Convex. Vérifié en lisant les trois fichiers.

#### Réserve sur la portée

L'alignement en bloc se justifie pour `convex/` — les surfaces exportées
coïncident et themes ne porte aucun `PATCH BOILERPLATE`. Il ne se justifie
**pas** tel quel pour `app/` et `components/` : themes y possède 47 composants
et 5 routes que reference n'a pas. Ces zones se traitent à la main, pas en bloc.

### Étape 2 — alignement du miroir `convex/` (21 août)

50 fichiers alignés sur `apps/reference/convex`, dont les **6 modules absents**
(`prizeRedemptions`, `requiredActions`, `gamePlay`, `gameEmail`, `maintenance`,
`maintenanceEmail`), plus `_generated/api.d.ts` — le codegen Convex exige un
déploiement configuré, mais `_generated/` ne contient rien de spécifique à un
déploiement et les cinq fichiers ne divergeaient que des 12 lignes des modules
manquants. Vérifié fichier par fichier avant transposition.

| | avant | après |
| --- | --- | --- |
| erreurs de lint | 259 | **0** |
| fonctions store-scopées | 29 | 189 |
| dont sans `permission:` | 23 | **0** |
| annotations | 4 | 94 |
| appels de `packages/admin` dans le vide | 8 | **0** |
| fuites publiques (`getByUser`, `getByCustomer`, …) | 6 | **0** |

`pnpm build` passe, `tsc --noEmit` passe. Reference reste à 0 erreur,
122 tests verts ; le paquet à 448/448.

**Preuve de morsure dans themes** : permission retirée de `prizes.ts` →
`require-convex-permission` au rouge ; `storeQuery` dégradé en `query` →
`no-unguarded-convex-function` au rouge. Fichier restauré à l'identique.

#### Deux divergences délibérées, conservées

Le balayage préalable des 45 diffs a évité deux dégâts qu'un copier-coller en
bloc aurait causés :

- **`auth.ts`** — reference fait confiance à `localhost:3000-3003` parce que ses
  espaces de travail se disputent les ports. Un site client tourne sur son
  domaine et n'a aucune raison d'accepter une origine de développement. themes
  garde sa liste stricte ; seule l'annotation a été portée. La raison est
  inscrite dans le fichier pour qu'une future synchro ne la « corrige » pas.
- **`http.ts`** — le commentaire de reference affirme que les routes Next
  `/api/webhooks/*` ont été supprimées. C'est vrai chez elle, faux dans themes,
  qui les garde comme pierres tombales `410`. Commentaire réécrit pour dire ce
  qui est réellement vrai là où il se trouve.

Deux fichiers divergent donc encore, et c'est voulu. Tout le reste est identique.

#### Ce qui reste ouvert sur themes

- Le parcours jeu QR **vitrine** reste un placeholder de 28 lignes : le backend
  est là maintenant, l'interface non (10 composants, 8 fichiers `lib/game/`, la
  route `/game/prize/[code]`). L'admin du jeu, lui, fonctionne.
- `app/` et `components/` ne sont pas alignés et ne doivent pas l'être en bloc :
  themes y possède 47 composants et 5 routes que reference n'a pas.

---

## Relecture, point 1 — la règle ESLint était aveugle aux `action(…)` (21 août)

`BARE_BUILDERS` couvrait `query` et `mutation`, les deux constructeurs que
l'audit avait pris en flagrant délit, et s'arrêtait là. Une action est pourtant
tout aussi publiquement appelable. **56 actions** passaient donc à côté du
garde-fou dans chaque application.

La règle les couvre désormais, avec un message distinct : conseiller
`storeQuery` à une action serait absurde — elle n'a pas de `ctx.db`. Le message
renvoie vers `ctx.runQuery(internal.…)` et `@guarded-inline`.

### Triage des 56 (reference)

Le classement par nom de fonction ne suffisait pas : `internalLoadForRefund`
appelle `requireStorePermission` dans son corps, et mon premier balayage l'avait
rangée en « aucune garde » ; à l'inverse `internalAssertCanManage` était bien
une garde que je cherchais en minuscules. Il a fallu **résoudre chaque cible
interne** et inspecter son corps.

| Verdict | Nombre | Traitement |
| --- | --- | --- |
| déjà correctement gardées | 14 | annotation `@guarded-inline` |
| publiques par nature (paiement invité, devis de livraison) | 7 | `@public-by-design` motivée |
| « connecté » seulement | 25 | garde réelle ajoutée |
| rien du tout | 10 | garde réelle ajoutée |

### Les trous réels qui ont été fermés

- **Cuisine** (`acceptTicket`, `readyTicket`, `completeTicket`, `cancelTicket`) :
  tout compte connecté pouvait accepter, avancer, terminer ou annuler un ticket
  dans n'importe quel restaurant. Désormais `kitchen:write` sur la boutique du
  ticket — vérifié par test que la cuisine garde l'accès au sien.
- **`uberEatsActions`** (10 actions) : activer une intégration, réécrire un
  article de menu, créer une promotion, marquer une commande prête. Le helper
  local `requireAuth` ne vérifiait que la session ; il exige maintenant
  `settings:write` par rôle. Ces actions manipulent des UUID Uber Eats, pas des
  ids Convex : il n'y a pas de locataire sur lequel se rabattre.
- **Synchro de menu** (Deliveroo ×2, Uber Eats ×1) : aucune garde.
  → `products:write` sur la boutique synchronisée.
- **OAuth prestataire** (`oauthConnect.generateOAuthUrl`,
  `uberEatsOAuth.*`) : brancher un encaisseur de paiement ne demandait qu'un
  compte. → `settings:write`.
- **S3** (`getPresignedUploadUrl`, `getPresignedUrlForMedia`) : n'importe quel
  compte obtenait une URL d'envoi. → `content:write`, et sur le média la garde
  s'accroche à la boutique propriétaire.
- **Import de catalogue** (Deliveroo, Uber Eats) et **traduction** :
  → `products:write` / `translations:write` sur le `storeId` reçu.

### Un défaut réparé au passage

`deliverooOrders.acceptOrder/rejectOrder/updatePrepStage` lisaient la commande
via `api.orders.getById`, qui ne répond qu'au client propriétaire ou au porteur
du jeton de suivi — **jamais au personnel**. Ces trois actions tombaient donc
systématiquement sur « Order not found ». Vérifié sur `main` : préexistant, pas
une régression du sprint. Elles lisent maintenant par le chemin interne et
vérifient `orders:update_status` sur la boutique de la commande.

### Nouvelle garde : `authHelpers.checkPermission`

`checkStorePermission` ne peut rien dire d'une opération sans boutique —
brancher Stripe, démarrer un OAuth Uber Eats, demander une URL S3. Et « est
connecté » n'est pas une réponse : ça inclut tout client ayant commandé une
pizza une fois. La nouvelle garde vérifie la permission **par rôle**.
`hasPermission` échoue fermé sur une chaîne inconnue, donc une faute de frappe
refuse au lieu d'accorder — un test le fige.

### Ce que la règle ne prouve PAS

Preuve de morsure en deux temps :

1. Annotation retirée d'`acceptTicket` → règle au rouge. ✅
2. `requireAuth` ramené à « connecté » en **gardant** les annotations →
   **aucune erreur**. La règle lit la revendication, elle ne la vérifie pas.

C'est une limite inhérente à une règle de lint, et la nommer vaut mieux que
l'ignorer. Elle est comblée par **7 tests** sur les deux helpers par lesquels
passent toutes les actions gardées : refus d'un client, refus d'un manager
d'un autre établissement, refus de la cuisine sur un réglage global, acceptation
du propriétaire, et refus sur permission inconnue. Garde neutralisée →
3 tests au rouge ; restaurée → 129 verts.

**Portes** : reference lint 0 erreur, type-check OK, 129 tests (contre 122).
themes lint 0 erreur, typecheck OK, `pnpm build` OK. 29 fichiers reportés sur
themes ; `auth.ts` et `http.ts` restent volontairement à l'écart.

## Relecture, point 2 — les permissions qui nommaient le mauvais verbe (21 août)

Quatre points d'appel refusaient quelqu'un que le produit place au centre.

| Fonction | Avant | Après | Qui était refusé |
| --- | --- | --- | --- |
| `orders.updateStatus` | `orders:write` | `orders:update_status` | la **cuisine** et la **livraison**, dont c'est tout le métier |
| `payments.create` | `payments:refund` | `payments:write` | verbe faux : encaisser n'est pas rembourser |
| `payments.updateStatus` | `payments:refund` | `payments:write` | idem |
| `orders.remove` | `orders:delete` | inchangé | le **propriétaire**, à qui la table ne donnait pas `orders:delete` |
| `contactMessages.updateStatus` | `customers:write` | inchangé | le **propriétaire**, à qui la table ne donnait pas `customers:write` |

Deux des cinq ne se corrigent donc pas au point d'appel mais dans la table des
rôles : le verbe y était juste, c'est le rôle qui ne l'avait pas. `client_admin`
gagne `orders:delete`, `payments:write` et `customers:write` — un propriétaire
qui peut supprimer un produit, un membre d'équipe et une page, mais pas une
commande de son propre restaurant, c'était un oubli, pas une politique.

`payments:write` est ajouté aux deux rôles qui détenaient déjà `payments:refund`,
et à eux seuls : le verbe est réparé sans que l'accès effectif ne bouge. Élargir
au manager ou au serveur serait une décision produit distincte, non prise ici.

### Le test qui ne prouvait rien

La première version de ces tests interrogeait `checkStorePermission` avec des
**chaînes** de permission. Preuve de morsure : remettre `orders:write` sur
`orders.updateStatus` les laissait **tous au vert**. Ils validaient la table des
rôles et rien du point d'appel — une couverture qui se lit comme une garantie
sans en être une.

Réécrits pour appeler les vraies mutations avec un vrai document. Nouvelle
preuve de morsure :

| Régression simulée | Effet |
| --- | --- |
| `orders:write` remis sur `updateStatus` | **2 tests au rouge** |
| `orders:delete` retiré au `client_admin` | **1 test au rouge** |
| restauration | 135 verts |

Un test intermédiaire a d'ailleurs échoué pour une bonne raison :
`confirmed → out_for_delivery` n'est pas une transition légale. C'était le test
qui était faux, pas le code ; le coursier enlève une commande **prête**.

**Portes** : reference 135 tests (contre 129), 0 erreur de lint, type-check OK.
themes 0 erreur, typecheck OK. `packages/core` 195, `convex-functions` 448.

### Reste en suspens : le manager et le marketing

`DEFAULT_ROLE_PERMISSIONS` dans `packages/admin/src/pages/team/team-page.tsx`
coche **tous** les modules pour un manager, « Jeux / Marketing » compris. La
table RBAC ne lui donne ni `marketing:read` ni `marketing:write` ni
`games:write`. L'écran promet, le serveur refuse.

Deux issues opposées — élargir le rôle, ou cesser de le promettre — et le choix
est une décision produit, pas un correctif.

**Arbitré le 21 août : élargir le manager.** `MANAGER` reçoit `marketing:read`,
`marketing:write` et `games:write`. L'écran disait vrai, c'est la table qui
avait tort. Un manager mène désormais campagnes et jeux du restaurant qu'il
dirige — et rien de plus : quatre tests figent qu'il ne franchit pas la
frontière d'établissement, et que le serveur n'a pas été élargi au passage.

| Régression simulée | Effet |
| --- | --- |
| `marketing:write` et `games:write` retirés au manager | **2 tests au rouge** |
| restauration | 139 verts |

Un de ces tests a d'abord échoué sur un argument manquant (`ruleOperator`) —
mon test était incomplet, pas le code.

---

## Bloc paiement et suivi de commande (21 août) — 3 défauts sur 5

### 1. La page de succès déclarait un paiement reçu sans rien vérifier

La branche finale de `checkout/success/page.tsx` posait `state: "paid"` et
vidait le panier. Son commentaire disait « a cash order, or a manual visit ».
**Faux** : le comptant confirme sur `checkout/page.tsx` et n'atterrit jamais
ici. Ce qui y atterrit, c'est un retour qui a perdu sa référence — le
**3-D Secure SumUp** avant tout : `redirectUrl` vaut
`…/checkout/success?orderId=…` sans `checkoutId`, et c'est ce lien que la banque
utilise, en contournant le widget qui, lui, aurait ajouté la référence.

Une carte refusée obtenait donc un écran de confirmation.

La branche interroge maintenant le serveur — nouvelle requête
`orders.getPaymentState`, qui rend le statut, l'état et le numéro de commande,
**et rien d'autre** : ni client, ni adresse, ni montant. Payé → confirmation et
panier vidé. Sinon → écran « paiement en attente ». Sans `orderId` → lien
incomplet, annoncé comme tel.

### 2. Recharger la page de confirmation PayPal cassait une commande payée

`capturePayPalOrder` appelait PayPal **avant** de lire quoi que ce soit. Une
capture ne se fait qu'une fois : au rechargement, PayPal renvoie
`ORDER_ALREADY_CAPTURED`, l'action lève, et le client voit « Confirmation
impossible » sur une commande bel et bien payée. Le garde-fou `hasRun` côté
React ne protégeait que du re-rendu, jamais du rechargement.

La commande est lue en premier ; si elle est déjà payée, l'action rend le
résultat sans toucher au prestataire. L'idempotence appartient au serveur.

Stripe et SumUp ne relisent qu'un statut — rejouables sans dommage. Vérifié.

### 3. Le remboursement : pas de verrou, et une preuve écrasée

`recordRefund` revalidait contre un document frais, donc la base ne pouvait pas
dépasser le solde. Ce qu'elle ne pouvait pas faire, c'est s'exécuter **avant**
le prestataire : deux demandes simultanées lisaient toutes deux
`refundedAmount: 0`, passaient toutes deux `planRefund`, et envoyaient toutes
deux l'argent. La base restait cohérente, la caisse non.

Remplacé par un remboursement à deux temps — une mutation Convex étant une
transaction, la réservation est le point de sérialisation :

| Étape | Rôle |
| --- | --- |
| `reserveRefund` | engage le montant **avant** l'appel prestataire |
| `confirmRefund` | attache la référence prestataire **à ce remboursement-là** |
| `releaseRefund` | rend le montant si le prestataire refuse |

Et `externalRefundId`, champ scalaire, était écrasé par chaque remboursement
partiel : le premier perdait sa preuve et devenait irréconciliable. Un tableau
`refunds` conserve désormais chaque opération ; le scalaire pointe toujours vers
le dernier, pour les écrans qui le lisent.

**Un bug que mes propres tests ont attrapé** : ma première version de
`releaseRefund` reposait le statut à `completed` — que `REFUNDABLE_STATUSES`
rejette. Libérer un remboursement échoué aurait rendu l'argent définitivement
non remboursable, l'exact contraire du but. Corrigé en `succeeded`, et figé par
un test dédié.

**Preuve de morsure** : statut de libération remis à `completed` → 2 tests au
rouge ; restauration → 457 verts.

**Portes** : `convex-functions` 457 (contre 448), `core` 195, reference 139
tests / 0 erreur, themes 0 erreur, typechecks OK.

### Reste du bloc

- `/track/[token]` inatteignable pour un invité : la page commande obtient le
  jeton de suivi via `kitchenTickets.getByOrder`, désormais store-scopée sous
  `kitchen:read` — un invité est refusé, donc le lien ne s'affiche jamais.
- Devis de livraison non lié à l'adresse ni à usage unique ; mode `percentage`
  avec adresse enregistrée = impasse silencieuse.

---

## Audit des moyens de paiement (21 août) — constat, aucun correctif

Demandé en cours de bloc : les moyens de paiement sont-ils tous configurables,
codés et testés ? Vérifié dans le code, sans accès à un compte.

### Ce que l'écran de réglages offre

Carte (`stripe` | `sumup`, avec Connecter/Déconnecter OAuth), PayPal (bascule +
e-mail), Espèces (bascule, limitée au retrait/sur place et au client connecté).
**Square est absent de l'écran.**

### Matrice prestataire × cycle de vie

| | Stripe | SumUp | PayPal | Square | Espèces |
| --- | --- | --- | --- | --- | --- |
| Écran de config | oui | oui | oui | **non** | oui |
| Création d'encaissement | oui | oui | oui | **non** | oui |
| Vérification au retour | oui | oui | oui | **non** | n/a |
| Remboursement | oui | oui | oui | refus explicite | manuel |
| Webhook | oui, signé | **non** | **non** | **non** | n/a |
| Connexion OAuth | stockée mais **ignorée** | stockée et **utilisée** | **aucune** | **non** | n/a |

### Les cinq dettes

1. **La connexion Stripe est stockée puis ignorée.**
   `/connect/stripe/callback` écrit un `paymentConnections` et l'écran affiche
   « connecté », mais `stripe.ts` ne référence aucun compte connecté —
   ni `stripeAccount`, ni `on_behalf_of`, ni `transfer_data`. L'encaissement
   passe toujours par `STRIPE_SECRET_KEY`, la clé de la plateforme. Le
   restaurateur croit encaisser sur son compte. SumUp, lui, lit et déchiffre
   réellement le jeton du commerçant.

2. **`paypalEmail` n'est jamais lu.** Le champ existe dans les réglages et le
   schéma ; `paypal.ts` ne contient ni `payee` ni `email_address`. Le schéma
   `paymentConnections` accepte `paypal` en commentant « merchant_id from
   onboarding webhook » — ce webhook n'existe pas.

3. **Ni SumUp ni PayPal n'ont de webhook.** Seule la page de retour confirme le
   paiement. Un client qui paie puis ferme son onglet laisse la commande en
   `pending` indéfiniment. Stripe est le seul couvert, signature vérifiée.

4. **Square est un fantôme.** Présent dans le schéma `payments`, dans le type
   `PaymentProvider`, dans un filtre de l'écran paiements, dans `CLAUDE.md` et
   dans deux pages de doc (`SQUARE_ACCESS_TOKEN=`). Zéro ligne
   d'implémentation, aucune variable d'environnement déclarée. Seul
   `routeRefund` le traite honnêtement, en `unsupported`.

5. **Le bouton « carte » n'est jamais conditionné.** PayPal et espèces sont
   masqués si désactivés ; la carte s'affiche toujours, même sans prestataire
   configuré. Le client remplit tout, valide, et reçoit
   `STRIPE_SECRET_KEY is not configured`.

### Couverture de tests

44 tests couvrent la **logique** (règlement, anti-rejeu inter-commandes,
montants, devises, remboursement à deux temps). Solide.

**Aucun test ne couvre les actions prestataire** — `createCheckoutSession`,
`createPayPalOrder`, `createCheckout`, `verify*`, `internalRefund`. Aucun appel
HTTP simulé. La logique pure est tenue, la couture avec les API ne l'est pas.

### Décision

**Aucun correctif maintenant** (arbitré le 21 août). Les points 1 et 2 changent
un flux d'argent et relèvent de la branche prestataires annoncée en début de
sprint, bac à sable en main. Les points 3, 4 et 5 sont plus circonscrits et
restent à planifier.

## Bloc paiement et suivi — les deux derniers (21 août)

### 4. `/track/[token]` était injoignable — régression de mon propre durcissement

La page de confirmation lisait le jeton de suivi via
`kitchenTickets.getByOrder`. Le sprint 2 l'a mise sous `kitchen:read` : correct,
et ça a cassé la fonctionnalité pour les seules personnes qui en ont besoin. Un
invité est refusé, le jeton revient `undefined`, le bouton « Suivre ma commande »
ne s'affiche jamais. La route `/track/[token]` existait sans que rien ne puisse
l'atteindre. **Rien n'a échoué bruyamment** — c'est ce qui rend ce genre de
régression coûteux.

Le correctif n'est pas de rouvrir la requête cuisine mais de servir le jeton
depuis le chemin de lecture de la commande, sous la règle qui la gouverne déjà :
le jeton de vue émis à la commande, ou le client qui l'a passée
(`orders.getTrackingToken`).

Même défaut sur les écrans « en attente » et « échec » de la page de succès :
`settle()` recevait le jeton de vue et le jetait, puis `Actions` proposait
`/order/…` sans jeton — une page vide pour un invité. Le jeton est transporté, et
le bouton ne s'affiche que s'il est utilisable.

**Preuve de morsure** : contrôle de propriété neutralisé → 1 test au rouge.

### 5. Le devis de livraison n'était lié ni à l'adresse ni à un usage

`orders.create` vérifiait l'existence, le restaurant et l'expiration. Deux trous
restaient.

La table `deliveryQuotes` stocke `dropoffLatitude` / `dropoffLongitude` avec le
commentaire « to detect a changed address » — **personne ne les lisait**. Un
devis pris pour l'immeuble d'à côté payait une livraison à trente kilomètres. Et
le devis était réutilisable indéfiniment : un seul devis bon marché payait toutes
les livraisons futures.

La règle est extraite en module pur `deliveryQuote` — comme `promotionDiscount`
et `refundPolicy`, parce que chaque refus décide de ce que le client paie :

| Refus | Cause |
| --- | --- |
| `missing` / `wrong_store` / `expired` | déjà couverts, désormais testés |
| `already_used` | **nouveau** — `consumedByOrderId` marque le devis à la création |
| `address_mismatch` | **nouveau** — tolérance de ~110 m, l'écart d'un géocodeur, pas d'une rue |
| `address_not_located` | **nouveau** — et le message dit quoi faire |

Ce dernier refus est l'impasse signalée en relecture : une adresse enregistrée
sans coordonnées produisait « un devis de livraison est requis », ce qui ne dit
rien à un client qui vient justement d'en saisir une. Le message renvoie
maintenant vers les suggestions d'adresse.

**Preuve de morsure** : tolérance de coordonnées rendue énorme → 2 tests au
rouge ; usage unique neutralisé → 1 test au rouge.

**Portes** : `convex-functions` 473 (contre 457), `core` 195, reference 143
tests / 0 erreur, themes 0 erreur, `pnpm build` OK, typechecks OK.

**Le bloc paiement et suivi de commande est clos : 5 défauts sur 5.**

---

## Les trois derniers points de la relecture (21 août)

### 1. Synchro de menu morte — et j'avais aggravé le cas

Le défaut signalé était réel : `syncStore` lisait l'intégration via
`api.storeIntegrations.getByStorePlatform`, store-scopée, donc exigeant une
session — que le balayage planifié n'a pas.

**Et j'avais empilé dessus.** Au bloc précédent j'ai posé
`checkStorePermission` sur `syncStore` sans lire le commentaire situé trois
lignes plus bas, qui disait exactement ceci :

> `Note: No auth check here — syncStore is also scheduled by syncAllStores (no user context).`

Le balayage appelait `api.*.syncStore` : ma garde l'aurait tué net.

Séparé en deux : `syncStore` reste l'action publique gardée et n'est plus qu'une
coquille ; `internalSyncStore` porte le travail et n'est joignable ni depuis un
navigateur ni sans identité. Le balayage l'appelle directement, et lit
l'intégration par `internal.storeIntegrations.internalGetByStorePlatform`.

**Un test structurel gèle l'invariant** : aucune `internalAction` ne doit
appeler une fonction **gardée**. Il ne peut pas être comportemental — le
planificateur n'est pas quelque chose que `convex-test` exécute — donc il est
assuré contre la source.

Sa première version interdisait tout `api.*` et a immédiatement dénoncé quatre
cas. Trois étaient de faux positifs — `products.list`, `categories.list` et
`stores.getById` sont publiques par conception, une synchro a le droit de lire
le catalogue — et le quatrième était l'URL `https://api.sumup.com`. **La règle
était trop stricte, pas le code.** Resserrée sur le vrai critère : la cible
est-elle enveloppée dans `storeQuery` / `storeMutation` / `authed*`. Un second
test vérifie que le détecteur reconnaît bien une fonction gardée, sans quoi
l'assertion passerait en ne prouvant rien.

**Preuve de morsure** : balayage remis sur l'action gardée → 1 test au rouge.

### 2. `duplicateCatalog` gardait la source, pas la cible

`storeIdFrom` pointait sur `sourceStoreId` — la moitié qu'on **lit**. Les
produits et catégories, eux, atterrissaient dans `targetStoreId`. Un manager
prouvait ses droits sur le restaurant lu, puis écrivait dans un restaurant qu'il
n'administre pas.

Le seam garde désormais la **cible** (`products:write`), et le handler vérifie
la source en `products:read` — copier le catalogue d'un concurrent chez soi est
l'abus symétrique, et il n'était pas couvert non plus.

**Preuve de morsure** : seam remis sur la source → 1 test au rouge.

### 3. `claimFirstAdmin` : le premier venu prenait le déploiement

Le vrai risque n'était pas une course de données mais ceci : **l'inscription est
ouverte sur la vitrine**, et la mutation n'exigeait qu'un compte authentifié.
Sur un déploiement neuf, le premier inconnu à l'appeler devenait super
administrateur. « Aucun appelant dans l'interface » ne protège personne : les
noms de fonctions Convex se lisent dans le bundle client.

C'est un trou que j'ai introduit au sprint 2 en créant cette fonction.

Elle exige maintenant un secret que seul le déployeur détient
(`ADMIN_BOOTSTRAP_TOKEN`), comparé en temps constant. Et elle **échoue fermée** :
variable non définie → personne ne passe. Une variable absente qui laisserait
entrer recréerait le trou sur exactement les déploiements que personne n'a
encore configurés.

**Preuve de morsure** : échec-fermé transformé en échec-ouvert → 2 tests au
rouge.

**Portes** : reference 153 tests (contre 143), 0 erreur, type-check OK ;
`convex-functions` 473 ; `core` 195 ; themes 0 erreur, typecheck OK.

**La liste de relecture est close.**

---

## S0-1 — préparer les tests e2e (21 août)

Déploiement Convex lié par l'utilisateur, `ADMIN_BOOTSTRAP_TOKEN` posé dessus.
Le verrou local est levé : `hasRealBackend = true`, donc les projets `setup` et
`admin` se déclarent enfin.

### Correction de mon propre énoncé

J'avais annoncé `CONVEX_E2E_ENABLED` comme le verrou. **Faux** : c'est une
variable **GitHub Actions**. En local, le verrou est ailleurs, dans
`playwright.config.ts` :

```ts
const hasRealBackend = !process.env.NEXT_PUBLIC_CONVEX_URL?.includes("placeholder")
```

Sans URL réelle, les projets `setup` et `admin` ne sont **pas déclarés du tout**.
Playwright annonce alors un succès sur la poignée de tests publics exécutés : il
n'y a aucune ligne « skipped » pour un projet qui n'existe pas. Trois façons
d'être vert en ne testant rien — la troisième étant le `::warning::` de CI quand
un secret manque.

### Un défaut trouvé en préparant

`e2e/auth.setup.ts` codait le mot de passe **en dur** (`"julien"`), alors que
`scripts/seed-users.mts` lit `SEED_PASSWORD`. Les deux ne coïncidaient pas : la
connexion n'aurait réussi que sur une machine où la valeur semée valait
justement `julien`. Le script de peuplement dit pourtant lui-même « never
hardcode passwords ».

Corrigé : les deux lisent `SEED_PASSWORD`, et le setup échoue immédiatement avec
la raison si la variable est absente, plutôt que trente secondes plus tard sur un
formulaire ayant refusé un mot de passe vide.

### Un piège de `.gitignore`

`.env.e2e.example` était **ignoré** : la règle `.env*` ne comportait des
exceptions que pour `.env.example` et `.env.production.example`. Le modèle aurait
été invisible pour quiconque clone. L'exception couvre désormais tout
`*.example`, et il est vérifié que `.env.local` reste bien ignoré.

### Livré

| Fichier | Contenu |
| --- | --- |
| `apps/{reference,themes}/e2e/README.md` | pourquoi la suite était inerte, la marche à suivre locale en 5 étapes, la liste des secrets CI |
| `apps/{reference,themes}/.env.e2e.example` | les variables, **séparées** entre celles du déploiement Convex et celles du lanceur |
| `e2e/auth.setup.ts` | mot de passe lu depuis l'environnement, échec explicite |
| `.gitignore` | les modèles `*.example` cessent d'être ignorés |

La distinction la plus utile de ces deux documents : une variable lue par une
**fonction Convex** doit être posée sur le déploiement (`npx convex env set`) —
un `.env.local` ne lui est jamais visible. C'est ce qui a fait échouer la
première tentative de pose du jeton d'amorçage.

### Ce qui reste à faire, et qui vous revient

1. `npx convex env set BETTER_AUTH_SECRET …` et `ENCRYPTION_KEY` (64 hex) sur le
   déploiement — seul `ADMIN_BOOTSTRAP_TOKEN` y est défini aujourd'hui.
2. `export SEED_PASSWORD=…` puis `npx tsx scripts/seed-users.mts`.
3. `pnpm test:e2e`, en vérifiant que l'en-tête nomme bien **trois** projets.

**Et avant de croire un vert** : neutraliser une garde et vérifier que la suite
rougit. Une suite qui n'a jamais échoué n'a jamais démontré qu'elle fonctionne —
c'est précisément ainsi que ces 510 tests sont restés inertes pendant des mois
en annonçant un succès.

## Exécution réelle de la suite e2e (21 août) — quatre défauts dans la chaîne d'amorçage

Enchaînement demandé de bout en bout : poser les secrets du déploiement, semer
les comptes, lancer la suite. Chaque étape a révélé un défaut, tous invisibles
tant que personne ne tentait l'opération.

### 1. `api.d.ts` transposé à la main : confirmé exact

`npx convex dev --once` a régénéré le codegen. **Aucune différence** avec le
fichier transposé depuis reference. La réserve posée lors de l'alignement du
miroir est levée.

### 2. Le script de peuplement appelait une mutation publique sans session

`seed-users.mts` créait les profils via `ConvexHttpClient` → `userProfiles.upsert`,
qui exige depuis le sprint 2 un acteur autorisé. Résultat : `Not authenticated`
sur les six comptes.

Et il affichait **« Seeding complete! »** malgré tout. Les comptes existaient,
aucun n'avait de rôle, et la suite e2e aurait échoué sur un écran admin pour une
raison ne pointant nulle part vers ici.

Corrigé : les profils passent par `userProfiles:internalUpsert`, exécuté par
`npx convex run` — le CLI s'authentifie comme le déploiement, l'autorité
correcte pour provisionner, et inatteignable depuis un navigateur. Le script
sort désormais en code non nul si un profil manque.

### 3. Le peuplement n'était pas rejouable

Après un passage partiel, le script s'arrêtait sur « No users were created. They
may already exist. Exiting. » — alors que l'étape des profils est indépendante.
Aucun nombre de relances ne pouvait réparer l'état.

Corrigé : un compte existant est rouvert par connexion pour récupérer son
identifiant, et l'étape 2 est atteinte dans tous les cas.

### 4. `requireEmailVerification: true` rendait les comptes semés inutilisables

Troisième raison pour laquelle la suite n'a jamais pu tourner : `auth.setup.ts`
se connecte avec un compte que `seed-users.mts` crée sans boîte aux lettres où
cliquer un lien. La connexion renvoyait `EMAIL_NOT_VERIFIED`.

La vérification devient optionnelle **à défaut fermé** :

```ts
requireEmailVerification: process.env.AUTH_ALLOW_UNVERIFIED_EMAIL !== "true"
```

Une variable absente ou mal orthographiée laisse la vérification active. À poser
sur un déploiement de test uniquement, jamais sur celui d'un restaurant.

### Une erreur de ma part sur le diagnostic

Mon premier message d'échec accusait le mot de passe semé. La vraie cause était
`EMAIL_NOT_VERIFIED`. Le message rapporte maintenant ce que le serveur a dit —
une supposition dans un message d'erreur envoie son lecteur sur une fausse piste,
ce qui est pire que pas de message du tout.

### État

`Running 510 tests` avec les trois projets `setup`, `public` et `admin`
déclarés : le verrou local est levé pour la première fois. Le binaire Chromium
manquait également et a été installé.

### Le `setup` e2e : diagnostic par capture réseau (22 août)

183 échecs `admin` sur le premier run complet, tous dérivés d'une seule cause :
`auth.setup.ts` n'obtenait pas de session.

**La connexion n'était pas en cause.** Capture réseau d'un rejeu isolé :

| Requête | Réponse |
| --- | --- |
| `POST /api/auth/sign-in/email` | **200**, jeton émis |
| `GET /api/auth/get-session` | **200**, session valide |
| `GET /api/auth/convex/token` | **200**, JWT Convex émis |
| `GET /menu?_rsc=…` | `net::ERR_ABORTED` — préchargement annulé, sans conséquence |

Et après quinze secondes, l'URL était bien `http://localhost:3000/menu`.

**La cause réelle est arithmétique.** Le test dispose de **60 s** au total
(`timeout` de `playwright.config.ts`), alors que ses étapes demandent
60 + 30 + 30 + 30 + 60 = **210 s** d'attentes. Aucune de ces limites n'est
atteignable : le test ne peut mourir qu'au bout de 60 s. Sur un serveur
Turbopack froid, compiler `/sign-in` prend à lui seul une vingtaine de
secondes, et `/menu` compile ensuite à la demande.

Corrigé : `setup.setTimeout(180_000)` donne à l'étape son propre budget, et
l'attente `networkidle` posée après le clic est supprimée — Convex maintient un
WebSocket ouvert, donc le réseau n'est jamais au repos sur cette application ;
cette attente ne pouvait que consommer le budget avant de le céder au contrôle
qui compte. La redirection **est** le signal.

**Vérifié** : `setup` passe en 11,2 s, l'état de session est écrit.

### Le blocage suivant : le peuplement ne crée aucun restaurant

Échantillon `navigation` relancé avec une session valide : **17 échecs, 7
succès**, tous les échecs identiques —
`waiting for locator('[data-slot="sidebar"]')`.

Vérification sur le déploiement : la table `stores` est **vide**, et tous les
profils portent `storeIds: []`. `seed-users.mts` crée des comptes et rien
d'autre. Les écrans admin n'ont aucun établissement à administrer, donc la barre
latérale ne se monte pas.

Il manque une amorce d'établissement — et probablement des catégories et des
produits pour les écrans de catalogue. C'est le prochain obstacle, et il est
distinct de tout ce qui précède.

### L'amorce d'établissement — et ce qu'elle a mis au jour (22 août)

`convex/seedFixture.ts`, mutation **interne** (inatteignable depuis un
navigateur, appelée par `npx convex run`) et idempotente de bout en bout : un
établissement « Chez Luigi (test) », trois catégories, cinq produits, et le
rattachement de l'établissement à tous les profils dont le rôle travaille en
restaurant. Les clients gardent une liste vide — c'est ce qu'est un client.

Branchée en étape 3 de `seed-users.mts`, qui sort en code non nul si elle
échoue : des comptes sans restaurant ne sont pas une amorce utilisable.

**L'amorce seule n'a rien réglé** — l'échantillon `navigation` est passé de
17 à **20 échecs**. La capture directe de `/dashboard` a donné la vraie cause :

```
PAGEERROR Could not find Convex client!
`useQuery` must be used in the React component tree under `ConvexProvider`.
```

Le provider existe pourtant bien dans `app/providers.tsx`.

#### Deux copies de Convex dans le dépôt

| Paquet | Déclare | Résolvait vers |
| --- | --- | --- |
| `apps/{reference,themes}`, `convex-schema`, `convex-functions` | `1.31.7` | 1.31.7 |
| `apps/site` | `^1.34.0` | 1.44.0 |
| **`packages/admin`** | **pair `>=1.0.0`** | **1.44.0** |

`packages/admin` déclarait Convex en dépendance de pair sans contrainte, et pnpm
lui a donné la version la plus haute présente dans le dépôt — celle tirée par
`apps/site`. Son `useQuery` venait donc de 1.44.0 pendant que l'application
fournissait le contexte depuis 1.31.7. Deux instances, deux contextes React,
aucun lien entre les deux : **toute l'interface d'administration plantait au
rendu**, pour tout le monde, pas seulement en test.

Corrigé en épinglant `convex@1.31.7` en devDependency de `packages/admin`. Les
deux résolvent désormais vers la même instance. `apps/site` n'est pas touché.

**Effet mesuré** sur l'échantillon `navigation` : 20 échecs / 4 succès →
**11 échecs / 13 succès**, et l'erreur `Could not find Convex client` a disparu.

#### Ce qui reste ouvert

Les 11 échecs restants ne sont pas diagnostiqués. Ils échouent toujours sur
`[data-slot="sidebar"]`, mais la cause n'est plus la même puisque la moitié des
tests du même fichier passent désormais — compilation à la demande trop lente,
ou écrans réellement incomplets. À reprendre.

Ce que l'exécution réelle aura démontré : un typecheck, un lint et 821 tests
unitaires verts n'empêchaient pas l'interface d'administration d'être
entièrement cassée par une résolution de dépendance. Aucune analyse statique ne
pouvait le voir.

### Les 11 échecs restants : diagnostic (22 août)

Trois causes distinctes, dont **une seule** est un défaut applicatif.

#### 1. `StoreSelector` écrivait dans un store pendant son propre rendu

```
Cannot update a component (`StoreSelector`) while rendering a different
component (`StoreSelector`).
```

`setCurrentStore` était appelé dans le corps du rendu, lignes 22-26. C'est la
variété qui peut boucler : l'écriture modifie le store auquel ce composant est
lui-même abonné, ce qui programme un rendu, qui réécrit. Seule la comparaison
d'identifiant arrêtait la seconde passe.

`StoreGuard`, juste à côté, fait la même sélection correctement dans un
`useEffect`. Corrigé de la même façon — et gardé ici, car `StoreGuard` se
court-circuite sur les routes établissements, réglages et équipe, où le
sélecteur reste pourtant à l'écran.

C'est la même classe d'erreur que j'avais commise moi-même sur
`checkout/pay/page.tsx` plus tôt dans ce sprint.

#### 2. Le masque de la visite guidée avalait les clics

`<div class="reactour__mask">` interceptait les clics sur la barre latérale :
`sidebar.spec.ts` expirait en attendant un lien que le masque recouvrait. Sur un
compte neuf, la visite s'ouvre seule.

`auth.setup.ts` écrit désormais `bid-tour-<userId> = "done"` dans le
`localStorage` avant d'enregistrer la session — exactement ce que fait un humain
en fermant la visite une fois. La visite mérite son propre test ; elle ne doit
pas casser silencieusement tous les autres.

#### 3. Un test écrit contre une interface qui n'existe plus

`routing.spec.ts` attendait un titre « Connexion ». Le `h1` de cette page dit
« Bon retour parmi nous », et `auth.setup.ts` — écrit par quelqu'un qui avait
regardé la page — acceptait déjà l'un ou l'autre.

#### 4. Tout le reste : la compilation à la demande

Le reste n'était pas des défauts. Mesure sans ambiguïté sur `routing.spec.ts` :

| Test | Serveur froid | Passe suivante |
| --- | --- | --- |
| redirection `/dashboard` | **échec à 18,2 s** | **succès en 4,6 s** |
| redirection `/dashboard/products` | **échec à 18,2 s** | **succès en 4,7 s** |
| redirection `/orders`, `/stores` | succès en 7,3 s | succès en 4,1 s |

Turbopack compile chaque route au premier appel, et en développement cela coûte
dix à vingt secondes — plus que la durée de vie accordée à la plupart de ces
tests. Un `/dashboard` qui « refuse de rediriger un visiteur anonyme » se
révélait rediriger en 4,6 s au run suivant. Aucune faille : la protection
fonctionne.

**Correctif structurel** : la CI construit déjà l'application avec `pnpm build`,
mais `playwright.config.ts` relançait `pnpm dev` — donc elle recompilait page par
page ce qu'elle venait de construire. Le serveur de test sert désormais la
version construite sous CI (`E2E_USE_BUILD=true` pour l'obtenir en local).

#### Résultat sur l'échantillon `navigation`

| Étape | Échecs / Succès |
| --- | --- |
| avant l'alignement de Convex | 20 / 4 |
| après l'alignement de Convex | 11 / 13 |
| après visite guidée + titre corrigés | 1 / 23 |
| après `StoreSelector` | **0 sur un serveur chaud** |

Ce qui restait tenait entièrement au serveur de développement.

## La suite complète, sur la version construite (22 août)

**Premier chiffre réel jamais obtenu sur ces 510 tests.**

| | |
| --- | --- |
| réussis | **344** |
| échecs | **107** |
| ignorés | 7 |
| non exécutés | 52 |
| durée | 29,5 min |

### Le serveur de production refusait de démarrer

`instrumentation.ts` valide quatre variables au démarrage et `next start` meurt
avant de servir la moindre requête : `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `OPENAI_API_KEY`. Le serveur de développement s'en
accommodait, donc rien ne le révélait tant qu'on ne visait pas un build.

**Je les avais documentées comme « optionnelles »** dans le modèle et le mode
d'emploi écrits la veille. C'était faux. Les deux sont corrigés, avec la raison
et des valeurs bouchons — aucun test n'atteint réellement S3, SES ou OpenAI.

### Répartition des 107 échecs

| Signature | Occurrences |
| --- | --- |
| `expect(locator).toBeVisible()` / élément absent | 65 + 47 |
| `toHaveURL` | 17 |
| clic expiré | 8 |
| **`strict mode violation: locator('main') resolved to 2 elements`** | **7** |
| `option 'Actif'` résolue à 2 éléments | 3 |

### Un vrai défaut : deux `<main>` imbriqués

`SidebarInset` (`packages/admin/src/ui/sidebar.tsx:307`) rend un `<main>`, et
`app/(admin)/layout.tsx` en rendait un second à l'intérieur. Une page a
exactement un repère `main` : les technologies d'assistance en annonçaient deux.
Corrigé en `<div>` — c'est `SidebarInset` qui porte le repère.

Sans la suite e2e, ce défaut serait resté invisible : ni le typecheck, ni le
lint, ni un test unitaire ne regardent la structure du document rendu.

### Des tests écrits contre une interface qui n'existe plus

Preuve sans appel — des libellés **anglais** attendus dans une application
française :

| Attendu | Occurrences |
| --- | --- |
| `heading "Shopping Cart"` | 4 |
| `heading "Select Store"` | 4 |
| `heading "Checkout"` | 4 |
| `heading "Connexion"` | 5 |

Ces spécifications datent d'avant la traduction de l'interface. Elles n'ont
jamais pu passer, et personne ne l'a su parce que la suite n'a jamais tourné.

### Ce que ce chiffre vaut, et ce qu'il ne vaut pas

344 tests qui passent, c'est un socle réel : la vitrine, l'authentification, la
navigation admin, une large part des écrans de gestion répondent.

Les 107 échecs ne sont **pas** 107 défauts. À vue de nez, la majorité sont des
sélecteurs périmés. Mais je ne l'ai pas établi test par test, et je ne
présenterai pas une estimation comme un tri. Ce qui est établi : au moins un
défaut applicatif réel (le double `main`), et trois autres corrigés en amont
(`StoreSelector`, la double instance Convex, le masque de la visite guidée).

Les 52 non exécutés restent inexpliqués — aucun crash de worker dans le journal.

## Tri des 107 échecs et des 52 non exécutés (22 août)

### Les 52 non exécutés : résolu, et c'est un levier

Aucun mystère et aucun crash. Quatre fichiers déclarent
`describe.configure({ mode: "serial" })` ; en mode série, le premier échec
abandonne tout le reste du bloc.

| Fichier | Exécutés | Abandonnés |
| --- | --- | --- |
| `team.spec.ts` | 1 | **17** |
| `product-form.spec.ts` | 2 | **16** |
| `games.spec.ts` | 3 | **11** |
| `stores.spec.ts` | 10 | **8** |
| | | **52** — le compte exact |

**Quatre échecs empêchaient 52 tests de tourner.** C'est le meilleur rapport
effort/effet de toute la suite.

### Répartition des 107

| Cause | Nombre | Nature |
| --- | --- | --- |
| sélecteur ambigu (barre latérale + page) | 13 | test |
| deux `<main>` imbriqués | 8 | **défaut applicatif** |
| barre latérale absente | 7 | à creuser |
| titre « Connexion » disparu | 6 | test périmé |
| libellé **anglais** attendu | 6 | test périmé |
| accents manquants dans l'interface | 1 (+17 en cascade) | **défaut applicatif** |
| autocomplétion Google (clé absente) | 2 | environnement |
| URL inattendue | 17 | à creuser |
| divers (libellés renommés, dialogues) | 47 | mixte |

### Deux défauts applicatifs confirmés et corrigés

**1. Deux `<main>` imbriqués** — `SidebarInset` en rend un, le layout admin en
rendait un second dedans. Une page a exactement un repère `main`.

**2. Du français sans accents dans l'interface.** Le test `team.spec.ts`
cherchait « Gestion de l'équipe » ; l'interface affichait « Gestion de
l'equipe ». **Le test avait raison.** Le balayage a trouvé 53 segments répartis
sur 12 fichiers de `packages/admin` : « Gerez les membres de votre equipe,
leurs roles et permissions », « Veuillez selectionner un etablissement »,
« Echec de l'apercu », « Base de donnees », « Parametres », « Categorie »…

C'est un défaut de qualité visible par le restaurateur, dans un produit vendu
en France. Aucun typecheck ni lint ne le voit.

### Mon script de correction a cassé deux choses

Il fallait le dire. Le remplacement automatique a touché ce qu'il ne devait pas :

| Dégât | Détection |
| --- | --- |
| classe CSS `recharts-reference-line` → `recharts-référence-line` | relecture du diff |
| identifiant `categories.length` → `catégories.length` | **typecheck** |

Les deux sont réparés, et les trois typechecks sont à zéro. La leçon tient en
une ligne : un remplacement par expression régulière sur du code source doit
être relu ligne à ligne, pas seulement compté. La première passe était en outre
incomplète — elle ne voyait que le texte JSX tenant sur une seule ligne, et le
sous-titre fautif s'étalait sur deux.

### Des tests écrits contre une interface qui n'existe plus

| Attendu par le test | Réalité |
| --- | --- |
| `heading "Shopping Cart"` | interface en français |
| `heading "Select Store"` | idem |
| `heading "Checkout"` | idem |
| `heading "Connexion"` | « Bon retour parmi nous » |
| `button "Créer un compte"` | « Créer mon compte » |

Ces spécifications n'ont **jamais** pu passer. Personne ne l'a su parce que la
suite n'a jamais tourné.

### Ce qui reste

Les 17 « URL inattendue », les 7 « barre latérale absente » et une partie des 47
« divers » ne sont pas triés. Certains sont sûrement des tests périmés de plus,
d'autres peut-être de vrais défauts. Je ne les compte dans aucune des deux piles
tant que je ne les ai pas ouverts.

### Effet mesuré sur les quatre fichiers `serial`

| | Réussis | Échecs | Non exécutés |
| --- | --- | --- | --- |
| avant | 17 | 4 | 48 |
| après | **22** | 4 | 43 |

Chaque correctif déplace le bloqueur plus loin dans la chaîne : `games` est
passé de la ligne 47 à 78, `product-form` de 23 à 58, `team` de 30 à 114. Le
mode `serial` rend ce déblocage forcément itératif — on ne voit l'échec suivant
qu'une fois le précédent levé.

C'est aussi ce qui rend ces quatre fichiers coûteux : 43 tests restent
inaccessibles derrière 4 échecs. Une piste à trancher séparément — le mode
`serial` est-il vraiment nécessaire ici, ou est-ce un héritage ? S'il tombe, les
43 tests s'exécutent et échouent (ou passent) chacun pour leur propre raison,
ce qui est bien plus informatif.

## Le mode `serial` n'était pas nécessaire (22 août)

Vérifié avant de toucher quoi que ce soit, sur les quatre fichiers concernés :

| Indice d'une vraie dépendance | Constat |
| --- | --- |
| `beforeAll` | **aucun** dans les quatre |
| variables partagées au niveau `describe` | **aucune** |
| bouton de validation cliqué (Enregistrer, Créer, Confirmer, Supprimer…) | **aucun** |
| navigation propre à chaque test | `beforeEach` partout |

Aucun test n'écrit en base. Même ceux qui s'appellent « delete » se contentent
d'ouvrir la confirmation puis d'annuler. Il n'y a donc **rien** qu'un test
transmette au suivant.

Et l'origine : `git log -S` fait remonter `mode: "serial"` à
`1228afac chore: câbler le monorepo BeYours` — un commit de câblage global, sans
un mot sur l'isolation des tests. Le mode n'a pas été choisi, il a été charrié.

### Effet du retrait

| | Réussis | Échecs | Non exécutés |
| --- | --- | --- | --- |
| avec `serial` | 22 | 4 | **43** |
| sans `serial` | **57** | 12 | **0** |

**+35 tests au vert**, et les 43 qui étaient cachés s'exécutent enfin — chacun
échouant ou passant pour sa propre raison. Douze échecs réels apparaissent, qui
étaient jusque-là invisibles derrière quatre.

C'est exactement le compromis à faire : douze diagnostics lisibles valent mieux
que quatre diagnostics et cinquante-deux silences.

### Les 12 restants

| Fichier | Échecs |
| --- | --- |
| `product-form.spec.ts` | 5 (champs du formulaire, onglets, gestion de stock) |
| `team.spec.ts` | 3 (filtre par statut, dialogue d'invitation) |
| `games.spec.ts` | 2 (catalogue) |
| `stores.spec.ts` | 2 (titre, champs du dialogue) |

Non triés. Ils rejoignent les 17 « URL inattendue », les 7 « barre latérale
absente » et une partie des 47 « divers » du bilan précédent.

## Tri des échecs des quatre fichiers admin (22 août)

Point de départ : 22 réussis, 4 échecs, 43 non exécutés. **Arrivée : 64 réussis,
5 échecs, 0 non exécuté.**

### Défauts applicatifs trouvés et corrigés

| Défaut | Effet |
| --- | --- |
| libellés d'un mot sans accent (`"Equipe"`, `"Parametres"`, `"Integrations"`, `>Role<`, `>Details<`) | 3 tests |
| `Switch` annoncé comme case à cocher | accessibilité |

La première passe d'accents avait manqué ces libellés : mon expression exigeait
une espace dans la chaîne pour ne viser que de la prose, ce qui excluait tout
libellé d'un seul mot. Corrigé.

Le `Switch` de `packages/ui` est un `<input type="checkbox">` masqué. Il portait
donc le rôle implicite `checkbox` alors qu'il *paraît* et *fonctionne* comme un
interrupteur. `role="switch"` est un rôle valide pour cet input et décrit ce que
l'utilisateur voit.

**Mais ce correctif n'a pas fait passer le test**, et il faut le dire : l'input
est `sr-only`, donc Playwright ne le considérera jamais comme visible, quel que
soit son rôle. Le test devait viser ce que l'utilisateur voit et clique — le
libellé — comme le faisait déjà son voisin à la ligne 168.

### Défauts de test corrigés

| Test | Cause |
| --- | --- |
| `selectFilter` (helper partagé) | Radix rend chaque option deux fois — la stylée et une native cachée. Cadré sur le `listbox` ouvert. |
| `Prix (EUR)` | le formulaire affiche `Prix (€)`, cette orthographe n'a jamais existé |
| `Disponible à partir de` / `jusqu'à` | `.or()` de `getByText` et `getByLabel` sur le **même** libellé : deux correspondances |
| état du commutateur de stock | `getAttribute("aria-checked")` sur un libellé rend toujours `null` — la branche était décorative, elle cliquait à chaque fois et tombait juste par hasard |

### Deux erreurs de ma part, à noter

1. J'ai corrigé « Disponible à partir de » et **laissé la ligne suivante**, qui
   répétait le même motif avec « Disponible jusqu'à ». Vu à l'exécution suivante.
2. J'ai présenté `role="switch"` comme le correctif du test alors qu'il ne l'est
   pas. C'est un gain d'accessibilité réel, rien de plus.

### Les 5 qui restent — non diagnostiqués

| Test | Ce qu'il attend | Constat |
| --- | --- | --- |
| `games:88` | `getByText('Jeux', exact)` | le `h2` « Jeux » existe |
| `games:96` | un `%` dans le dialogue | non vérifié |
| `product-form:109` | un message de validation | non vérifié |
| `product-form:312` | « Seuil de stock faible » | **la chaîne existe** (ligne 725), donc l'activation du suivi n'a pas pris |
| `stores:168` | libellé `/Adresse/` dans le dialogue | **la chaîne existe** (ligne 337) ; la page a deux `DialogContent`, le test en ouvre peut-être un et cherche dans l'autre |

Ces cinq n'échouent pas sur un libellé périmé : le texte attendu est bien dans le
code. Ils échouent sur l'accès au contenu. Je les laisse non triés plutôt que
d'avancer une hypothèse comme un résultat.

## Les 17 « URL inattendue » (22 août)

**Un seul fichier, une seule cause.** Les 17 venaient tous de
`store-detail.spec.ts`, tous avec le même écart : attendu
`/dashboard/stores/<id>`, reçu `/dashboard/stores`.

### La cause : la ligne du tableau n'est pas cliquable

Le helper `navigateToFirstStore` clique `tbody tr` et attend une navigation.
Or `TableRow` ne porte **aucun `onClick`** : la navigation vit dans un `<Link>`
à l'intérieur de la cellule du nom. Cliquer au centre de la ligne tombe sur la
cellule qui s'y trouve et ne va nulle part.

L'interface n'a jamais offert le clic sur la ligne. C'est le test qui se
trompait. Corrigé : il vise l'ancre.

**Effet : 17 échecs → 7.**

### Un test qui ne pouvait pas échouer

`stores.spec.ts:274` — « should navigate to store detail on row click » —
**passait**. Il compte les lignes à l'instant du `domcontentloaded`, avant que
Convex n'ait répondu, trouve zéro, saute le `if (rowCount > 0)` et se déclare
réussi sans avoir rien vérifié. Il contenait pourtant le même défaut que les 17
autres.

Réécrit pour attendre l'ancre puis exiger la navigation : il peut désormais
échouer, ce qui est la moindre des choses pour un test.

### Un défaut d'accessibilité trouvé au passage

`getByLabel(/Adresse/)` échoue alors que le texte existe. `AddressAutocomplete`
rend cinq `<label>` **sans `htmlFor`** et cinq `<input>` **sans `id`** : rien ne
les associe. Un lecteur d'écran annonce cinq champs anonymes, et cliquer un
libellé ne donne pas le focus.

Câblé avec `React.useId()`, typecheck vert.

**Mais je n'ai pas pu vérifier que ce correctif change le résultat des tests** :
après reconstruction, le compte reste à 28 réussis / 8 échecs, et je ne retrouve
pas le libellé « Adresse de l'établissement » dans la sortie de build que j'ai
inspectée. Le correctif est juste sur le fond — un libellé doit pointer vers son
champ — mais je ne le présente pas comme la résolution de ces tests.

### Reste sur ces deux fichiers : 8 échecs

Sept dans `store-detail` (contenus des onglets Horaires, Paramètres,
Intégrations, plus « Adresse » sur Général) et un dans `stores` (champs du
dialogue de création). Non diagnostiqués.

## Les 7 « barre latérale absente » (22 août)

Tous dans `admin-responsive.spec.ts`, tous dans les blocs **mobile (375×667)**.

### La cause : un helper écrit pour le bureau seulement

Sur un écran étroit, la barre latérale vit dans un `Sheet` — un tiroir modal
**fermé par défaut**. `[data-slot="sidebar"]` n'est donc pas dans le DOM tant que
l'utilisateur n'a pas ouvert le tiroir. C'est le comportement voulu.

`waitForAdminPage` attendait cette barre inconditionnellement : sur mobile,
l'attente ne pouvait aboutir. Le helper choisit désormais son repère selon le
viewport — le déclencheur du tiroir en dessous de 768 px, la barre au-dessus.

**Effet sur le fichier : 12 échecs → 3.**

### Ce que ça a révélé : deux vrais défauts d'affichage

Les tests mobiles s'exécutent enfin, et deux échouent sur **leur vraie
assertion** — pas sur un locator :

```
expect(hasOverflow).toBe(false)   →   received: true
```

| Page | À 375 px |
| --- | --- |
| `/dashboard` | **déborde horizontalement** |
| `/dashboard/orders` | **déborde horizontalement** |

Un débordement horizontal sur téléphone, c'est une page qui glisse latéralement
sous le doigt. Le test existait pour attraper exactement ça et ne l'a jamais pu :
il mourait avant, sur la barre latérale.

Je n'ai pas cherché l'élément fautif — c'est une investigation CSS distincte du
tri.

### Le troisième restant

`admin-responsive.spec.ts:156` (bureau) attend `[data-slot="card"]` sur
`/dashboard` et ne le trouve pas. Non diagnostiqué ; l'hypothèse la plus simple
est un tableau de bord vide faute de commandes, mais je ne l'ai pas vérifiée.

## Les deux débordements mobiles — corrigés (22 août)

### Le coupable, trouvé par mesure

Un test de diagnostic listant les éléments dont le bord droit dépasse le
viewport a donné la même réponse sur les deux pages :

| Page | `scrollWidth` | Élément fautif |
| --- | --- | --- |
| `/dashboard` | 382 (vp 375) | groupe droit de l'en-tête, largeur 219 |
| `/dashboard/orders` | 388 (vp 375) | le même |

L'en-tête admin est un `justify-between` entre deux groupes, et **aucun des deux
ne pouvait rétrécir** : le groupe de droite portait `shrink-0`, celui de gauche
n'avait pas `min-w-0` — un enfant flex refuse de descendre sous la largeur de son
contenu tant qu'on ne le lui autorise pas explicitement.

### Le correctif

- groupe de gauche : `min-w-0`, fil d'Ariane en `truncate` et `flex-nowrap` ;
- groupe de droite : `shrink-0` conservé (ces contrôles doivent rester
  utilisables), mais le nom d'établissement plafonné à `7.5rem` sous `sm`.

**Vérifié** : `scrollWidth` passe à 375 = viewport sur les deux pages. La bande
d'onglets de `/dashboard/orders`, large de 790 px, reste large — mais elle est
clippée par son conteneur et ne fait plus glisser la page, ce qui est le
comportement attendu d'une barre d'onglets défilante.

**Fichier `admin-responsive.spec.ts` : 2 réussis / 12 échecs → 13 / 1.**

### Une incohérence du design system corrigée au passage

`packages/ui`'s `Card` rendait un `<div>` nu, sans `data-slot="card"`, alors que
toutes les autres primitives du système en portent un (`button`, `breadcrumb`,
`sidebar`, `dialog`…). Aligné.

**Ce correctif n'a pas fait passer le test qui le cherchait**, et il faut le
dire : l'attribut est bien dans le build (vérifié), mais `/dashboard` n'affiche
aucune carte — il rend « Veuillez sélectionner un restaurant ». Le `storeId`
n'est pas résolu au moment du test. C'est un problème distinct, non résolu.

### Reste sur ce fichier

`admin-responsive.spec.ts:156` — le tableau de bord sans établissement
sélectionné. À reprendre avec les autres cas de résolution d'établissement.


## La résolution d'établissement, dans son ensemble (23 août)

### L'état des lieux

« Quel établissement est actif » était rangé à cinq endroits et calculé par six
composants.

| Emplacement | Portée |
| --- | --- |
| `currentStore` (document entier, localStorage `beindigital-store`) | admin **et** boutique |
| `adminApiStore.storeId` | mémoire, `packages/admin` |
| `cartStore.storeId` | panier |
| cookie `storeSlug` | themes |
| slug d'URL résolu serveur | themes |

Résolveurs : `StoreGuard` (premier de la liste), `StoreSelector` (le seul s'il
n'y en a qu'un), `useStoreId` (le plus proche par géolocalisation), plus trois
copies divergentes dans `apps/themes`.

### Le décalage d'un commit, démontré par lecture

`StoreGuard` recopiait `currentStore._id` dans `adminApiStore.storeId` depuis un
effet. Or la page qu'il débloque est rendue **dans le commit même** où il la
laisse passer — donc avant que l'effet n'écrive.

```
commit 3 : currentStore posé → enfants rendus → miroir null → « Veuillez sélectionner un restaurant »
commit 4 : effet → miroir posé → squelette, la requête part enfin
```

C'est ce que voyait `admin-responsive.spec.ts:156`. Ce n'était pas une
hypothèse : c'est la sémantique des effets passifs de React.

### Ce qui a été fait

**Dériver au lieu de recopier.** Le miroir a disparu de `admin-api-store` ; les
pages lisent la sélection elle-même. Le garde ne rend ses enfants que lorsque
l'id est présent dans la liste renvoyée par le serveur pour ce compte — un id
persisté pointant vers un établissement supprimé, ou hérité de l'utilisateur
précédent de ce navigateur, est remplacé au lieu d'être transmis.

**Un seul `useAdminStoreId`.** Il en existait deux du même nom lisant deux
sources : 36 fichiers dans `packages/admin`, 18 dans `apps/reference`,
indiscernables au point d'appel. Celui de l'app réexporte maintenant celui du
package.

**Ne persister que l'id.** Le document entier était figé dans localStorage et
rien ne le rafraîchissait : un établissement renommé gardait son ancien nom, des
horaires modifiés restaient faux côté visiteur. Le document vient de Convex.
Effet de bord bienvenu : le risque d'écart d'hydratation disparaît, puisque tout
ce qui en dérive attend désormais la même requête côté serveur et côté client.

**Deux clés au lieu d'une.** `beyours-admin-store` et
`beyours-storefront-store`. Un visiteur laissant la géolocalisation choisir le
restaurant le plus proche déplaçait le tableau de bord dans lequel le gérant
travaillait. Les sélections existantes sont reprises depuis l'ancienne clé.

**Géolocalisation sur demande.** `useNearestStore` la réclamait au montage, sur
chaque page boutique, y compris pour un restaurant mono-établissement où la
réponse ne change rien. Elle est désormais demandée quand elle décide de quelque
chose : plusieurs établissements, aucun choisi. Le panneau « Nos restaurants »,
lui, l'active explicitement — c'est ce que le visiteur y cherche.

**Sélection effacée à la déconnexion.** `clearCurrentStore` existait et n'était
appelé nulle part.

**Treize écrans vides morts** — « Veuillez sélectionner un établissement » sous
un garde qui rend ce cas inatteignable — remplacés par un `ResolvingStore`
neutre. Les trois routes délibérément contournées (stores, settings, team)
gardent un vrai message.

**Trois orphelins supprimés dans `apps/themes`** : `StoreGuard`, `StoreSelector`
et `StoreProvider`, joignables seulement par des barils que personne n'importe —
la mise en page admin de themes utilise déjà les composants du package. Le garde
de themes portait encore le `setState` pendant le rendu corrigé côté package : il
part avec le fichier.

**Tranche morte retirée** : `stores`, `setStores`, `useStores`,
`clearCurrentStore`, `useStoreHours`, `useIsStoreOpen` — zéro appelant, et un
`useStores()` qui aurait silencieusement renvoyé `[]` au premier qui s'en serait
servi.

### Ce qui a été écarté

Pas de duplication de `zustand` ni de `@be-in-digital/restaurant` : un seul
exemplaire résolu, contrairement au cas Convex de la semaine dernière. Vérifié
par `readlink` sur les trois emplacements.

### Preuve par la morsure

Cinq tests dans `packages/restaurant/src/__tests__/store-selection.test.ts`.
Deux morsures vérifiées, fichier restauré à l'identique ensuite :

| Neutralisation | Résultat |
| --- | --- |
| clés admin et boutique confondues | 1 test rouge |
| migration depuis l'ancienne clé retirée | 1 test rouge |

### Gates

Typecheck 0 erreur sur `restaurant`, `admin`, `mcp-server`, `ui`, `reference`,
`themes`. Lint reference : 0 erreur / 71 avertissements (inchangé). Tests
unitaires : 153 + 89. `next build` de `apps/reference` : succès.

### Ce qui n'est pas vérifié

`admin-responsive.spec.ts:156` n'a pas été rejoué — la pile e2e n'a pas été
relancée. Le décalage d'un commit est supprimé de façon démontrable, mais
l'affirmation « ce test passe maintenant » demande une exécution.

Un compromis assumé : `useStoreId` ne renvoie plus l'id persisté immédiatement,
il attend que `stores.list` confirme son existence. C'est un aller-retour Convex
de plus avant la première requête du menu, contre la garantie de ne jamais
interroger un établissement supprimé.

## Vérification e2e de la consolidation (23 août)

### Deux obstacles avant le premier chiffre

`next start` refusait de démarrer : `instrumentation.ts` valide quatre
variables au boot (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`OPENAI_API_KEY`) et `.env.local` ne les a pas. `.env.e2e.example` dit depuis sa
rédaction de copier le fichier vers `.env.e2e` — mais `playwright.config.ts` ne
lisait que `.env.local`, donc suivre l'instruction ne changeait rien. La config
lit maintenant les deux, `.env.e2e` d'abord, un export shell primant sur tout.

`SEED_PASSWORD` n'est stocké nulle part : ni dans un fichier, ni dans les
variables du déploiement Convex. Le projet `setup` échoue donc sur son
assertion, et les 446 tests admin ne s'exécutent pas. **La moitié admin de cette
vérification reste à faire** et demande la valeur employée au moment du seed.

### Comparaison contre le commit d'avant

Projet `public`, version construite, `4437435` puis `HEAD`.

| | réussis | échecs |
| --- | --- | --- |
| avant (`4437435`) | 30 | 33 |
| après consolidation | 29 | 34 |
| après correctif géoloc | **35** | **28** |

La première mesure montrait **une régression**, à moi : `/store-selector`
enregistrait « Permissions policy violation: Geolocation access has been
blocked ».

### La cause, en deux endroits

Rendre la géolocalisation optionnelle n'avait pas suffi : deux appelants la
réclamaient toujours au montage. Le résolveur, dès qu'il voyait plusieurs
établissements sans sélection — c'est-à-dire à l'arrivée du visiteur. Et le
panneau « Nos restaurants », qui vit dans l'en-tête de **toutes** les pages : le
monter quelque part, c'est demander partout.

Les deux utilisent maintenant `useGrantedLocation` : la position sert si le
visiteur l'a accordée auparavant, et l'API n'est pas touchée sinon — pas de
demande, et rien qu'une politique de permissions puisse rejeter. Le bouton
« Localiser » du panneau reste pour qui veut l'accorder sur le moment ; sans
position, le plus proche est simplement le premier.

**Aucune régression, cinq tests réparés** — les vérifications d'erreurs console
de menu, panier, paiement, suivi et mise en page boutique. Messages
« geolocation blocked » sur l'ensemble du run : 20 → 0.

### Les 28 échecs restants du projet public

Antérieurs à ce travail, identiques au commit de référence. Deux exemples
suffisent à donner le genre : un test attend le lien « Se connecter » quand
l'en-tête affiche « Connexion », un autre attend « Powered by BeYours Engine »
qui n'existe dans aucun fichier. Le renommage `3d6b93e` du 15 août a déplacé la
copie sans que les tests suivent. À traiter comme un lot à part.

## Les 28 échecs du projet public — traités (24 août)

Projet `public`, version construite : **30 réussis / 33 échecs → 60 / 0**, plus
trois ignorés explicites.

### Vingt-deux : des assertions restées en arrière

Le renommage du 15 août (`3d6b93e`) a déplacé la copie, les tests ne l'ont pas
suivie. Une boutique française interrogée sur « Shopping Cart », « Checkout » et
« Select Store » ; une page de connexion dont le titre est « Bon retour parmi
nous » cherchée sous « Connexion » ; un pied de page fouillé pour « Powered by
BeYours Engine », qui n'existe dans aucun fichier. Les assertions nomment
maintenant ce que les pages disent, sans changer ce que chaque test vérifie.

Deux détails du même ordre : le mot de passe d'inscription exige huit caractères
et non six, et l'espace réservé du champ est une rangée de points, pas une
phrase.

### Trois vrais défauts, trouvés par ces tests

**`/imagery/hero-burger-v2.png` n'existe pas** — `public/imagery/` non plus.
C'était le repli de l'accueil sans image de couverture et de **toute fiche
produit sans photo** : ces pages réclamaient à l'optimiseur d'images un fichier
absent et récoltaient un 400. C'est exactement ce que signalait depuis le début
le test d'erreurs console de l'accueil. Les deux appels rendent désormais le
cadre vide plutôt que de demander un fichier jamais versé.

**`useGooglePlacesAutocomplete` sort sur une clé vide** avant même de demander
le script Maps. Or la spec d'autocomplétion intercepte cette requête pour y
répondre par un mock : elle simulait un appel que le composant avait déjà
renoncé à faire. La page de fixture fournit sa propre clé.

**Le champ « Nom » de l'inscription n'avait pas de `type`.**

### Trois tests qui ne pouvaient pas dire la vérité

`sign-in.spec.ts` se connectait avec le littéral « julien » — la faute pour
laquelle `auth.setup.ts` avait déjà été corrigé. Ils lisent `SEED_PASSWORD` et
s'ignorent proprement quand il manque, au lieu d'échouer sur une variable
absente en donnant l'air d'un formulaire cassé. Nouveau helper
`e2e/helpers/credentials.helpers.ts`. L'un d'eux attendait aussi `networkidle`,
que la WebSocket Convex interdit d'atteindre.

### Trois tests mal écrits

Deux chaînes de localisateurs finissaient par `.or(locator("body"))`, qui ne
peut pas se résoudre à un élément unique — `body` correspond toujours, et le
reste de la page aussi.

Et `/checkout` avec une Box vide affiche son état vide, pas le formulaire de
commande : c'est la page qui fonctionne. Atteindre « Finaliser Commande »
suppose un panier garni, ce qui relève d'un test de parcours et non d'une
vérification de rendu. Le test assertit maintenant ce que la page montre
réellement, et le dit en commentaire.

### Gates

Typecheck 0 erreur sur les cinq paquets, lint 0 erreur / 71 avertissements,
153 + 89 tests unitaires, `next build` vert.

### Toujours en attente

Les 446 tests admin, faute de `SEED_PASSWORD`.
