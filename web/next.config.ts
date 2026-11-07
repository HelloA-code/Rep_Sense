import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Going back to a tab within 30 s reuses it instead of fetching again.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
