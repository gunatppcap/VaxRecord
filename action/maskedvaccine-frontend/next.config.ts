import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Enable static export for GitHub Pages
  output: "export",
  // Derive basePath/assetPrefix from env for GitHub Pages
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // Improve static hosting compatibility
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;



