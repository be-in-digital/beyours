import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Webhook Sanity → revalide le cache ISR Next.js immédiatement.
 *
 * Configuration côté Sanity (à faire 1 fois) :
 *   sanity.io/manage/project/35fdt477/api → Webhooks → Create new
 *   - URL : https://beindigital.fr/api/revalidate
 *   - Trigger on : Create / Update / Delete
 *   - Filter : (laisser vide pour tout, ou cibler specific types)
 *   - Secret : valeur copiée dans SANITY_REVALIDATE_SECRET
 *
 * Le webhook Sanity fournit la signature HMAC-SHA256 dans le header
 * `sanity-webhook-signature`. Pour la phase MVP, on se contente d'un
 * shared secret simple en query string. Renforcement HMAC en suivante.
 */
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expected = process.env.SANITY_REVALIDATE_SECRET;

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "SANITY_REVALIDATE_SECRET not configured" },
      { status: 500 },
    );
  }

  if (secret !== expected) {
    return NextResponse.json(
      { ok: false, error: "Invalid secret" },
      { status: 401 },
    );
  }

  // Tout fetch sanityFetch est taggé "sanity" — un seul revalidateTag suffit.
  // Next 16 demande un second argument cache profile : "max" purge tout
  // de suite (vs "default" qui invalide à la prochaine requête).
  revalidateTag("sanity", "max");

  return NextResponse.json({ ok: true, revalidated: true, tag: "sanity" });
}
