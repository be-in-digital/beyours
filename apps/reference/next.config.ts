import type { NextConfig } from "next";

/**
 * The S3 bucket is private, so its hostname is deliberately absent here:
 * uploaded media is served same-origin by `/api/files`, which needs no
 * `remotePatterns` entry. A deployment that puts a CDN in front of the bucket
 * declares it once, in `AWS_S3_PUBLIC_BASE_URL`, and it is allowed from there.
 * See `apps/docs/deployment/s3-bucket-policy.md`.
 */
function cdnPattern() {
  const base = process.env.AWS_S3_PUBLIC_BASE_URL?.trim();
  if (!base) return [];

  try {
    const { protocol, hostname } = new URL(base);
    return [{ protocol: protocol.replace(":", "") as "http" | "https", hostname }];
  } catch {
    throw new Error(
      `AWS_S3_PUBLIC_BASE_URL is not a valid URL: ${base}. ` +
        "Expected the CDN origin, e.g. https://cdn.example.com",
    );
  }
}

const nextConfig: NextConfig = {
  // App TypeScript errors fail the build (production safety). Convex backend
  // files are type-checked separately (`npx convex deploy`) and are already
  // excluded from this app's tsconfig (`exclude: ["convex"]`), so they are not
  // part of the Next.js build regardless of this flag.
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: ["@convex-dev/better-auth"],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      ...cdnPattern(),
    ],
  },
};

export default nextConfig;
