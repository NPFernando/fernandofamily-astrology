"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { PUBLIC_REPOSITORY_URL } from "@/lib/site-config";

const VOTES_KEY = "ff_roadmap_votes_v1";

type ItemId = "readiness" | "planner" | "groups" | "agenda" | "changes" | "alerts" | "commands" | "icons";

function loadVotes(): Record<string, number> {
  try { return JSON.parse(window.localStorage.getItem(VOTES_KEY) ?? "{}"); } catch { return {}; }
}

export function RoadmapFeedbackClient() {
  const { dict } = useLocale();
  const [votes, setVotes] = useState<Record<string, number>>(() => typeof window === "undefined" ? {} : loadVotes());
  const [selected, setSelected] = useState<ItemId>("planner");
  const [feedback, setFeedback] = useState("");
  const items = useMemo(() => [
    ["readiness", dict.roadmap.readiness, "released"],
    ["planner", dict.roadmap.planner, "released"],
    ["groups", dict.roadmap.groups, "released"],
    ["agenda", dict.roadmap.agenda, "released"],
    ["changes", dict.roadmap.changes, "released"],
    ["alerts", dict.roadmap.alerts, "released"],
    ["commands", dict.roadmap.commands, "released"],
    ["icons", dict.roadmap.icons, "released"],
  ] as const, [dict]);

  function vote(id: ItemId) {
    setVotes((current) => { const next = { ...current, [id]: (current[id] ?? 0) + 1 }; window.localStorage.setItem(VOTES_KEY, JSON.stringify(next)); return next; });
  }
  const draft = `${dict.roadmap.feedbackSubject}: ${items.find(([id]) => id === selected)?.[1]}\n\n${feedback.trim()}`;
  const issueHref = `${PUBLIC_REPOSITORY_URL}/issues/new?title=${encodeURIComponent(`${dict.roadmap.feedbackSubject}: ${items.find(([id]) => id === selected)?.[1]}`)}&body=${encodeURIComponent(draft)}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-bold">{dict.roadmap.title}</h1>
        <p className="mt-2 leading-relaxed opacity-80">{dict.roadmap.body}</p>
        <p className="mt-2 text-xs opacity-70">{dict.roadmap.localVoteNote}</p>
      </header>
      <section data-testid="roadmap-items" className="grid gap-3 md:grid-cols-2">
        {items.map(([id, label, status]) => (
          <article key={id} className="rounded-xl border border-black/10 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[.03]">
            <div className="flex items-start justify-between gap-3"><p className="font-semibold">{label}</p><span className="rounded-full border border-black/10 px-2 py-1 text-xs dark:border-white/20">{dict.roadmap[status]}</span></div>
            <button type="button" onClick={() => vote(id)} className="mt-4 rounded-lg border border-accent/40 px-3 py-1.5 text-sm font-semibold text-accent">{dict.roadmap.vote} · {votes[id] ?? 0}</button>
          </article>
        ))}
      </section>
      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">{dict.roadmap.feedbackTitle}</h2>
        <p className="mt-1 text-sm opacity-80">{dict.roadmap.feedbackBody}</p>
        <label className="mt-4 block text-sm font-medium">{dict.roadmap.feedbackFor}<select value={selected} onChange={(event) => setSelected(event.target.value as ItemId)} className="mt-1 block w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20">{items.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="mt-3 block text-sm font-medium">{dict.roadmap.feedbackLabel}<textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20" /></label>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(draft); }} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold dark:border-white/20">{dict.roadmap.copyFeedback}</button>
          <a href={issueHref} target="_blank" rel="noreferrer" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">{dict.roadmap.openIssue}</a>
        </div>
      </section>
    </div>
  );
}
