import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@socialhub/shared", "@socialhub/db", "@socialhub/ui"],
};

export default nextConfig;
