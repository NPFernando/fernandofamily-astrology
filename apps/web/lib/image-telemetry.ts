"use client";

export type ImageTelemetryOutcome = "loaded" | "deferred" | "revealed";
export type ImageTransferBucket = "none" | "under-25kb" | "under-100kb" | "under-250kb" | "250kb-plus";

function doNotTrack() {
  return navigator.doNotTrack === "1" || (window as Window & { doNotTrack?: string }).doNotTrack === "1";
}

export function imageTransferBucket(bytes: number): ImageTransferBucket {
  if (bytes <= 0) return "none";
  if (bytes < 25_000) return "under-25kb";
  if (bytes < 100_000) return "under-100kb";
  if (bytes < 250_000) return "under-250kb";
  return "250kb-plus";
}

/** Sends no identifiers, URLs, cookies, or calculator inputs. */
export function recordImageTelemetry(outcome: ImageTelemetryOutcome, transferBucket: ImageTransferBucket = "none", count = 1) {
  if (typeof window === "undefined" || doNotTrack()) return;
  void fetch("/api/telemetry/image-load", {
    method: "POST",
    credentials: "omit",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ outcome, transferBucket, count: Math.min(25, Math.max(1, Math.floor(count))) }),
  }).catch(() => undefined);
}
