import { NextResponse } from "next/server";
import { exportImageTelemetry, recordImageTelemetry, type ImageTelemetryOutcome, type ImageTransferBucket } from "@/lib/image-telemetry-store";

const OUTCOMES = new Set(["loaded", "deferred", "revealed"]);
const TRANSFER_BUCKETS = new Set(["none", "under-25kb", "under-100kb", "under-250kb", "250kb-plus"]);

/**
 * This endpoint accepts a deliberately non-identifying aggregate. Deployment
 * logging can count these fixed labels; the application never receives a
 * resource URL, cookie value, account ID, or birth input.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new NextResponse(null, { status: 204 });
  const { outcome, transferBucket, count } = body as Record<string, unknown>;
  if (!OUTCOMES.has(String(outcome)) || !TRANSFER_BUCKETS.has(String(transferBucket)) || !Number.isInteger(count) || Number(count) < 1 || Number(count) > 25) {
    return new NextResponse(null, { status: 204 });
  }
  recordImageTelemetry(outcome as ImageTelemetryOutcome, transferBucket as ImageTransferBucket, Number(count));
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}

/** A deployment token is required; unset means this export is fully disabled. */
export function GET(request: Request) {
  const token = process.env.IMAGE_TELEMETRY_DASHBOARD_TOKEN;
  if (!token || request.headers.get("authorization") !== `Bearer ${token}`) return new NextResponse(null, { status: 404 });
  return NextResponse.json(exportImageTelemetry(), { headers: { "cache-control": "no-store" } });
}
