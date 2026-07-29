"use client";

import { useEffect, useState } from "react";

function count(key: string) { try { const value = JSON.parse(window.localStorage.getItem(key) ?? "[]"); return Array.isArray(value) ? value.length : 0; } catch { return 0; } }

export function LocalDataSummary({ labels }: { labels: { reports: string; profiles: string; recentBirthDetails: string } }) {
  const [summary, setSummary] = useState<{ reports: number; profiles: number; recentBirthDetails: number } | null>(null);
  useEffect(() => setSummary({ reports: count("ff_saved_reports"), profiles: count("ff_saved_profiles"), recentBirthDetails: count("ff_recent_birth_details") }), []);
  if (!summary) return null;
  return <dl className="mt-4 grid gap-2 rounded-xl border border-black/10 p-4 text-sm sm:grid-cols-3 dark:border-white/10"><div><dt className="opacity-70">{labels.reports}</dt><dd className="mt-1 text-lg font-semibold">{summary.reports}</dd></div><div><dt className="opacity-70">{labels.profiles}</dt><dd className="mt-1 text-lg font-semibold">{summary.profiles}</dd></div><div><dt className="opacity-70">{labels.recentBirthDetails}</dt><dd className="mt-1 text-lg font-semibold">{summary.recentBirthDetails}</dd></div></dl>;
}
