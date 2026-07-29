import type { BirthCalculationHandoff } from "@/lib/birth-calculation-handoff";

const STORAGE_KEY = "ff_saved_reports";
const MAX_REPORTS = 20;

export type SavedReport = {
  id: string;
  label: string;
  createdAt: string;
  reportPath: string;
  handoff: BirthCalculationHandoff;
};

export function listSavedReports(): SavedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const records = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as SavedReport[];
    return Array.isArray(records) ? records.filter((record) => record?.id && record?.handoff?.input).slice(0, MAX_REPORTS) : [];
  } catch { return []; }
}

export function saveReport(label: string, handoff: BirthCalculationHandoff, reportPath = "/ashtakavarga") {
  if (typeof window === "undefined") return;
  const record: SavedReport = { id: crypto.randomUUID(), label: label.trim() || "Saved report", createdAt: new Date().toISOString(), reportPath, handoff };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...listSavedReports()].slice(0, MAX_REPORTS)));
}

export function deleteSavedReport(id: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listSavedReports().filter((record) => record.id !== id)));
}

export function renameSavedReport(id: string, label: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listSavedReports().map((record) => record.id === id ? { ...record, label: label.trim() || record.label } : record)));
}

export function restoreSavedReport(id: string) {
  const record = listSavedReports().find((entry) => entry.id === id);
  if (record && typeof window !== "undefined") window.sessionStorage.setItem("ff_birth_calculation_handoff", JSON.stringify({ ...record.handoff, savedAt: new Date().toISOString() }));
  return record ?? null;
}
