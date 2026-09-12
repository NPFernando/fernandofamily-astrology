"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalVault } from "@/components/LocalVaultProvider";
import { listLocalProfiles } from "@/lib/profiles";
import { useLocale } from "@/lib/locale-context";
import { usePrivatePeople } from "@/lib/use-private-people";
import { DEFAULT_LOCATION, LocationPicker, type LocationValue } from "@/components/pancha-pakshi/LocationPicker";
import type { PrivatePerson } from "@/lib/private-people";

// This is deliberately an inventory, not a second store. It gives a person
// evidence of what is currently encrypted in this browser without rendering
// their birth values, precise locations, or profile identities into the DOM.
export function PrivacyDataCenter() {
  const { dict } = useLocale();
  const { data, ready, unlocked, hasEncryptedData, legacyMigrationPending } = useLocalVault();
  const privatePeople = usePrivatePeople();
  const localProfileCount = useMemo(() => listLocalProfiles().length, []);
  const [device, setDevice] = useState({ online: false, serviceWorkerReady: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<PrivatePerson, "id" | "created_at" | "updated_at"> | null>(null);

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

  function beginEdit(person?: PrivatePerson) {
    setEditingId(person?.id ?? null);
    setDraft(person ? { label: person.label, birth_date: person.birth_date, birth_time: person.birth_time, birthplace: person.birthplace, current_location: person.current_location } : { label: "", birth_date: "", birth_time: "", birthplace: DEFAULT_LOCATION });
  }

  async function savePerson() {
    if (!draft?.label.trim() || !draft.birth_date || !draft.birth_time || !draft.birthplace.name) return;
    await privatePeople.savePerson({ ...draft, label: draft.label.trim() }, editingId ?? undefined);
    setDraft(null);
    setEditingId(null);
  }

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
      <section id="private-people-manager" className="mt-6 rounded-lg border border-black/10 p-3 dark:border-white/10" data-testid="private-people-manager">
        <div className="flex items-center justify-between gap-2">
          <div><h3 className="font-semibold">{dict.ui.privatePeopleTitle}</h3><p className="mt-1 text-xs opacity-70">{dict.ui.privatePeopleBody}</p></div>
          {unlocked && <button type="button" onClick={() => beginEdit()} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">{dict.ui.addPrivatePerson}</button>}
        </div>
        {!unlocked ? <p className="mt-3 text-xs opacity-70">{dict.ui.unlockToManagePeople}</p> : (
          <div className="mt-3 grid gap-2">
            {privatePeople.people.map((person) => <div key={person.id} className="flex items-center justify-between gap-2 rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10"><span>{person.label}</span><span className="flex gap-2"><button type="button" onClick={() => beginEdit(person)} className="text-accent underline">{dict.ui.editPrivatePerson}</button><button type="button" onClick={() => void privatePeople.removePerson(person.id)} className="text-red-700 underline dark:text-red-300">{dict.ui.deletePrivatePerson}</button></span></div>)}
            {privatePeople.people.length === 0 && <p className="text-xs opacity-70">{dict.ui.noPrivatePeople}</p>}
          </div>
        )}
        {draft && unlocked && <div className="mt-4 grid gap-3 border-t border-black/10 pt-3 dark:border-white/10">
          <input aria-label={dict.ui.personName} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder={dict.ui.personName} className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20" />
          <div className="grid gap-2 sm:grid-cols-2"><input aria-label={dict.ui.birthDate} type="date" value={draft.birth_date} onChange={(e) => setDraft({ ...draft, birth_date: e.target.value })} className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20" /><input aria-label={dict.ui.birthTime} type="time" value={draft.birth_time.slice(0, 5)} onChange={(e) => setDraft({ ...draft, birth_time: e.target.value })} className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20" /></div>
          <div><p className="mb-1 text-xs font-medium opacity-70">{dict.ui.birthplace}</p><LocationPicker value={draft.birthplace as LocationValue} onChange={(location) => setDraft({ ...draft, birthplace: location })} /></div>
          <div><div className="mb-1 flex items-center justify-between"><p className="text-xs font-medium opacity-70">{dict.ui.currentLocation}</p>{draft.current_location && <button type="button" onClick={() => setDraft({ ...draft, current_location: undefined })} className="text-xs text-accent underline">{dict.ui.clearSavedLocations}</button>}</div><LocationPicker value={draft.current_location ?? null} onChange={(location) => setDraft({ ...draft, current_location: location })} /></div>
          <div className="flex gap-2"><button type="button" onClick={() => void savePerson()} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">{dict.ui.saveChanges}</button><button type="button" onClick={() => { setDraft(null); setEditingId(null); }} className="rounded-lg border border-black/15 px-3 py-1.5 text-xs dark:border-white/20">{dict.ui.cancel}</button></div>
        </div>}
      </section>
    </section>
  );
}
