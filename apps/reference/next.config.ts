import type { NextConfig } from "next";

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
      {
        protocol: "https",
        hostname: "**.s3.eu-west-3.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
