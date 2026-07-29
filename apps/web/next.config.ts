import type { NextConfig } from "next";
import path from "node:path";

// In local dev (no reverse proxy in front), forward /api/* to the FastAPI
// backend so the frontend can always call same-origin relative URLs, matching
// production where nginx does this proxying instead.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8100";

const nextConfig: NextConfig = {
  output: "standalone",
  // pg is a CommonJS package with optional native bindings; letting the
  // bundler wrap it produces a broken hashed external ("pg-<hash>") that the
  // standalone runtime can't resolve. Marking it external keeps it a plain
  // node_modules require, which standalone output traces and copies.
  serverExternalPackages: ["pg", "web-push", "sharp"],
  // Sharp resolves libvips dynamically, so Next's file tracer sees its JS
  // wrapper but not the platform shared library. Keep it in standalone output
  // for the PNG share-card routes.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/.pnpm/@img+sharp-libvips-*/node_modules/@img/sharp-libvips-*/lib/**"],
  },
  // This app imports packages/feature-registry from outside apps/web (the
  // monorepo root) — tell Next.js's bundler that's the real project root so
  // it resolves those files instead of treating apps/web as an island.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  async headers() {
    return [
      {
        source: "/posters/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
  async rewrites() {
    // `fallback` (not the default afterFiles) is load-bearing: afterFiles
    // rewrites run BEFORE dynamic routes are matched, so a plain rewrite
    // here would swallow /api/auth/[...nextauth] and /api/account/*/[id]
    // and proxy them to FastAPI. Fallback rewrites only apply when no Next
    // route — static or dynamic — matched the request.
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [{ source: "/api/:path*", destination: `${API_PROXY_TARGET}/api/:path*` }],
    };
  },
};

export default nextConfig;
