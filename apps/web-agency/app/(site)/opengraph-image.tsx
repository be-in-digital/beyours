import { ImageResponse } from "next/og";

export const alt = "Be in Digital — Studio digital · Paris";
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
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#52CFAF",
              boxShadow: "0 0 12px #52CFAF",
            }}
          />
          <span
            style={{
              fontFamily: "sans-serif",
              fontSize: "14px",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "#52CFAF",
              fontWeight: 400,
            }}
          >
            Studio digital · Paris
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span
            style={{
              fontSize: "80px",
              fontWeight: 300,
              lineHeight: 1.0,
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            Be in Digital
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
            Conception & ingénierie produit premium
          </span>
        </div>
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
