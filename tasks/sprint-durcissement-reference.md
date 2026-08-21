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

