# Programme Apporteur d'Affaires — Phase 1

## Auth + Inscription + Code parrainage

- [ ] Installer les dépendances (@convex-dev/auth, convex-test, vitest, @edge-runtime/vm)
- [ ] Mettre à jour convex/schema.ts (authTables + affiliateUsers, referralCodes, affiliateSettings)
- [ ] Configurer Convex Auth (auth.config.ts, auth.ts avec Password provider)
- [ ] Mettre à jour convex/http.ts (ajouter auth routes)
- [ ] Créer convex/affiliateUsers.ts (CRUD apporteurs)
- [ ] Créer convex/referralCodes.ts (génération et gestion codes)
- [ ] Créer convex/affiliateSettings.ts (config globale)
- [ ] Mettre à jour components/convex-provider.tsx (ConvexAuthNextjsServerProvider)
- [ ] Créer proxy.ts pour la protection des routes
- [ ] Créer lib/affiliate-store.ts (Zustand store)
- [ ] Créer app/parrainage/layout.tsx
- [ ] Créer app/parrainage/page.tsx (landing page)
- [ ] Créer app/parrainage/inscription/page.tsx
- [ ] Créer app/parrainage/connexion/page.tsx
- [ ] Créer app/parrainage/dashboard/page.tsx (basique)
- [ ] Créer app/parrainage/dashboard/profil/page.tsx
- [ ] Créer app/parrainage/dashboard/partage/page.tsx
- [ ] Mettre à jour components/footer.tsx (lien apporteur)
- [ ] Configurer vitest + écrire tests unitaires
- [ ] Déployer sur Convex (pnpx convex deploy)

## Tests Phase 1
- [ ] Test: inscription email/password
- [ ] Test: connexion
- [ ] Test: génération code parrainage
- [ ] Test: personnalisation code
- [ ] Test: protection routes (redirect si non auth)
- [ ] Test: dashboard basique accessible après auth
