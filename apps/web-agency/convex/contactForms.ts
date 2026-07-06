import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

/**
 * submitContact — internalMutation appelée uniquement depuis l'httpAction
 * `POST /api/contact` (cf. convex/http.ts) qui hash l'IP du request et
 * fournit ipHashed.
 *
 * Auparavant publique, désormais privée pour éviter qu'un client malicieux
 * appelle directement la mutation avec un ipHashed forgé. Tout passage
 * par le httpAction garantit le hash server-side.
 *
 * Defense en profondeur :
 *   1. Hash IP server-side (httpAction → SHA-256(salt + ip))
 *   2. Validation longueur stricte (email max 254, message max 5000)
 *   3. Honeypot field : si rempli → marqué spam, pas d'erreur visible
 *   4. Rate limit : à implémenter via @convex-dev/rate-limiter (TODO)
 *   5. CORS allowlist sur l'httpAction
 *   6. Pas de logging du contenu du message
 */
export const submitContact = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    message: v.string(),
    honeypot: v.optional(v.string()),
    ipHashed: v.string(),
  },
  handler: async (ctx, args) => {
    // Validations longueur (defense in depth — le client doit valider via Zod aussi)
    if (args.name.trim().length === 0 || args.name.length > 200) {
      throw new Error("Nom invalide");
    }
    if (args.email.length > 254 || !args.email.includes("@")) {
      throw new Error("Email invalide");
    }
    if (args.message.trim().length === 0 || args.message.length > 5000) {
      throw new Error("Message invalide");
    }

    const honeypotTriggered = Boolean(args.honeypot && args.honeypot.length > 0);

    // On enregistre TOUT (y compris spam) pour analyse, mais on flag.
    // Le honeypot n'arrête pas la requête côté UX (pas de feedback au bot).
    const cleanName = args.name.trim();
    const cleanEmail = args.email.toLowerCase().trim();
    const cleanMessage = args.message.trim();

    const id = await ctx.db.insert("contactSubmissions", {
      name: cleanName,
      email: cleanEmail,
      message: cleanMessage,
      createdAt: Date.now(),
      ipHashed: args.ipHashed,
      honeypotTriggered,
      status: "new",
    });

    // Notification email vers hello@beindigital.fr — schedulée en action
    // car les mutations ne peuvent pas faire d'I/O réseau (sandbox V8).
    // Skipped si honeypot triggered : on ne notifie pas pour les bots.
    if (!honeypotTriggered) {
      await ctx.scheduler.runAfter(0, internal.emails.sendContactEmail, {
        name: cleanName,
        email: cleanEmail,
        message: cleanMessage,
      });
    }

    return id;
  },
});
