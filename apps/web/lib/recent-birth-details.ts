"use client";

import { useCallback, useMemo } from "react";
import { useLocalVault } from "@/components/LocalVaultProvider";

export type RecentBirthDetails = { birth_date: string; birth_time: string };

const MAX_RECENT = 5;

export function useRecentBirthDetails() {
  const { data, update, unlocked } = useLocalVault();
  const entries = useMemo(() => data.recentBirthDetails ?? [], [data.recentBirthDetails]);
  const recent = entries[0] ?? null;
  const saveRecentBirthDetails = useCallback(
    async (entry: RecentBirthDetails) => {
      if (!unlocked) return;
      await update((current) => ({
        ...current,
        recentBirthDetails: [
          entry,
          ...(current.recentBirthDetails ?? []).filter(
            (value) => value.birth_date !== entry.birth_date || value.birth_time !== entry.birth_time,
          ),
        ].slice(0, MAX_RECENT),
      }));
    },
    [unlocked, update],
  );
  return useMemo(() => ({ recent, saveRecentBirthDetails, unlocked }), [recent, saveRecentBirthDetails, unlocked]);
}
