"use client";

import { type MouseEvent, useMemo, useRef, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { PUBLIC_REPOSITORY_URL } from "@/lib/site-config";

const VOTES_KEY = "ff_roadmap_votes_v1";
const SENSITIVE_FEEDBACK_PATTERNS = [
  /\b(?:passphrase|password|api[\s_-]?key|private[\s_-]?key|access[\s_-]?token|bearer\s+token)\s*[:=]/i,
  /\b(?:birth\s*(?:date|time|details)|date\s+of\s+birth)\s*[:=]/i,
  /\b-?\d{1,2}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}\b/,
];

type ItemId = "readiness" | "planner" | "groups" | "agenda" | "changes" | "alerts" | "commands" | "icons" | "week" | "calendar";
type Status = "released" | "inProgress" | "planned";
type CopyState = "idle" | "copied" | "error";

type RoadmapItem = {
  id: ItemId;
  label: string;
  category: string;
  status: Status;
};

function loadVotes(): Record<string, 1> {
  try {
    const stored = JSON.parse(window.localStorage.getItem(VOTES_KEY) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(stored).filter(([, value]) => typeof value === "number" && value > 0).map(([id]) => [id, 1]));
  } catch {
    return {};
  }
}

function containsSensitiveFeedback(value: string) {
  return SENSITIVE_FEEDBACK_PATTERNS.some((pattern) => pattern.test(value));
}

