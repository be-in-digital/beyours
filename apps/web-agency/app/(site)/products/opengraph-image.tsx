import { ImageResponse } from "next/og";

export const alt = "Produits — Be in Digital, nos SaaS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "#090909",
          padding: "80px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "700px",
            height: "500px",
            background:
              "radial-gradient(ellipse at 25% 15%, rgba(82, 207, 175, 0.25), transparent 60%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.03,
            backgroundImage:
              "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "4px 4px",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            right: "100px",
            width: "300px",
            height: "300px",
            background:
              "radial-gradient(ellipse at 80% 10%, rgba(82, 207, 175, 0.1), transparent 65%)",
          }}
        />
        <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
          {["Be in Digital Restaurant", "Jokko", "Wedilly Bird"].map((name) => (
            <div
              key={name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(82, 207, 175, 0.08)",
                border: "1px solid rgba(82, 207, 175, 0.2)",
                borderRadius: "100px",
                padding: "6px 14px",
              }}
            >
              <div
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: "#52CFAF",
                }}
              />
              <span
                style={{
                  fontFamily: "sans-serif",
                  fontSize: "12px",
                  letterSpacing: "0.15em",
                  color: "#52CFAF",
                }}
              >
                {name}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span
            style={{
              fontSize: "72px",
              fontWeight: 300,
              lineHeight: 1.0,
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            Nos produits
          </span>
          <span
            style={{
              fontSize: "28px",
              fontWeight: 300,
              lineHeight: 1.3,
              color: "rgba(255,255,255,0.5)",
              fontStyle: "italic",
            }}
          >
            SaaS food-tech & restaurant conçus en interne
          </span>
        </div>
        <span
          style={{
            fontFamily: "sans-serif",
            fontSize: "12px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.25)",
            marginTop: "32px",
          }}
        >
          Be in Digital · Studio digital Paris
        </span>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "2px",
            background:
              "linear-gradient(to right, transparent, rgba(82, 207, 175, 0.6), transparent)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
