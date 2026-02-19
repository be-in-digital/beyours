import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@convex-dev/better-auth"],
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
