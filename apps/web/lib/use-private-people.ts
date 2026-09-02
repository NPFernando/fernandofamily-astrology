"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalVault } from "@/components/LocalVaultProvider";
import type { LocationValue } from "@/components/pancha-pakshi/LocationPicker";
import { samePrivatePersonDetails, type PrivatePerson } from "@/lib/private-people";

const ACTIVE_PERSON_KEY = "ff_active_private_person_id";

function activeId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(ACTIVE_PERSON_KEY);
}

function setActiveId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.sessionStorage.setItem(ACTIVE_PERSON_KEY, id);
  else window.sessionStorage.removeItem(ACTIVE_PERSON_KEY);
}

export function usePrivatePeople() {
  const { data, unlocked, update } = useLocalVault();
  const [selectedId, setSelectedId] = useState<string | null>(() => activeId());
  const people = useMemo(() => data.privatePeople ?? [], [data.privatePeople]);
  const selected = useMemo(() => people.find((person) => person.id === selectedId) ?? null, [people, selectedId]);

  useEffect(() => {
    if (selectedId && people.some((person) => person.id === selectedId)) return;
    const next = people[0]?.id ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize the tab-scoped selection with encrypted vault contents.
    setSelectedId(next);
    setActiveId(next);
  }, [people, selectedId]);

  const selectPerson = useCallback((id: string | null) => {
    setSelectedId(id);
    setActiveId(id);
  }, []);

  const savePerson = useCallback(async (input: Omit<PrivatePerson, "id" | "created_at" | "updated_at">, id?: string) => {
    if (!unlocked) throw new Error("Unlock the private data vault before saving.");
    const now = new Date().toISOString();
    let savedId = id;
    await update((current) => {
      const existing = current.privatePeople ?? [];
      savedId ??= crypto.randomUUID();
      const duplicate = existing.find((person) => !id && samePrivatePersonDetails(person, input));
      if (duplicate) {
        savedId = duplicate.id;
        return current;
      }
      const next: PrivatePerson = { ...input, id: savedId, created_at: existing.find((person) => person.id === savedId)?.created_at ?? now, updated_at: now };
      return { ...current, privatePeople: existing.some((person) => person.id === savedId) ? existing.map((person) => person.id === savedId ? next : person) : [...existing, next] };
    });
    selectPerson(savedId!);
    return savedId!;
  }, [selectPerson, unlocked, update]);

  const removePerson = useCallback(async (id: string) => {
    if (!unlocked) return;
    await update((current) => ({ ...current, privatePeople: (current.privatePeople ?? []).filter((person) => person.id !== id) }));
    if (selectedId === id) selectPerson(null);
  }, [selectPerson, selectedId, unlocked, update]);

  return { people, person: selected, selectedId, unlocked, selectPerson, savePerson, removePerson };
}

export type PrivatePersonDraft = Pick<PrivatePerson, "label" | "birth_date" | "birth_time" | "birthplace"> & { current_location?: LocationValue };
