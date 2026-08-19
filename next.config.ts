import type { NextConfig } from "next";

const isStatic = process.env.NEXT_PUBLIC_STATIC_MODE === "true";

const nextConfig: NextConfig = {
  ...(isStatic ? { output: "export", basePath: process.env.NEXT_PUBLIC_BASE_PATH || "" } : { serverExternalPackages: ["vitest"] }),
};

export default nextConfig;
