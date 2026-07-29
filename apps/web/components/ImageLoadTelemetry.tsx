"use client";

import { useEffect } from "react";
import { imageTransferBucket, recordImageTelemetry, type ImageTransferBucket } from "@/lib/image-telemetry";

/** Batches poster-resource measurements without ever reporting an asset URL. */
export function ImageLoadTelemetry() {
  useEffect(() => {
    if (!("PerformanceObserver" in window)) return;
    const buckets = new Map<ImageTransferBucket, number>();
    let timer: number | undefined;
    const flush = () => {
      for (const [bucket, count] of buckets) recordImageTelemetry("loaded", bucket, count);
      buckets.clear();
      timer = undefined;
    };
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntriesByType("resource") as PerformanceResourceTiming[]) {
        if (!new URL(entry.name).pathname.startsWith("/posters/")) continue;
        const bucket = imageTransferBucket(entry.transferSize);
        buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
      }
      if (timer === undefined) timer = window.setTimeout(flush, 1_000);
    });
    observer.observe({ type: "resource", buffered: true });
    return () => {
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
      flush();
    };
  }, []);
  return null;
}
