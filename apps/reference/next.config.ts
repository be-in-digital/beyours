import type { NextConfig } from "next";

/**
 * Host serving the public S3 prefixes, derived from AWS_S3_PUBLIC_BASE_URL.
 *
 * next/image fetches these hosts server-side and unauthenticated, so the list
 * must name the CDN origin rather than every bucket in the region. When the
 * variable is unset the previous wildcard is kept so an unconfigured
 * deployment still renders — that state is what the env validation in
 * @be-in-digital/core rejects in production.
 *
 * See apps/docs/deployment/s3-bucket-policy.md.
 */
function publicAssetHosts(): string[] {
  const base = process.env.AWS_S3_PUBLIC_BASE_URL;
  if (!base) return ["**.s3.eu-west-3.amazonaws.com"];
  try {
    return [new URL(base).hostname];
  } catch {
    return ["**.s3.eu-west-3.amazonaws.com"];
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
      ...publicAssetHosts().map((hostname) => ({
        protocol: "https" as const,
        hostname,
      })),
    ],
  },
};

export default nextConfig;
