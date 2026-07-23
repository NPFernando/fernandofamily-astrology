"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/locale-context";

export type LocationValue = {
  name: string;
  latitude: number;
  longitude: number;
  iana_tz: string;
};

const RECENT_LOCATIONS_KEY = "ff_recent_locations";
const MAX_RECENT = 5;

function loadRecent(): LocationValue[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_LOCATIONS_KEY);
    return raw ? (JSON.parse(raw) as LocationValue[]) : [];
  } catch {
    return [];
  }
}

// Only name/lat/lon/tz are ever persisted here — never birth date/time.
function saveRecent(loc: LocationValue) {
  const existing = loadRecent().filter(
    (l) => !(l.latitude === loc.latitude && l.longitude === loc.longitude),
  );
  const next = [loc, ...existing].slice(0, MAX_RECENT);
  window.localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(next));
  return next;
}

export function clearRecentLocations() {
  window.localStorage.removeItem(RECENT_LOCATIONS_KEY);
}

// The platform's configured default (Colombo) — used when something needs a
// location before the user has picked one, e.g. scheduling from a saved
// profile chip on a fresh device.
export const DEFAULT_LOCATION: LocationValue = {
  name: "Colombo, Sri Lanka",
  latitude: 6.9271,
  longitude: 79.8612,
  iana_tz: "Asia/Colombo",
};

// Original 6 (Colombo..Galle) were hand-picked for cultural/religious
// significance to a Sri Lankan astrology audience, not just city size —
// kept as-is. The rest (2026-07-23) fill out district/province coverage,
// sourced from the HDX/OpenStreetMap "Sri Lanka Populated Places" export
// (place=city/town, ranked by OSM population tag; ODbL-licensed — see the
// attribution line rendered below this list) rather than picked from
// memory, since a wrong lat/lon here would silently mis-locate a chart.
const SRI_LANKA_LOCATIONS = [
  { en: "Colombo", si: "කොළඹ", latitude: 6.9271, longitude: 79.8612 },
  { en: "Kandy", si: "මහනුවර", latitude: 7.2906, longitude: 80.6337 },
  { en: "Anuradhapura", si: "අනුරාධපුර", latitude: 8.3114, longitude: 80.4037 },
  { en: "Kelaniya", si: "කැලණිය", latitude: 6.9553, longitude: 79.922 },
  { en: "Kataragama", si: "කතරගම", latitude: 6.4134, longitude: 81.3346 },
  { en: "Galle", si: "ගාල්ල", latitude: 6.0535, longitude: 80.221 },
  { en: "Jaffna", si: "යාපනය", latitude: 9.665093, longitude: 80.0093029 },
  { en: "Negombo", si: "මීගමුව", latitude: 7.2094282, longitude: 79.833117 },
  { en: "Trincomalee", si: "තිරිකුණාමළය", latitude: 8.576425, longitude: 81.2344952 },
  { en: "Batticaloa", si: "මඩකලපුව", latitude: 7.7356027, longitude: 81.6941956 },
  { en: "Kurunegala", si: "කුරුණෑගල", latitude: 7.4870464, longitude: 80.364908 },
  { en: "Ratnapura", si: "රත්නපුර", latitude: 6.6803691, longitude: 80.4022975 },
  { en: "Badulla", si: "බදුල්ල", latitude: 6.9900353, longitude: 81.0570315 },
  { en: "Nuwara Eliya", si: "නුවරඑළිය", latitude: 6.9739741, longitude: 80.7669855 },
  { en: "Matara", si: "මාතර", latitude: 5.947822, longitude: 80.5482919 },
  { en: "Polonnaruwa", si: "පොළොන්නරුව", latitude: 7.9395357, longitude: 81.0003387 },
  { en: "Puttalam", si: "පුත්තලම", latitude: 8.030245, longitude: 79.8286545 },
  { en: "Vavuniya", si: "වවුනියාව", latitude: 8.7593517, longitude: 80.5000778 },
  { en: "Matale", si: "මාතලේ", latitude: 7.4720453, longitude: 80.6234307 },
  { en: "Hambantota", si: "හම්බන්තොට", latitude: 6.1249126, longitude: 81.1242563 },
  { en: "Ampara", si: "අම්පාර", latitude: 7.2978118, longitude: 81.6790194 },
  { en: "Monaragala", si: "මොනරාගල", latitude: 6.8725497, longitude: 81.3507069 },
  { en: "Kalutara", si: "කළුතර", latitude: 6.5852614, longitude: 79.963301 },
  { en: "Mannar", si: "මන්නාරම", latitude: 8.9812896, longitude: 79.9043942 },
  { en: "Kilinochchi", si: "කිළිනොච්චි", latitude: 9.3840068, longitude: 80.4087224 },
] as const;

