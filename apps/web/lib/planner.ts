"use client";

// Personal plan titles, notes, and family-group labels can be identifying.
// These structures are therefore stored only inside LocalVaultData, never in
// profile storage, URLs, or a server-side feedback record.
export type VaultPlan = {
  id: string;
  title: string;
  date: string;
  starts_at: string | null;
  ends_at: string | null;
  profile_ids: string[];
  notes: string;
  source: "manual" | "muhurta";
  created_at: string;
};

export type VaultFamilyGroup = {
  id: string;
  label: string;
  profile_ids: string[];
  created_at: string;
};

export function planSort(left: VaultPlan, right: VaultPlan): number {
  return (left.starts_at ?? "99:99").localeCompare(right.starts_at ?? "99:99") || left.title.localeCompare(right.title);
}
