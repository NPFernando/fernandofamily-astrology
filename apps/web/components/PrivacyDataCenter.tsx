"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalVault } from "@/components/LocalVaultProvider";
import { listLocalProfiles } from "@/lib/profiles";
import { useLocale } from "@/lib/locale-context";

// This is deliberately an inventory, not a second store. It gives a person
// evidence of what is currently encrypted in this browser without rendering
// their birth values, precise locations, or profile identities into the DOM.
export function PrivacyDataCenter() {
  const { dict } = useLocale();
  const { data, ready, unlocked, hasEncryptedData, legacyMigrationPending } = useLocalVault();
  const localProfileCount = useMemo(() => listLocalProfiles().length, []);
  const [device, setDevice] = useState({ online: false, serviceWorkerReady: false });

  useEffect(() => {
    const update = () => setDevice({
      online: navigator.onLine,
      serviceWorkerReady: Boolean(navigator.serviceWorker?.controller),
    });
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!ready) return null;

  function downloadDerivedProfiles() {
    // Saved profiles contain only derived bird/nakshatra identifiers. This is
    // intentionally separate from the encrypted vault backup so a person can
    // take their reusable planning identities without exporting birth inputs.
    const payload = JSON.stringify({ format: "fernandofamily-derived-profiles", version: 1, profiles: listLocalProfiles() });
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "fernando-family-derived-profiles.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  const items = [
    [dict.ui.dataCenterBirthDetails, data.recentBirthDetails?.length ?? 0],
    [dict.ui.dataCenterLocations, data.recentLocations?.length ?? 0],
    [dict.ui.dataCenterCachedGuides, Number(Boolean(data.cachedSchedule)) + Number(Boolean(data.cachedDailyGuide))],
    [dict.ui.dataCenterDerivedProfiles, localProfileCount],
    [dict.ui.dataCenterPlans, data.plans?.length ?? 0],
    [dict.ui.dataCenterGroups, data.familyGroups?.length ?? 0],
  ] as const;

  return (
    <section data-testid="privacy-data-center" className="mt-8 rounded-xl border border-black/10 p-4 dark:border-white/15">
      <h2 className="text-lg font-semibold">{dict.ui.dataCenterTitle}</h2>
      <p className="mt-2 text-sm leading-relaxed opacity-80">{dict.ui.dataCenterBody}</p>
      <p className="mt-2 text-xs font-medium text-accent">
        {unlocked ? dict.ui.dataCenterUnlocked : hasEncryptedData ? dict.ui.dataCenterLocked : dict.ui.dataCenterEmpty}
      </p>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map(([label, count]) => (
          <div key={label} className="rounded-lg border border-black/10 px-3 py-2 dark:border-white/10">
            <dt className="text-xs uppercase opacity-70">{label}</dt>
            <dd className="mt-1 text-lg font-semibold">{unlocked ? count : "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
        <h3 className="font-semibold">{dict.ui.deviceReadinessTitle}</h3>
        <p className="mt-1 text-xs opacity-70">{dict.ui.deviceReadinessBody}</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          <li>{device.online ? dict.ui.deviceReadinessOnline : dict.ui.deviceReadinessOffline}</li>
          <li>{device.serviceWorkerReady ? dict.ui.deviceReadinessWorkerReady : dict.ui.deviceReadinessWorkerPending}</li>
          <li>{hasEncryptedData ? dict.ui.deviceReadinessVaultReady : dict.ui.deviceReadinessVaultEmpty}</li>
          <li>{legacyMigrationPending ? dict.ui.deviceReadinessMigrationNeeded : dict.ui.deviceReadinessMigrationReady}</li>
        </ul>
      </div>
      <button type="button" onClick={downloadDerivedProfiles} className="mt-4 rounded-full border border-black/10 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
        {dict.ui.dataCenterExportProfiles}
      </button>
      {legacyMigrationPending && <p role="status" className="mt-3 text-sm text-accent">{dict.ui.dataCenterMigrationPending}</p>}
    </section>
  );
}
