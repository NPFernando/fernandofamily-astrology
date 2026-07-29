export type ImageTelemetryOutcome = "loaded" | "deferred" | "revealed";
export type ImageTransferBucket = "none" | "under-25kb" | "under-100kb" | "under-250kb" | "250kb-plus";

type TelemetryState = { startedAt: string; counts: Map<string, number> };
type TelemetryGlobal = typeof globalThis & { __ffImageTelemetry?: TelemetryState };

function state() {
  const root = globalThis as TelemetryGlobal;
  root.__ffImageTelemetry ??= { startedAt: new Date().toISOString(), counts: new Map() };
  return root.__ffImageTelemetry;
}

export function recordImageTelemetry(outcome: ImageTelemetryOutcome, transferBucket: ImageTransferBucket, count: number) {
  const telemetry = state();
  const key = `${outcome}:${transferBucket}`;
  telemetry.counts.set(key, (telemetry.counts.get(key) ?? 0) + count);
}

export function exportImageTelemetry() {
  const telemetry = state();
  return {
    startedAt: telemetry.startedAt,
    generatedAt: new Date().toISOString(),
    events: [...telemetry.counts.entries()]
      .map(([key, count]) => {
        const [outcome, transferBucket] = key.split(":") as [ImageTelemetryOutcome, ImageTransferBucket];
        return { outcome, transferBucket, count };
      })
      .sort((a, b) => a.outcome.localeCompare(b.outcome) || a.transferBucket.localeCompare(b.transferBucket)),
  };
}
