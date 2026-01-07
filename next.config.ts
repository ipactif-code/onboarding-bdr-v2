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
      {
        protocol: "https",
        hostname: "media.giphy.com",
      },
      {
        protocol: "https",
        hostname: "media1.giphy.com",
      },
      {
        protocol: "https",
        hostname: "media2.giphy.com",
      },
      {
        protocol: "https",
        hostname: "media3.giphy.com",
      },
      {
        protocol: "https",
        hostname: "i.giphy.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
};

export default nextConfig;
