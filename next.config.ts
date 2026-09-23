import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone — a self-contained server bundle for the Docker image
  // (see Dockerfile) that doesn't require installing node_modules in the runtime container.
  output: "standalone",
};

export default nextConfig;
