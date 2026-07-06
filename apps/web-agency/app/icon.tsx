import { ImageResponse } from "next/og";

/**
 * app/icon.tsx — favicon programmatique Next 16.
 * Rendu : disque mint avec un "B" Fraunces blanc.
 *
 * Évite l'erreur 404 /favicon.ico observée en prod (Lighthouse pénalise
 * en best-practices et SEO sinon).
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 30% 30%, #7DDBC3, #52CFAF 60%, #46B095)",
          color: "#0A0A0A",
          fontSize: 22,
          fontWeight: 600,
          fontFamily: "serif",
          borderRadius: "20%",
          letterSpacing: "-0.05em",
        }}
      >
        B
      </div>
    ),
    { ...size },
  );
}
