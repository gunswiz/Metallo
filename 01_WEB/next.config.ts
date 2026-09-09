import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@metallo/core", "@metallo/types", "@metallo/validation"],
  poweredByHeader: false,
};

export default nextConfig;
