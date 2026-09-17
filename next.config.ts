import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide the floating Next.js "N" so it does not cover the LGPD footer in demos.
  devIndicators: false,
};

export default nextConfig;
