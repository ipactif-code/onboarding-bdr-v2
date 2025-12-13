import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "determined-vole-238.convex.cloud",
      },
      {
        protocol: "https",
        hostname: "acoustic-buffalo-308.convex.cloud",
      },
    ],
  },
};

export default nextConfig;
