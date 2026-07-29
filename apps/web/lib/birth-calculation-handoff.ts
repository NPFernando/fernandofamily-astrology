import type { BirthChart, BirthNakshatraResponse, DasamsaChart, DashaTimeline, NavamsaChart, SaptamsaChart } from "@/lib/api-client";
import type { LocationValue } from "@/components/pancha-pakshi/LocationPicker";

export type BirthCalculationInput = { birthDate: string; birthTime: string; location: LocationValue };
export type BirthCalculationHandoff = {
  input: BirthCalculationInput;
  identity?: BirthNakshatraResponse;
  chart?: BirthChart;
  dasha?: DashaTimeline;
  divisional?: { navamsa: NavamsaChart; dasamsa: DasamsaChart; saptamsa: SaptamsaChart };
  savedAt: string;
};

const HANDOFF_KEY = "ff_birth_calculation_handoff";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function loadRaw(): BirthCalculationHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const handoff = JSON.parse(window.sessionStorage.getItem(HANDOFF_KEY) ?? "null") as BirthCalculationHandoff | null;
    if (!handoff || !handoff.input?.birthDate || !handoff.input?.birthTime || !handoff.input.location?.iana_tz) return null;
    if (Date.now() - Date.parse(handoff.savedAt) > MAX_AGE_MS) {
      window.sessionStorage.removeItem(HANDOFF_KEY);
      return null;
    }
    return handoff;
  } catch {
    return null;
  }
}

export function loadBirthCalculationHandoff() {
  return loadRaw();
}

/** Same-tab only: exact inputs and already-computed reports never enter a URL or server-side store. */
export function saveBirthCalculationHandoff(
  input: BirthCalculationInput,
  results: Pick<BirthCalculationHandoff, "identity" | "chart" | "dasha" | "divisional">,
) {
  if (typeof window === "undefined") return;
  const current = loadRaw();
  const sameInput = current && JSON.stringify(current.input) === JSON.stringify(input);
  const next: BirthCalculationHandoff = {
    input,
    ...(sameInput ? current : {}),
    ...results,
    savedAt: new Date().toISOString(),
  };
  window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(next));
}

export function clearBirthCalculationHandoff() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(HANDOFF_KEY);
}
