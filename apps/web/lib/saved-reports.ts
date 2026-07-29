import type { BirthCalculationHandoff } from "@/lib/birth-calculation-handoff";

const STORAGE_KEY = "ff_saved_reports";
const MAX_REPORTS = 20;

export type SavedReport = {
  id: string;
  label: string;
  createdAt: string;
  lastOpenedAt?: string;
  reportPath: string;
  handoff: BirthCalculationHandoff;
  favorite?: boolean;
  tags?: string[];
};

function normalize(record: SavedReport): SavedReport {
  return { ...record, favorite: Boolean(record.favorite), tags: Array.isArray(record.tags) ? record.tags.filter((tag) => typeof tag === "string").slice(0, 6) : [] };
}

export function listSavedReports(): SavedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const records = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as SavedReport[];
    return Array.isArray(records) ? records.filter((record) => record?.id && record?.handoff?.input).map(normalize).sort((a, b) => Date.parse(b.lastOpenedAt ?? b.createdAt) - Date.parse(a.lastOpenedAt ?? a.createdAt)).slice(0, MAX_REPORTS) : [];
  } catch { return []; }
}

export function saveReport(label: string, handoff: BirthCalculationHandoff, reportPath = "/ashtakavarga") {
  if (typeof window === "undefined") return;
  const records = listSavedReports(); const existing = records.find((record) => record.reportPath === reportPath && JSON.stringify(record.handoff.input) === JSON.stringify(handoff.input));
  if (existing) { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.map((record) => record.id === existing.id ? { ...record, lastOpenedAt: new Date().toISOString() } : record))); return; }
  const record: SavedReport = { id: crypto.randomUUID(), label: label.trim() || "Saved report", createdAt: new Date().toISOString(), lastOpenedAt: new Date().toISOString(), reportPath, handoff };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...records].slice(0, MAX_REPORTS)));
}

export function deleteSavedReport(id: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listSavedReports().filter((record) => record.id !== id)));
}

export function renameSavedReport(id: string, label: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listSavedReports().map((record) => record.id === id ? { ...record, label: label.trim() || record.label } : record)));
}

export function updateSavedReport(id: string, update: Pick<SavedReport, "favorite" | "tags">) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listSavedReports().map((record) => record.id === id ? normalize({ ...record, ...update }) : record)));
}

export function restoreSavedReport(id: string) {
  const record = listSavedReports().find((entry) => entry.id === id);
  if (record && typeof window !== "undefined") { window.sessionStorage.setItem("ff_birth_calculation_handoff", JSON.stringify({ ...record.handoff, savedAt: new Date().toISOString() })); window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listSavedReports().map((entry) => entry.id === id ? { ...entry, lastOpenedAt: new Date().toISOString() } : entry))); }
  return record ?? null;
}
