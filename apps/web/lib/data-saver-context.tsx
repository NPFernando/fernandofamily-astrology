"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ff_low_data";
const IMAGE_PREFERENCE_KEY = "ff_always_show_images";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type DataSaverContextValue = {
  lowData: boolean;
  alwaysShowImages: boolean;
  toggleLowData: () => boolean;
  toggleAlwaysShowImages: () => boolean;
};
const DataSaverContext = createContext<DataSaverContextValue | null>(null);

function detectLowData() {
  if (typeof window === "undefined") return false;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved !== null) return saved === "1";
  const connection = navigator as Navigator & { connection?: { saveData?: boolean } };
  return connection.connection?.saveData === true;
}

function detectAlwaysShowImages() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(IMAGE_PREFERENCE_KEY) === "1";
}

function persist(lowData: boolean) {
  const value = lowData ? "1" : "0";
  window.localStorage.setItem(STORAGE_KEY, value);
  document.cookie = `${STORAGE_KEY}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function DataSaverProvider({ children }: { children: React.ReactNode }) {
  const [lowData, setLowData] = useState(detectLowData);
  const [alwaysShowImages, setAlwaysShowImages] = useState(detectAlwaysShowImages);

  useEffect(() => {
    document.documentElement.dataset.lowData = String(lowData);
    persist(lowData);
  }, [lowData]);

  const toggleLowData = useCallback(() => {
    const next = !lowData;
    setLowData(next);
    persist(next);
    return next;
  }, [lowData]);

  const toggleAlwaysShowImages = useCallback(() => {
    const next = !alwaysShowImages;
    setAlwaysShowImages(next);
    window.localStorage.setItem(IMAGE_PREFERENCE_KEY, next ? "1" : "0");
    return next;
  }, [alwaysShowImages]);

  const value = useMemo(
    () => ({ lowData, alwaysShowImages, toggleLowData, toggleAlwaysShowImages }),
    [alwaysShowImages, lowData, toggleAlwaysShowImages, toggleLowData],
  );
  return <DataSaverContext.Provider value={value}>{children}</DataSaverContext.Provider>;
}

export function useDataSaver() {
  const context = useContext(DataSaverContext);
  if (!context) throw new Error("useDataSaver must be used within a DataSaverProvider");
  return context;
}