export function mostRecentLocation(): LocationValue | null {
  return loadRecent()[0] ?? null;
}

type Tab = "device" | "search" | "manual";

type SearchResult = {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country?: string;
  countryCode?: string;
  admin1?: string;
};

export function LocationPicker({
  value,
  onChange,
}: {
  value: LocationValue | null;
  onChange: (loc: LocationValue) => void;
}) {
  const { dict, locale } = useLocale();
  const [tab, setTab] = useState<Tab>("device");
  // Whenever a location is already known (seeded from the last-used one, or
  // already picked), show a compact one-line summary instead of the full
  // tabbed picker — the confirmation used to be a single small line at the
  // very bottom of the whole picker, below every tab/form/chip, so it was
  // easy to miss and the picker felt heavy even when nothing needed to
  // change. Starts false so a genuinely first-time visitor (value === null)
  // still sees the full picker immediately.
  const [editing, setEditing] = useState(false);
  const [recent, setRecent] = useState<LocationValue[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [manualTz, setManualTz] = useState("");
  const searchDebounceRef = useRef<number | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
      searchAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    // Deliberately deferred to an effect rather than a lazy useState
    // initializer: this component renders during SSR too (client component,
    // still gets an initial server-rendered pass), where localStorage doesn't
    // exist. Reading it during the lazy initializer would return different
    // recent-location lists on the server vs. the client's first render,
    // causing a hydration mismatch — loading it post-mount instead keeps the
    // first client render identical to the server's ([]) and only updates
    // afterward.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(loadRecent());
  }, []);

  function commit(loc: LocationValue) {
    onChange(loc);
    setRecent(saveRecent(loc));
    setStatus(null);
    setEditing(false);
  }

  // Resolves device coordinates to a human-readable place name via
  // OpenStreetMap's Nominatim reverse-geocoding API (free, no key). Only
  // called after the user explicitly clicks "Use my location" — never on
  // mount — and only sends the coordinates the browser already asked
  // permission for; falls back to the generic "Current location" label on
  // any failure/timeout so this is purely a display-quality enhancement,
  // never a blocker.
  async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
        { headers: { Accept: "application/json" }, signal: controller.signal },
      );
      if (!res.ok) return null;
      const data = await res.json();
      const addr = data.address ?? {};
      const place: string | undefined =
        addr.city ?? addr.town ?? addr.village ?? addr.county ?? addr.suburb ?? addr.state_district;
      const region: string | undefined = addr.state ?? addr.country;
      if (place && region && place !== region) return `${place}, ${region}`;
      if (place) return place;
      if (typeof data.display_name === "string") {
        return data.display_name.split(",").slice(0, 2).join(",").trim();
      }
      return null;
    } catch {
      return null; // aborted/offline/parse failure — caller falls back
    } finally {
      window.clearTimeout(timeout);
    }
  }

  // Only triggered by an explicit click — never auto-requested on mount.
  function useDeviceLocation() {
    if (!("geolocation" in navigator)) {
      setStatus(dict.ui.locationUnavailable);
      return;
    }
    setStatus(dict.ui.detectingLocation);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let tz: string;
        try {
          // Lazy-loaded: tz-lookup's embedded geo-timezone dataset (~84KB)
          // would otherwise ship in every calculator page's initial JS even
          // though it's only needed on this explicit device-location click.
          const { default: tzlookup } = await import("tz-lookup");
          tz = tzlookup(latitude, longitude);
        } catch {
          tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
        const resolvedName = await reverseGeocode(latitude, longitude);
        commit({ name: resolvedName ?? dict.ui.currentLocation, latitude, longitude, iana_tz: tz });
      },
      (err) => {
        setStatus(
          err.code === err.PERMISSION_DENIED
            ? dict.ui.locationPermissionDenied
            : dict.ui.locationUnavailable,
        );
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  function runSearch(term: string) {
    setSearchTerm(term);
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    if (term.trim().length < 2) {
      searchAbortRef.current?.abort();
      setResults([]);
      setSearching(false);
      return;
    }
    // Debounce + abort: without these, every keystroke fired its own fetch
    // ("Colombo" = 7 requests, rate-limit fodder) and a slow earlier response
    // could resolve after a faster later one, overwriting fresher results.
    searchDebounceRef.current = window.setTimeout(() => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setSearching(true);
      fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=6&language=en`,
        { signal: controller.signal },
      )
        .then((res) => res.json())
        .then((data) => {
          if (controller.signal.aborted) return;
          type OpenMeteoResult = {
            name: string;
            latitude: number;
            longitude: number;
            timezone: string;
            country?: string;
            country_code?: string;
            admin1?: string;
          };
          const mapped: SearchResult[] = (data.results ?? []).map((r: OpenMeteoResult) => ({
            name: r.name,
            latitude: r.latitude,
            longitude: r.longitude,
            timezone: r.timezone,
            country: r.country,
            countryCode: r.country_code,
            admin1: r.admin1,
          }));
          // Open-Meteo's global geocoder returns results in its own relevance
          // order, which can rank a same-named place in another country
          // above the intended Sri Lankan one (e.g. "Matara" -> Indonesia's
          // "Mataram" ranked first, ahead of Matara, Sri Lanka) -- confirmed
          // directly against the live API, not assumed. A stable sort that
          // moves Sri Lankan matches to the front (without dropping other
          // countries, since this platform also supports birth locations
          // abroad via manual entry) fixes the mis-ranking without losing
          // any results.
          const prioritized = [...mapped].sort(
            (a, b) => Number(b.countryCode === "LK") - Number(a.countryCode === "LK"),
          );
          setResults(prioritized);
          setSearching(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return; // superseded, not an error
          setResults([]);
          setSearching(false);
        });
    }, 300);
  }

  function submitManual() {
    const lat = Number(manualLat);
    const lon = Number(manualLon);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setStatus(dict.ui.error);
      return;
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      setStatus(dict.ui.error);
      return;
    }
    const tz = manualTz.trim();
    if (!tz) {
      setStatus(dict.ui.error);
      return;
    }
    // Validate by construction, not by list membership:
    // Intl.supportedValuesOf("timeZone") returns CLDR-canonical IDs, which
    // still use legacy names for some zones (e.g. "Asia/Calcutta") — so the
    // modern IANA name "Asia/Kolkata" (what geocoders and tz-lookup return)
    // would be wrongly rejected. DateTimeFormat accepts every valid IANA
    // name/alias and throws RangeError for genuinely invalid input.
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: tz });
    } catch {
      setStatus(dict.ui.error);
      return;
    }
    commit({ name: `${manualLat}, ${manualLon}`, latitude: lat, longitude: lon, iana_tz: tz });
  }

  if (value && !editing) {
    return (
      <div
        data-testid="active-location"
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/20"
      >
        <span className="opacity-80">
          {value.name} · {value.latitude.toFixed(2)}, {value.longitude.toFixed(2)} · {value.iana_tz}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 text-xs font-medium text-accent underline underline-offset-2"
        >
          {dict.ui.changeLocation}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label={dict.ui.location} className="flex flex-wrap gap-2 text-sm">
        <TabButton active={tab === "device"} onClick={() => setTab("device")}>
          {dict.ui.useMyLocation}
        </TabButton>
        <TabButton active={tab === "search"} onClick={() => setTab("search")}>
          {dict.ui.searchPlace}
        </TabButton>
        <TabButton active={tab === "manual"} onClick={() => setTab("manual")}>
          {dict.ui.manualEntry}
        </TabButton>
      </div>

      {tab === "device" && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={useDeviceLocation}
            className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            {dict.ui.useMyLocation}
          </button>
          {status && <p className="text-sm opacity-80">{status}</p>}
        </div>
      )}

      {tab === "search" && (
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="location-search-input">
            {dict.ui.searchPlace}
          </label>
          <input
            id="location-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => runSearch(e.target.value)}
            placeholder={dict.ui.searchPlace}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
          {searching && <p className="text-sm opacity-70">{dict.ui.loading}</p>}
          {!searching && searchTerm.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm opacity-70">{dict.ui.noResults}</p>
          )}
          <ul className="flex flex-col gap-1">
            {results.map((r) => (
              <li key={`${r.name}-${r.latitude}-${r.longitude}`}>
                <button
                  type="button"
                  onClick={() =>
                    commit({
                      name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
                      latitude: r.latitude,
                      longitude: r.longitude,
                      iana_tz: r.timezone,
                    })
                  }
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-left text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                >
                  {[r.name, r.admin1, r.country].filter(Boolean).join(", ")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "manual" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="location-manual-lat">
            {dict.ui.latitude}
          </label>
          <input
            id="location-manual-lat"
            type="number"
            step="any"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            placeholder={dict.ui.latitude}
            aria-describedby={status ? "location-manual-status" : undefined}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
          <label className="sr-only" htmlFor="location-manual-lon">
            {dict.ui.longitude}
          </label>
          <input
            id="location-manual-lon"
            type="number"
            step="any"
            value={manualLon}
            onChange={(e) => setManualLon(e.target.value)}
            placeholder={dict.ui.longitude}
            aria-describedby={status ? "location-manual-status" : undefined}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
          <label className="sr-only" htmlFor="location-manual-tz">
            {dict.ui.timezone}
          </label>
          <input
            id="location-manual-tz"
            type="text"
            value={manualTz}
            onChange={(e) => setManualTz(e.target.value)}
            placeholder={dict.ui.timezone}
            aria-describedby={status ? "location-manual-status" : undefined}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
          <button
            type="button"
            onClick={submitManual}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            {dict.ui.confirm}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase opacity-70">{dict.ui.sriLankaLocations}</span>
        <div className="flex flex-wrap gap-2" data-testid="sri-lanka-location-picks">
          {SRI_LANKA_LOCATIONS.map((loc) => {
            const label = locale === "si" ? loc.si : loc.en;
            return (
              <button
                key={loc.en}
                type="button"
                onClick={() =>
                  commit({
                    name: `${label}, ${dict.ui.countrySriLanka}`,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    iana_tz: "Asia/Colombo",
                  })
                }
                className="rounded-full border border-amber-600/30 bg-amber-500/10 px-3 py-1 text-xs hover:border-accent dark:border-amber-400/30"
              >
                {label}
              </button>
            );
          })}
        </div>
        <span className="text-[0.65rem] opacity-50">{dict.ui.sriLankaLocationsAttribution}</span>
      </div>

      {status && tab !== "device" && (
        <p id="location-manual-status" role="alert" className="text-sm text-red-600 dark:text-red-400">
          {status}
        </p>
      )}

      {recent.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase opacity-70">{dict.ui.recentLocations}</span>
            <button
              type="button"
              onClick={() => {
                clearRecentLocations();
                setRecent([]);
              }}
              className="text-xs underline opacity-70 hover:opacity-100"
            >
              {dict.ui.clearSavedLocations}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((loc) => (
              <button
                key={`${loc.latitude}-${loc.longitude}`}
                type="button"
                onClick={() => commit(loc)}
                className="rounded-full border border-black/10 px-3 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 ${
        active
          ? "border-accent bg-accent/10 font-semibold text-accent"
          : "border-black/10 opacity-70 hover:opacity-100 dark:border-white/20"
      }`}
    >
      {children}
    </button>
  );
}
