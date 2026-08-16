# Business Referrer Program — Phase 1

## Auth + Signup + Referral code

- [ ] Install the dependencies (@convex-dev/auth, convex-test, vitest, @edge-runtime/vm)
- [ ] Update convex/schema.ts (authTables + affiliateUsers, referralCodes, affiliateSettings)
- [ ] Configure Convex Auth (auth.config.ts, auth.ts with Password provider)
- [ ] Update convex/http.ts (add auth routes)
- [ ] Create convex/affiliateUsers.ts (referrer CRUD)
- [ ] Create convex/referralCodes.ts (code generation and management)
- [ ] Create convex/affiliateSettings.ts (global config)
- [ ] Update components/convex-provider.tsx (ConvexAuthNextjsServerProvider)
- [ ] Create proxy.ts for route protection
- [ ] Create lib/affiliate-store.ts (Zustand store)
- [ ] Create app/parrainage/layout.tsx
- [ ] Create app/parrainage/page.tsx (landing page)
- [ ] Create app/parrainage/inscription/page.tsx
- [ ] Create app/parrainage/connexion/page.tsx
- [ ] Create app/parrainage/dashboard/page.tsx (basic)
- [ ] Create app/parrainage/dashboard/profil/page.tsx
- [ ] Create app/parrainage/dashboard/partage/page.tsx
- [ ] Update components/footer.tsx (referrer link)
- [ ] Configure vitest + write unit tests
- [ ] Deploy to Convex (pnpx convex deploy)

## Phase 1 tests
- [ ] Test: email/password signup
- [ ] Test: login
- [ ] Test: referral code generation
- [ ] Test: code customization
- [ ] Test: route protection (redirect if not authenticated)
- [ ] Test: basic dashboard reachable after auth
