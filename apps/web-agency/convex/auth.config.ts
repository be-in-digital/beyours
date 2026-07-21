/**
 * Config JWT Convex Auth. L'issuer est l'URL du site Convex, fournie
 * automatiquement par le déploiement via `CONVEX_SITE_URL`. Sans ce fichier,
 * `ctx.auth.getUserIdentity()` renvoie toujours null.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