export function RoadmapFeedbackClient() {
  const { dict } = useLocale();
  const [votes, setVotes] = useState<Record<string, 1>>(() => typeof window === "undefined" ? {} : loadVotes());
  const [selected, setSelected] = useState<ItemId>("planner");
  const [feedbackByItem, setFeedbackByItem] = useState<Partial<Record<ItemId, string>>>({});
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [votesCleared, setVotesCleared] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const feedbackSelectRef = useRef<HTMLSelectElement>(null);
  const items = useMemo<RoadmapItem[]>(() => [
    { id: "readiness", label: dict.roadmap.readiness, category: dict.roadmap.categoryReliability, status: "released" },
    { id: "planner", label: dict.roadmap.planner, category: dict.roadmap.categoryPrivacy, status: "released" },
    { id: "groups", label: dict.roadmap.groups, category: dict.roadmap.categoryPrivacy, status: "released" },
    { id: "agenda", label: dict.roadmap.agenda, category: dict.roadmap.categoryPlanning, status: "released" },
    { id: "changes", label: dict.roadmap.changes, category: dict.roadmap.categoryPlanning, status: "released" },
    { id: "alerts", label: dict.roadmap.alerts, category: dict.roadmap.categoryReliability, status: "released" },
    { id: "commands", label: dict.roadmap.commands, category: dict.roadmap.categoryExperience, status: "released" },
    { id: "icons", label: dict.roadmap.icons, category: dict.roadmap.categoryExperience, status: "released" },
    { id: "week", label: dict.roadmap.week, category: dict.roadmap.categoryPlanning, status: "released" },
    { id: "calendar", label: dict.roadmap.calendar, category: dict.roadmap.categoryPrivacy, status: "planned" },
  ], [dict]);
  const categories = [...new Set(items.map((item) => item.category))];
  const hasActiveFilters = Boolean(query.trim() || category || statusFilter);
  const filtered = items.filter((item) => {
    const matchesQuery = `${item.label} ${item.category}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    return matchesQuery && (!category || item.category === category) && (!statusFilter || item.status === statusFilter);
  });
  const statuses: Status[] = ["released", "inProgress", "planned"];

  function vote(id: ItemId) {
    setVotesCleared(false);
    setVotes((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else next[id] = 1;
      window.localStorage.setItem(VOTES_KEY, JSON.stringify(next));
      return next;
    });
  }

  function clearVotes() {
    window.localStorage.removeItem(VOTES_KEY);
    setVotes({});
    setVotesCleared(true);
  }

  function clearFilters() {
    setQuery("");
    setCategory("");
    setStatusFilter("");
  }

  const selectedLabel = items.find((item) => item.id === selected)?.label ?? "";
  const feedback = feedbackByItem[selected] ?? "";
  const hasSensitiveFeedback = containsSensitiveFeedback(feedback);
  const draft = `${dict.roadmap.feedbackSubject}: ${selectedLabel}\n\n${feedback.trim()}`;
  const issueHref = `${PUBLIC_REPOSITORY_URL}/issues/new?title=${encodeURIComponent(`${dict.roadmap.feedbackSubject}: ${selectedLabel}`)}&body=${encodeURIComponent(draft)}`;

  function blockSensitiveIssue(event: MouseEvent<HTMLAnchorElement>) {
    if (hasSensitiveFeedback) event.preventDefault();
  }

  async function copyFeedback() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(draft);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  function startFeedback(id: ItemId) {
    setSelected(id);
    setCopyState("idle");
    window.requestAnimationFrame(() => feedbackSelectRef.current?.focus());
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl border border-black/10 bg-gradient-to-br from-accent/10 to-transparent p-5 dark:border-white/10">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">{dict.roadmap.kicker}</p>
        <h1 className="mt-2 text-2xl font-bold">{dict.roadmap.title}</h1>
        <p className="mt-2 max-w-3xl leading-relaxed opacity-80">{dict.roadmap.body}</p>
        <div className="mt-4 flex flex-wrap gap-3"><a href={PUBLIC_REPOSITORY_URL} target="_blank" rel="noreferrer" className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-semibold dark:border-white/20">{dict.roadmap.viewGithub}</a><a href={hasSensitiveFeedback ? undefined : issueHref} onClick={blockSensitiveIssue} aria-disabled={hasSensitiveFeedback || undefined} target="_blank" rel="noreferrer" className={`rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white ${hasSensitiveFeedback ? "cursor-not-allowed opacity-50" : ""}`}>{dict.roadmap.submitIdea}</a></div>
      </header>

      <aside className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm" data-testid="roadmap-safety-notice"><h2 className="font-semibold">{dict.roadmap.safetyTitle}</h2><p className="mt-1 opacity-90">{dict.roadmap.safetyBody}</p></aside>

      <section aria-label={dict.roadmap.categorySummary} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((entry) => <button key={entry} type="button" aria-pressed={category === entry} onClick={() => setCategory(category === entry ? "" : entry)} className={`rounded-xl border p-4 text-left ${category === entry ? "border-accent bg-accent/10" : "border-black/10 dark:border-white/10"}`}><span className="text-sm opacity-75">{entry}</span><strong className="mt-1 block text-2xl">{items.filter((item) => item.category === entry).length}</strong></button>)}
      </section>

      <section className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
        <label className="text-sm font-medium">{dict.roadmap.search}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={dict.roadmap.searchPlaceholder} className="mt-1 block w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20" /></label>
        <label className="text-sm font-medium">{dict.roadmap.filterCategory}<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 block w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20"><option value="">{dict.roadmap.allCategories}</option>{categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
        <label className="text-sm font-medium">{dict.roadmap.filterStatus}<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Status | "")} className="mt-1 block w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20"><option value="">{dict.roadmap.allStatuses}</option>{statuses.map((status) => <option key={status} value={status}>{dict.roadmap[status]}</option>)}</select></label>
      </section>
      <div className="flex flex-wrap items-center gap-3 text-sm opacity-75"><p>{dict.roadmap.itemsShown.replace("{n}", String(filtered.length))} {dict.roadmap.localVoteNote}</p>{hasActiveFilters && <button type="button" onClick={clearFilters} className="font-semibold text-accent underline">{dict.roadmap.clearFilters}</button>}{Object.keys(votes).length > 0 && <button type="button" onClick={clearVotes} className="font-semibold text-accent underline">{dict.roadmap.clearVotes}</button>}{votesCleared && <p role="status">{dict.roadmap.votesCleared}</p>}</div>

      <section data-testid="roadmap-items" className="grid gap-4 xl:grid-cols-3">
        {statuses.map((status) => {
          const statusItems = filtered.filter((item) => item.status === status);
          return <section key={status} className="rounded-xl border border-black/10 bg-white/35 p-3 dark:border-white/10 dark:bg-white/[.03]"><div className="flex items-center justify-between gap-3 border-b border-black/10 pb-2 dark:border-white/10"><h2 className="font-semibold">{dict.roadmap[status]}</h2><span className="rounded-full border border-black/10 px-2 py-0.5 text-xs dark:border-white/20">{statusItems.length}</span></div><div className="mt-3 space-y-3">{statusItems.length ? statusItems.map((item) => { const voted = votes[item.id] === 1; return <article key={item.id} className="rounded-lg border border-black/10 bg-background/50 p-3 dark:border-white/10"><p className="font-semibold">{item.label}</p><p className="mt-1 text-xs uppercase tracking-wide opacity-65">{item.category}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" aria-pressed={voted} onClick={() => vote(item.id)} className="rounded-lg border border-accent/40 px-3 py-1.5 text-sm font-semibold text-accent">{voted ? dict.roadmap.voted : dict.roadmap.vote} · {voted ? 1 : 0}</button><button type="button" aria-label={dict.roadmap.draftForItem.replace("{item}", item.label)} onClick={() => startFeedback(item.id)} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-semibold dark:border-white/20">{dict.roadmap.giveFeedback}</button></div></article>; }) : <p className="py-6 text-center text-sm opacity-65">{dict.roadmap.noMatches}</p>}</div></section>;
        })}
      </section>

      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">{dict.roadmap.feedbackTitle}</h2>
        <p className="mt-1 text-sm opacity-80">{dict.roadmap.feedbackBody}</p>
        <label className="mt-4 block text-sm font-medium">{dict.roadmap.feedbackFor}<select ref={feedbackSelectRef} value={selected} onChange={(event) => { setSelected(event.target.value as ItemId); setCopyState("idle"); }} className="mt-1 block w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20">{items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="mt-3 block text-sm font-medium">{dict.roadmap.feedbackLabel}<textarea value={feedback} onChange={(event) => { setFeedbackByItem((current) => ({ ...current, [selected]: event.target.value })); setCopyState("idle"); }} rows={4} className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20" /></label>
        {hasSensitiveFeedback && <p role="alert" data-testid="roadmap-sensitive-feedback" className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{dict.roadmap.sensitiveFeedbackWarning}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={() => { void copyFeedback(); }} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold dark:border-white/20">{dict.roadmap.copyFeedback}</button><a data-testid="roadmap-open-issue" href={hasSensitiveFeedback ? undefined : issueHref} onClick={blockSensitiveIssue} aria-disabled={hasSensitiveFeedback || undefined} target="_blank" rel="noreferrer" className={`rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white ${hasSensitiveFeedback ? "cursor-not-allowed opacity-50" : ""}`}>{dict.roadmap.openIssue}</a><p aria-live="polite" className="text-sm opacity-75">{copyState === "copied" ? dict.roadmap.copiedFeedback : copyState === "error" ? dict.roadmap.copyFeedbackError : null}</p></div>
      </section>
    </div>
  );
}
