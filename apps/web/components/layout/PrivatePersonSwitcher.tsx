"use client";

import { usePrivatePeople } from "@/lib/use-private-people";
import { useLocale } from "@/lib/locale-context";

export function PrivatePersonSwitcher() {
  const { people, selectedId, unlocked, selectPerson } = usePrivatePeople();
  const { dict } = useLocale();
  if (!unlocked) return null;
  return (
    <label className="flex items-center gap-1.5 text-xs" title={dict.ui.activePrivatePerson}>
      <span className="sr-only">{dict.ui.activePrivatePerson}</span>
      <select data-testid="global-private-person-switcher" value={selectedId ?? ""} onChange={(event) => selectPerson(event.target.value || null)} className="max-w-32 rounded-lg border border-accent/30 bg-transparent px-2 py-1 text-xs font-medium text-accent">
        <option value="">{dict.ui.temporaryDetails}</option>
        {people.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
      </select>
    </label>
  );
}
