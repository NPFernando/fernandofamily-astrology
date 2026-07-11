import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { authEnabled } from "@/lib/auth-flag";

// force-dynamic matters here: without it, a build run without auth env vars
// (the normal case — secrets are never present at image build) would see a
// constant 404 handler, prerender it as static, and drop the route from the
// runtime server entirely — at which point requests fall through Next's
// /api rewrite to the FastAPI backend instead of 404ing here. The env check
// must happen per-request at runtime, not at module/build evaluation.
export const dynamic = "force-dynamic";

function notFound() {
  return new Response("Not Found", { status: 404 });
}

export async function GET(request: NextRequest) {
  if (!authEnabled) return notFound();
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  if (!authEnabled) return notFound();
  return handlers.POST(request);
}
