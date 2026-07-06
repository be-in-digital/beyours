---
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": minor
---

Système de maintenance & migration : contrat de maintenance par déploiement (statut dérivé, couverture des mises à jour par date de release), catalogue de releases synchronisé depuis npm avec verrouillage des versions publiées après expiration, demandes de migration de site (workflow à transitions contrôlées + journal d'audit), renouvellement self-serve via Stripe (webhook `bidProduct: maintenance` → contrat, jamais ownerEntitlements) et notifications SES à la création d'une demande. Nouvel onglet Maintenance dans la page Système de l'admin.
