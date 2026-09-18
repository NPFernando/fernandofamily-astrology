import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { getPrivacyVaultMigrationTelemetry } from "@/lib/privacy-vault-telemetry";

// /api/internal is loopback-only in the production reverse proxy. A dedicated
// key is preferred; the existing internal dispatch key is a compatibility
// fallback for installations that already protect internal cron routes.
export async function GET(request: Request) {
  const configuredKey = process.env.PRIVACY_VAULT_TELEMETRY_KEY ?? process.env.INTERNAL_DISPATCH_KEY;
  if (!configuredKey) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (request.headers.get("x-internal-key") !== configuredKey) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!dbConfigured()) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  try {
    return NextResponse.json(await getPrivacyVaultMigrationTelemetry(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }
}
