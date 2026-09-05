import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep Turbopack scoped to this repository when a parent folder has a lockfile.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
