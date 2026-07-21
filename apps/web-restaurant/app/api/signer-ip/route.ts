/**
 * Renvoie l'adresse IP de l'appelant, lue côté serveur via l'en-tête de proxy.
 * Sert à horodater la piste d'audit de la signature électronique de l'apporteur
 * (l'IP n'est pas accessible depuis une action Convex classique).
 */
export async function GET(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  return Response.json({ ip });
}
