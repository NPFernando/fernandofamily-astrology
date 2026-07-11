import type { NextConfig } from "next";
import path from "node:path";

// In local dev (no reverse proxy in front), forward /api/* to the FastAPI
// backend so the frontend can always call same-origin relative URLs, matching
// production where nginx does this proxying instead.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8100";

const nextConfig: NextConfig = {
  output: "standalone",
  // This app imports packages/feature-registry from outside apps/web (the
  // monorepo root) — tell Next.js's bundler that's the real project root so
  // it resolves those files instead of treating apps/web as an island.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_PROXY_TARGET}/api/:path*` }];
  },
};

export default nextConfig;
