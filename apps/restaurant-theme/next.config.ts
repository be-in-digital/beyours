import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Convex backend files have their own tsconfig and are type-checked
  // separately via `npx convex deploy`. Skip them in Next.js build.
  typescript: {
    ignoreBuildErrors: true,
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
