# Design — Contrat d'Apporteur d'Affaires Be in Digital

## Statut : Design validé — Prêt pour implémentation

---

## 1. Résumé

Mise en place d'un **contrat d'apporteur d'affaires** complet en droit français, signé électroniquement via **Yousign** (signature avancée eIDAS), intégré au parcours d'inscription du programme de parrainage.

- Le compte est **bloqué tant que le contrat n'est pas signé**
- Le contrat est **versionnable** : nouvelle version → re-signature obligatoire avec blocage
- Cible : **particuliers** (pas de sociétés)
- Commission : **500 € par client signé**, versée sous **14 jours** après encaissement

---

## 2. Modèle de données

### Table `contractVersions`

| Champ | Type | Description |
|-------|------|-------------|
| `version` | string | Ex: "1.0", "1.1" |
| `title` | string | "Contrat d'apporteur d'affaires" |
| `content` | string | Contenu du contrat en markdown |
| `contentHash` | string | SHA-256 du contenu |
| `status` | string | "draft" \| "active" \| "archived" |
| `createdAt` | number | Timestamp création |
| `activatedAt` | optional number | Quand la version devient active |
| `archivedAt` | optional number | Quand la version est archivée |

### Table `contractSignatures`

| Champ | Type | Description |
|-------|------|-------------|
| `affiliateUserId` | id → affiliateUsers | Lien vers l'apporteur |
| `contractVersionId` | id → contractVersions | Lien vers la version signée |
| `yousignSignatureRequestId` | string (indexé) | ID Yousign |
| `yousignSignerUrl` | string | URL de signature |
| `status` | string | "pending" \| "signed" \| "declined" \| "expired" \| "canceled" \| "failed" |
| `contractSnapshotContent` | string | Texte exact du contrat envoyé |
| `contractSnapshotHash` | string | SHA-256 du snapshot |
| `signedDocumentFileId` | optional string | Référence au PDF signé |
| `signerIp` | optional string | IP du signataire |
| `signedAt` | optional number | Timestamp signature |
| `createdAt` | number | Timestamp création |
| `updatedAt` | number | Timestamp dernière mise à jour |

### Modifications `affiliateUsers`

| Champ | Type | Description |
|-------|------|-------------|
| `contractStatus` | string | "pending_contract" \| "active" \| "blocked_new_version" |
| `requiredContractVersionId` | id → contractVersions | Version requise |
| `acceptedContractVersionId` | optional id → contractVersions | Version acceptée |
| `address` | optional string | Adresse postale |
| `city` | optional string | Ville |
| `postalCode` | optional string | Code postal |

> `firstName`, `lastName`, `phone` existent déjà.

---

## 3. Flow utilisateur

### Inscription (modifié)

1. Email + mot de passe sur `/parrainage/inscription`
2. Compte créé avec :
   - `contractStatus` = `"pending_contract"`
   - `requiredContractVersionId` = version active actuelle
   - `acceptedContractVersionId` = `null`
3. Redirection vers `/parrainage/contrat`

### Collecte + affichage contrat (`/parrainage/contrat`)

1. Formulaire : nom, prénom, adresse, code postal, ville, téléphone
2. **Sauvegarde dans `affiliateUsers` AVANT** tout appel Yousign
3. Affichage : résumé court en haut + contrat intégral scrollable
4. Si signature `pending` existe (même user + même version) → bouton **"Reprendre la signature"**
5. Sinon → bouton **"Signer mon contrat"**

### Création signature Yousign (action Convex)

1. Vérifier la version active/requise
2. Vérifier si signature `pending` existe → si oui, retourner l'URL existante
3. Sauvegarder les infos contractuelles du user
4. Générer le PDF pré-rempli (`pdf-lib`)
5. Créer la demande Yousign
6. Enregistrer dans `contractSignatures` (avec snapshot + hash)
7. Retourner l'URL de signature

### Signature (Yousign)

