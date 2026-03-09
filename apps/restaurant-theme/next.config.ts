import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "192.168.1.99",
    "192.168.64.1",
    "Mac-mini-de-admin.local",
  ],
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
