import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

import { DataModel } from "./_generated/dataModel";

/**
 * Convex Auth — back-office agence. Provider Password (email + mot de passe) :
 * le plus simple pour une équipe interne 2-3, zéro dépendance email.
 *
 * Bootstrap owner « turnkey » : le compte créé avec OWNER_EMAIL devient owner
 * automatiquement à l'inscription. `profile` n'est appliqué qu'au signUp
 * (createAccount) — vérifié dans la source Convex Auth : le signIn ne fait que
 * `retrieveAccount` par email, donc un rôle accordé ensuite n'est JAMAIS
 * écrasé. Override possible via `AGENCY_OWNER_EMAIL` (env du déploiement Convex).
 *
 * Sécurité par défaut : tout autre inscrit n'a AUCUN rôle => aucun accès
 * (cf. `authz.requireBackOfficeAccess`). Activation des autres membres via
 * `internal.users.grantAccess`.
 */
const OWNER_EMAIL = (
  process.env.AGENCY_OWNER_EMAIL ?? "hello@beindigital.fr"
).toLowerCase();

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        const email = String(params.email ?? "").toLowerCase();
        return email === OWNER_EMAIL
          ? { email, role: "owner" as const, active: true }
          : { email };
      },
    }),
  ],
});
