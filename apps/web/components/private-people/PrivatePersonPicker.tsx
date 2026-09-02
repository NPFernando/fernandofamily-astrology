"use client";

import type { PrivatePerson } from "@/lib/private-people";
import { useLocale } from "@/lib/locale-context";

export function PrivatePersonPicker({ people, selectedId, unlocked, onSelect, onDelete }: { people: PrivatePerson[]; selectedId: string | null; unlocked: boolean; onSelect: (id: string | null) => void; onDelete?: (id: string) => void }) {
  const { dict } = useLocale();
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="private-person-picker">
      <label className="text-sm font-medium" htmlFor="private-person-select">Person</label>
      <select id="private-person-select" value={selectedId ?? ""} onChange={(event) => onSelect(event.target.value || null)} disabled={!unlocked || people.length === 0} className="min-w-44 rounded-lg border border-black/15 bg-white/70 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/[.06]">
        <option value="">{dict.ui.temporaryDetails}</option>
        {people.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
      </select>
      {selectedId && onDelete && <button type="button" onClick={() => onDelete(selectedId)} className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-700 dark:text-red-300">Remove</button>}
      {!unlocked && <span className="text-xs opacity-60">{dict.ui.unlockToReusePeople}</span>}
    </div>
  );
}
