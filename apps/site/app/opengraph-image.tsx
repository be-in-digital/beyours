import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BeYours — plateforme digitale pour restaurants";
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
            "radial-gradient(1000px 600px at 80% 12%, rgba(197,84,44,0.20), transparent 60%), radial-gradient(900px 620px at 10% 92%, rgba(197,84,44,0.10), transparent 65%), #faf5ee",
          color: "#221c15",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            fontSize: "40px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          {/* BeYours, not BeInDigital (#535). This card is what appears when
              anybody shares a link to this site, and it carried the AGENCY's
              name on a page selling the PRODUCT — the one place the wrong brand
              reaches an audience that has not arrived yet. See README.md §
              Naming, which exists because the two are routinely confused. */}
          <span>Be</span>
          <span style={{ color: "#c5542c" }}>Yours</span>
        </div>

        {/* Message */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "28px",
            maxWidth: "1000px",
          }}
        >
          <div
            style={{
              fontSize: "84px",
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              fontWeight: 600,
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            Vendez en direct,
            <span style={{ color: "#c5542c", marginLeft: "20px" }}>
              sans commission.
            </span>
          </div>
          <div
            style={{
              fontSize: "30px",
              lineHeight: 1.4,
              color: "#4a4136",
              maxWidth: "900px",
            }}
          >
            La plateforme digitale des restaurateurs indépendants. Site premium,
            commande en ligne, fidélité. 0 % de commission sur vos ventes.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "24px",
            color: "#6f6456",
          }}
        >
          <div>beyours.fr</div>
          <div style={{ color: "#c5542c", fontWeight: 600 }}>
            0 % de commission
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
