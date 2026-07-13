import { NextResponse } from "next/server";
import { pushEnabled, vapidPublicKey } from "@/lib/push-flag";

// The VAPID public key is read from env at request time, never baked into
// the built image — the same image works with push on or off depending on
// the deployment's .env.
export async function GET() {
  if (!pushEnabled) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ key: vapidPublicKey() });
}
