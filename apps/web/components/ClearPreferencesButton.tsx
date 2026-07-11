"use client";

import { useState } from "react";
import { clearSavedPreferences } from "@/lib/preferences";

// Client island for the otherwise-server privacy page: labels come in as
// props so the page itself can stay a server component with metadata.
export function ClearPreferencesButton({
  label,
  clearedMessage,
}: {
  label: string;
  clearedMessage: string;
}) {
  const [cleared, setCleared] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          clearSavedPreferences();
          setCleared(true);
        }}
        className="mt-6 rounded-full border border-black/10 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        {label}
      </button>
      {cleared && <p className="mt-2 text-sm text-accent">{clearedMessage}</p>}
    </>
  );
}
