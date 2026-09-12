import type { LocationValue } from "@/components/pancha-pakshi/LocationPicker";

/** Full birth details are stored only in the encrypted local vault. */
export type PrivatePerson = {
  id: string;
  label: string;
  birth_date: string;
  birth_time: string;
  birthplace: LocationValue;
  current_location?: LocationValue;
  created_at: string;
  updated_at: string;
};

export function samePrivatePersonDetails(a: Pick<PrivatePerson, "label" | "birth_date" | "birth_time" | "birthplace">, b: Pick<PrivatePerson, "label" | "birth_date" | "birth_time" | "birthplace">): boolean {
  return a.label.trim() === b.label.trim() && a.birth_date === b.birth_date && a.birth_time === b.birth_time && a.birthplace.latitude === b.birthplace.latitude && a.birthplace.longitude === b.birthplace.longitude && a.birthplace.iana_tz === b.birthplace.iana_tz;
}
