"use client";

import type { IcsEvent } from "@/lib/ics";

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
  recurrence?: "yearly";
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

function localPlanDate(date: string, time: string | null): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time ?? "");
  if (!dateMatch || !timeMatch) return null;
  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const result = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return Number.isNaN(result.getTime()) ? null : result;
}

// The planner belongs to one local browser vault, so its manual times are
// interpreted in the calendar application's local device timezone at export.
// This deliberately avoids deriving or transmitting a location/timezone.
export function plansToIcsEvents(plans: VaultPlan[]): IcsEvent[] {
  return plans.flatMap((plan) => {
    const start = localPlanDate(plan.date, plan.starts_at);
    if (!start) return [];
    const proposedEnd = localPlanDate(plan.date, plan.ends_at);
    const end = proposedEnd && proposedEnd > start ? proposedEnd : new Date(start.getTime() + 60 * 60 * 1000);
    return [{
      uid: plan.id,
      start,
      end,
      summary: plan.title,
      description: plan.notes || undefined,
      recurrence: plan.recurrence === "yearly" ? "YEARLY" : undefined,
    }];
  });
}
