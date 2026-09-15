import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname, // force workspace root to the brain-dump folder
  },
};

export default nextConfig;