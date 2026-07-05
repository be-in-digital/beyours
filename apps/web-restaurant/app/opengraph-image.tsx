import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Be in Digital — plateforme digitale pour restaurants";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "radial-gradient(1200px 630px at 75% 25%, rgba(82,207,175,0.22), transparent 60%), radial-gradient(900px 600px at 15% 85%, rgba(82,207,175,0.12), transparent 65%), #0A0A0A",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            padding: "10px 18px",
            borderRadius: "999px",
            border: "1px solid rgba(82,207,175,0.35)",
            background: "rgba(82,207,175,0.08)",
            fontSize: "22px",
            color: "#A0E5D3",
          }}
        >
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "999px",
              background: "#52CFAF",
            }}
          />
          Be in Digital
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "28px",
            maxWidth: "980px",
          }}
        >
          <div
            style={{
              fontSize: "78px",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              fontWeight: 500,
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            La plateforme digitale des
            <span style={{ color: "#52CFAF", fontStyle: "italic", margin: "0 18px" }}>
              restaurateurs
            </span>
            indépendants
          </div>
          <div
            style={{
              fontSize: "28px",
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.72)",
              maxWidth: "880px",
            }}
          >
            Site premium, commande sans commission, KDS, centralisation Uber Eats &
            Deliveroo, fidélité.
          </div>
        </div>

        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "22px",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            restaurant.beindigital.fr
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", color: "#52CFAF" }}>
            Restaurant-first · Premium · Tech
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