- **Redirection** vers Yousign (pas d'iframe)
- Retour vers `/parrainage/contrat?signature=return`
- Le retour navigateur **ne débloque PAS** le compte

### Écran de retour

- Affiche "Signature en cours de vérification..."
- Subscription Convex sur `contractSignatures.status` (réactif)
- Si `status` → `"signed"` + `contractStatus` → `"active"` → redirection auto dashboard
- Sinon : "Nous attendons la confirmation" + bouton "Rafraîchir" + "Reprendre la signature"

### Webhook Yousign → Convex (source de vérité unique)

```
if (event === "signed") {
  if (signature.contractVersionId === affiliateUser.requiredContractVersionId) {
    → acceptedContractVersionId = signature.contractVersionId
    → contractStatus = "active"
    → Télécharger et archiver le PDF signé
  } else {
    → Historique conservé, user reste bloqué (version obsolète)
  }
}

if (event === "declined") → status = "declined", notifier
if (event === "expired") → status = "expired", permettre relance
if (event === "canceled") → status = "canceled"
if (event === "failed") → status = "failed"
```

### Garde d'accès (double : frontend + backend)

**Frontend :**
- Toute page `/parrainage/dashboard/*` vérifie `contractStatus`
- `"pending_contract"` → redirect `/parrainage/contrat`
- `"blocked_new_version"` → redirect `/parrainage/contrat`
- `"active"` → accès normal

**Backend :**
- Toute mutation/query métier vérifie `contractStatus === "active"`
- Empêche tout contournement

### UX selon le blocage

- `"pending_contract"` → "Activez votre compte en signant le contrat"
- `"blocked_new_version"` → "Une nouvelle version du contrat est disponible. Veuillez la signer pour réactiver votre compte."

### Relance

- Yousign envoie un rappel automatique par email
- Bandeau dans le dashboard si le user se connecte

### Re-signature (nouvelle version)

- Admin active une nouvelle version du contrat
- Tous les apporteurs dont `acceptedContractVersionId !== nouvelleVersionId` passent en `"blocked_new_version"`
- `requiredContractVersionId` mis à jour
- Re-blocage jusqu'à signature

---

## 4. Contenu du contrat

> **A faire valider par un avocat avant mise en production.**

### CONTRAT D'APPORTEUR D'AFFAIRES

**Entre les soussignés :**

**Be in Digital** (ci-après "la Société"), société [forme juridique], immatriculée au RCS de [ville] sous le numéro [SIRET], dont le siège social est situé [adresse], représentée par [nom du représentant légal], en qualité de [fonction].

Et

**L'Apporteur d'Affaires** (ci-après "l'Apporteur"), personne physique dont les coordonnées sont renseignées lors de l'inscription sur la plateforme : nom, prénom, adresse postale, téléphone, email.

---

**Article 1 — Objet du contrat**

Le présent contrat a pour objet de définir les conditions dans lesquelles l'Apporteur s'engage à recommander les services de la Société à des prospects (ci-après "les Prospects"), en échange d'une commission versée par la Société selon les modalités prévues ci-après.

L'Apporteur agit en qualité d'intermédiaire indépendant. Il n'est ni salarié, ni mandataire, ni agent commercial de la Société.

---

**Article 2 — Rôle et limites de l'Apporteur**

L'Apporteur s'engage à :
- Recommander les services de la Société à des Prospects potentiellement intéressés
- Partager son lien de parrainage unique fourni par la plateforme
- Fournir des informations exactes et loyales sur les services de la Société

L'Apporteur ne dispose d'aucun pouvoir pour :
- Encaisser des sommes au nom de la Société
- Conclure des contrats au nom de la Société
- Négocier les prix ou conditions commerciales de la Société
- Engager la responsabilité de la Société de quelque manière que ce soit
- Émettre des factures au nom de la Société
- Accorder des remises, rabais ou avantages au nom de la Société
- Traiter directement avec les Prospects pour des prestations similaires ou concurrentes pendant la durée du contrat et pendant une période de douze (12) mois suivant sa résiliation

---

**Article 3 — Commission**

3.1 — L'Apporteur perçoit une commission de cinq cents euros (500 EUR) TTC pour chaque Prospect ayant souscrit un contrat payant avec la Société grâce au lien de parrainage de l'Apporteur.

3.2 — La commission est due uniquement lorsque :
- Le Prospect a été identifié via le lien de parrainage unique de l'Apporteur
- Le Prospect a effectivement souscrit un contrat payant avec la Société
- Le premier paiement du Prospect a été encaissé par la Société

3.3 — L'identification du Prospect est réalisée exclusivement via les outils de suivi (tracking) mis en place par la Société. Seules les données enregistrées par ces outils font foi pour l'attribution des commissions.

3.4 — La commission est versée via la plateforme de paiement Stripe Connect, sur le compte bancaire renseigné par l'Apporteur, dans un délai de quatorze (14) jours à compter de l'encaissement effectif du paiement du client par la Société.

3.5 — L'Apporteur est seul responsable de ses obligations fiscales et sociales liées aux commissions perçues.

3.6 — Les commissions sont considérées comme acquises uniquement après validation définitive par la Société. La Société se réserve le droit de suspendre ou refuser le paiement en cas de doute légitime sur la validité de l'apport.

3.7 — Aucune commission ne sera due dans le cas où l'Apporteur est lui-même le client, ou agit directement ou indirectement pour son propre compte.

---

**Article 4 — Obligations de la Société**

La Société s'engage à :
- Fournir à l'Apporteur un lien de parrainage unique et fonctionnel
- Verser les commissions dues conformément à l'article 3
- Fournir un tableau de bord permettant à l'Apporteur de suivre ses parrainages
- Notifier l'Apporteur de toute modification du programme ou du contrat par email ou via la plateforme

---

**Article 5 — Exclusion de responsabilité et remboursements**

5.1 — La Société gère seule la relation commerciale avec ses clients. L'Apporteur n'intervient à aucun moment dans l'exécution des prestations, la facturation ou le service après-vente.

5.2 — La Société ne saurait être tenue responsable des engagements pris par l'Apporteur en dehors du cadre du présent contrat. Tout remboursement éventuel est traité directement entre la Société et le client concerné.

5.3 — L'Apporteur ne peut en aucun cas promettre un remboursement, une garantie de résultat ou un quelconque engagement au nom de la Société.

5.4 — En cas de remboursement d'un client parrainé, la Société se réserve le droit de récupérer la commission versée à l'Apporteur pour ce client. La Société se réserve le droit de compenser toute somme indûment versée avec des commissions futures dues à l'Apporteur.

---

**Article 6 — Non-exclusivité**

Le présent contrat ne confère à l'Apporteur aucun droit d'exclusivité. La Société reste libre de conclure des contrats avec tout client, qu'il ait été ou non mis en relation par l'Apporteur, et de collaborer avec d'autres apporteurs d'affaires.

---

**Article 7 — Interdictions et sanctions**

7.1 — Il est strictement interdit à l'Apporteur de :
- Percevoir directement ou indirectement des sommes d'un Prospect pour le compte de la Société
- Se présenter comme employé, associé ou représentant officiel de la Société
- Utiliser des méthodes de prospection déloyales, trompeuses ou contraires à la loi
- Spammer, harceler ou importuner des Prospects
- Dénigrer la Société ou ses services
- Créer de faux comptes ou manipuler le système de parrainage

7.2 — En cas de manquement à l'une de ces obligations, la Société se réserve le droit de :
- Suspendre immédiatement le compte de l'Apporteur
- Annuler les commissions en attente de versement
- Réclamer le remboursement des commissions indûment perçues
- Résilier le présent contrat sans préavis ni indemnité
- Engager toute action judiciaire appropriée

---

**Article 8 — Durée et résiliation**

8.1 — Le présent contrat prend effet à la date de sa signature électronique par l'Apporteur.

8.2 — Il est conclu pour une durée indéterminée.

8.3 — Chaque partie peut résilier le contrat à tout moment, par notification écrite (email à l'adresse renseignée ou via la plateforme), avec un préavis de 30 jours.

8.4 — En cas de manquement grave aux obligations du présent contrat, la résiliation peut être immédiate et sans préavis, conformément à l'article 7.2.

8.5 — Les commissions acquises et validées avant la date de résiliation restent dues.

---

**Article 9 — Protection des données personnelles**

9.1 — La Société traite les données personnelles de l'Apporteur conformément au Règlement Général sur la Protection des Données (RGPD).

9.2 — Les données collectées (nom, prénom, adresse, téléphone, email) sont nécessaires à l'exécution du présent contrat et au versement des commissions.

9.3 — L'Apporteur dispose d'un droit d'accès, de rectification, de suppression et de portabilité de ses données en contactant la Société à l'adresse : [email de contact].

---

**Article 10 — Modification du programme**

La Société se réserve le droit de modifier à tout moment les modalités du programme d'apporteur d'affaires (notamment le montant des commissions), sous réserve d'en informer préalablement l'Apporteur par email ou via la plateforme.

---

**Article 11 — Modification du contrat**

11.1 — La Société se réserve le droit de modifier les termes du présent contrat.

11.2 — En cas de modification, l'Apporteur sera notifié par email ou via la plateforme et devra signer la nouvelle version du contrat pour continuer à bénéficier du programme.

11.3 — Le refus de signer la nouvelle version entraînera la suspension de l'accès au programme. Les commissions acquises et validées avant la suspension restent dues.

---

**Article 12 — Droit applicable et juridiction**

Le présent contrat est soumis au droit français. En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut, les tribunaux compétents de [ville du siège social] seront seuls compétents.

---

**Article 13 — Force majeure**

Aucune des parties ne pourra être tenue responsable de l'inexécution de ses obligations si cette inexécution résulte d'un cas de force majeure tel que défini par l'article 1218 du Code civil.

---

**Article 14 — Tolérance**

Le fait pour la Société de ne pas se prévaloir, à un moment donné, d'une quelconque clause du présent contrat ne pourra être interprété comme une renonciation à s'en prévaloir ultérieurement.

---

**Article 15 — Divisibilité**

Si l'une quelconque des stipulations du présent contrat est déclarée nulle ou inapplicable, les autres stipulations resteront en vigueur et de plein effet.

---

**Article 16 — Signature électronique**

Le présent contrat est signé électroniquement via le service Yousign, conformément au Règlement européen eIDAS. La signature électronique avancée a la même valeur juridique qu'une signature manuscrite.

---

## 5. Decision Log

| # | Décision | Alternatives considérées | Raison du choix |
|---|----------|-------------------------|-----------------|
| 1 | Signature électronique avancée (Yousign, conforme eIDAS) | Acceptation simple (CGU), signature manuscrite | Valeur juridique forte, conformité eIDAS, protection maximale |
| 2 | Yousign comme prestataire | DocuSign, HelloSign | Français, conforme eIDAS, API bien documentée, adapté contexte FR/particuliers |
| 3 | Blocage du compte avant signature | Accès limité, bandeau sans blocage | Garantit que 100% des apporteurs actifs ont signé |
| 4 | Collecte nom/prénom/adresse/téléphone | Avec pièce d'identité, minimum (nom seul) | Identification complète sans friction excessive |
| 5 | Contrat rédigé par nous (à valider avocat) | Modèle avocat, pas de contrat | Rapidité de mise en place, base solide à faire valider |
| 6 | Approche A : Yousign API intégrée Convex | Template pré-uploadé, service PDF tiers | Cohérent avec l'archi existante (Stripe Connect), contrôle total |
| 7 | Redirection Yousign (pas iframe) | Iframe intégrée | Moins de friction technique, meilleur support mobile, moins de bugs CSP |
| 8 | Webhook = source de vérité unique | Retour navigateur déclenche activation | Sécurité : empêche activation sans signature réelle |
| 9 | Versioning avec re-signature obligatoire + blocage | Notification sans blocage, pas de versioning | Garantie juridique que tous les apporteurs actifs sont sur la dernière version |
| 10 | Relance auto Yousign + bandeau dashboard | Pas de relance, suppression auto du compte | Maximise conversion sans perte de comptes |
| 11 | requiredContractVersionId / acceptedContractVersionId | Un seul champ | Gère le cas v1 signée pendant que v2 est requise |
| 12 | contractSnapshotContent + Hash | Référence simple vers contractVersions | Preuve exacte de ce qui a été présenté et signé |
| 13 | Dimensionnement léger, prêt à scaler | Gros volume d'emblée | Volume incertain, Yousign permet de monter progressivement |
| 14 | Délai de paiement 14 jours après encaissement | 30j, 45j, "délai raisonnable" | Correspond au fonctionnement réel du programme |
| 15 | Compensation sur commissions futures | Demande de remboursement direct | Plus simple à exécuter, moins conflictuel |
| 16 | Garde d'accès double (frontend + backend) | Frontend uniquement | Empêche tout contournement et sécurise les actions métier |

---

## 6. Hypothèses

- Volume de départ < 50 apporteurs, dimensionné pour scaler
- Le contrat sera validé par un avocat avant mise en production
- Yousign API v3 (dernière version stable)
- Le PDF signé est stocké côté Yousign + référence dans Convex
- Les apporteurs sont des particuliers uniquement
- `pdf-lib` pour la génération PDF côté serveur (Convex action)

---

## 7. Risques identifiés

| Risque | Mitigation |
|--------|-----------|
| Contrat non validé par avocat | Marquer comme draft, ne pas activer en prod sans validation |
| Webhook Yousign en retard/perdu | Mécanisme de vérification périodique du statut via Yousign API |
| Apporteur signe v1 alors que v2 est requise | Logique de vérification version dans le webhook |
| Coût Yousign si volume monte | Surveiller, possibilité de changer de plan Yousign |
| Données personnelles (RGPD) | Conformité RGPD dans le contrat, droit de suppression |

---

## 8. Stack technique

- **Backend** : Convex (actions, mutations, queries, HTTP endpoints)
- **Signature** : Yousign API v3
- **PDF** : `pdf-lib` (génération côté serveur)
- **Frontend** : Next.js App Router + Zustand
- **Paiement** : Stripe Connect Express (existant)
- **Hashing** : SHA-256 (Web Crypto API dans Convex actions)

---

## 9. Prêt pour implémentation

### Prérequis
- [ ] Compte Yousign API (sandbox + production)
- [ ] Clé API Yousign dans les variables d'environnement Convex
- [ ] Validation du contrat par un avocat
- [ ] Informations société Be in Digital (SIRET, RCS, adresse, représentant légal)

### Ordre d'implémentation recommandé
1. Schema Convex (nouvelles tables + modifications affiliateUsers)
2. Contenu du contrat v1.0 (mutation admin pour créer la version)
3. Page `/parrainage/contrat` (formulaire + affichage contrat)
4. Intégration Yousign API (génération PDF + création signature)
5. Webhook Yousign → Convex HTTP endpoint
6. Garde d'accès frontend (redirect si pas de contrat signé)
7. Garde d'accès backend (vérification dans mutations/queries)
8. Modification du flow d'inscription (requiredContractVersionId)
9. Écran de retour post-signature
10. Admin : mutation pour activer nouvelle version + re-bloquer les apporteurs
11. Tests E2E
