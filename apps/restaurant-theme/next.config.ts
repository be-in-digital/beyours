import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@convex-dev/better-auth",
    "@beindigital-engine/ui",
    "@beindigital-engine/restaurant",
    "@beindigital-engine/admin",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
