"use client";

import { useState } from "react";
import { useLocale } from "@/lib/locale-context";
import type { ScheduleRequest, ScheduleResponse } from "@/lib/api-client";
import type { ExportDetail } from "./PrintSheet";

// Print + share-image actions with the user's export-detail choice: "full"
// includes all 50 sub-periods, "major" exports only the 10 main-bird major
// periods. One toggle governs both export paths.
export function ExportControls({
  schedule,
  lastRequest,
  detail,
  onDetailChange,
}: {
  schedule: ScheduleResponse;
  lastRequest: ScheduleRequest | null;
  detail: ExportDetail;
  onDetailChange: (d: ExportDetail) => void;
}) {
  const { dict, locale } = useLocale();
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(false);

  async function shareImage() {
    if (!lastRequest || sharing) return;
    setSharing(true);
    setShareError(false);
    try {
      const res = await fetch("/api/share-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lastRequest, detail, locale }),
      });
      if (!res.ok) throw new Error(`share-card ${res.status}`);
      const blob = await res.blob();
      const date = schedule.sunrise.slice(0, 10);
      const filename = `pancha-pakshi-${date}-${schedule.birth_bird}.png`;
      const file = new File([blob], filename, { type: "image/png" });
      // Native share sheet where supported (mobile); download everywhere else.
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch {
          // User cancelled or share failed — fall through to download.
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setShareError(true);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <label className="flex cursor-pointer items-center gap-1.5 text-sm opacity-80">
        <input
          type="checkbox"
          checked={detail === "full"}
          onChange={(e) => onDetailChange(e.target.checked ? "full" : "major")}
        />
        {dict.ui.includeSubPeriods}
      </label>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg border border-black/10 px-3 py-1.5 text-sm dark:border-white/20"
      >
        {dict.ui.print}
      </button>
      <button
        type="button"
        onClick={shareImage}
        disabled={sharing || !lastRequest}
        className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-white/20"
        data-testid="share-image"
      >
        {sharing ? dict.ui.loading : dict.ui.shareImage}
      </button>
      {shareError && <span className="text-xs text-red-600 dark:text-red-400">{dict.ui.error}</span>}
    </div>
  );
}
