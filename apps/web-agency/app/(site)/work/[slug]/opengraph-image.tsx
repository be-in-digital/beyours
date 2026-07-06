import { ImageResponse } from "next/og";

import { urlFor } from "@/sanity/image";
import { sanityFetch } from "@/sanity/lib/fetch";
import { caseStudyBySlugQuery } from "@/sanity/lib/queries";
import type { CaseStudyDetail } from "@/sanity/types";

export const alt = "Be in Digital — Étude de cas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ slug: string }> };

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const study = await sanityFetch<CaseStudyDetail | null>({
    query: caseStudyBySlugQuery,
    params: { slug },
  }).catch(() => null);

  if (!study) {
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
          <span
            style={{
              fontSize: "14px",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "#52CFAF",
              fontFamily: "sans-serif",
              marginBottom: "24px",
            }}
          >
            Be in Digital · Études de cas
          </span>
          <span
            style={{
              fontSize: "64px",
              fontWeight: 300,
              color: "#ffffff",
              lineHeight: 1.0,
              letterSpacing: "-0.02em",
            }}
          >
            Notre travail
          </span>
        </div>
      ),
      { ...size },
    );
  }

  const coverUrl = study.cover
    ? urlFor(study.cover).width(400).height(250).fit("crop").auto("format").url()
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
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
              "radial-gradient(ellipse at 20% 10%, rgba(82, 207, 175, 0.22), transparent 55%)",
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
            flexDirection: "column",
            justifyContent: "flex-end",
            flex: 1,
            paddingRight: coverUrl ? "60px" : "0",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#52CFAF",
                boxShadow: "0 0 8px #52CFAF",
              }}
            />
            <span
              style={{
                fontFamily: "sans-serif",
                fontSize: "13px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "#52CFAF",
                fontWeight: 400,
              }}
            >
              {[study.client, study.category, study.year]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <span
            style={{
              fontSize: coverUrl ? "56px" : "68px",
              fontWeight: 300,
              lineHeight: 1.05,
              color: "#ffffff",
              letterSpacing: "-0.02em",
              marginBottom: "20px",
            }}
          >
            {study.title}
          </span>
          {study.blurb ? (
            <span
              style={{
                fontSize: "18px",
                fontWeight: 300,
                lineHeight: 1.5,
                color: "rgba(255,255,255,0.45)",
                fontFamily: "sans-serif",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                overflow: "hidden",
              }}
            >
              {study.blurb}
            </span>
          ) : null}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "32px",
            }}
          >
            <span
              style={{
                fontFamily: "sans-serif",
                fontSize: "12px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              Be in Digital
            </span>
          </div>
        </div>
        {coverUrl ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              width: "360px",
              flexShrink: 0,
              position: "relative",
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: "360px",
                height: "225px",
                borderRadius: "12px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow:
                  "0 20px 60px -10px rgba(82, 207, 175, 0.2), 0 0 0 1px rgba(82, 207, 175, 0.06)",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(135deg, rgba(82,207,175,0.06), transparent 60%)",
                  zIndex: 1,
                }}
              />
              <img
                src={coverUrl}
                width={360}
                height={225}
                style={{ objectFit: "cover", width: "100%", height: "100%" }}
              />
            </div>
          </div>
        ) : null}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "2px",
            background:
              "linear-gradient(to right, transparent, rgba(82, 207, 175, 0.5), transparent)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
