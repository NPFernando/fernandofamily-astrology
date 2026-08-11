"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useLocalVault } from "@/components/LocalVaultProvider";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { useLocale } from "@/lib/locale-context";
import { getDictionary } from "@/lib/i18n";
import { listLocalProfiles, type SavedProfile } from "@/lib/profiles";
import { plansToIcsEvents, planSort, type VaultFamilyGroup, type VaultPlan } from "@/lib/planner";
import { nowAsTargetDateTime } from "@/components/pancha-pakshi/TargetDateTimeFields";

function initialDate() {
  return nowAsTargetDateTime("Asia/Colombo").date;
}

function addDays(date: string, offset: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(year, month - 1, day + offset, 12);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

function formatWeekDate(date: string, locale: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "si" ? "si-LK" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day, 12));
}

export function PlannerClient() {
  const { dict, locale } = useLocale();
  const { data, unlocked, update } = useLocalVault();
  const profiles = useMemo(() => listLocalProfiles(), []);
  const [date, setDate] = useState(initialDate);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [groupLabel, setGroupLabel] = useState("");
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [weekExportMessage, setWeekExportMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const plans = useMemo(() => (data.plans ?? []).filter((plan) => plan.date === date).sort(planSort), [data.plans, date]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, offset) => addDays(date, offset)), [date]);
  const weekPlans = useMemo(() => new Map(weekDates.map((day) => [day, (data.plans ?? []).filter((plan) => plan.date === day).sort(planSort)])), [data.plans, weekDates]);
  const allWeekPlans = useMemo(() => Array.from(weekPlans.values()).flat(), [weekPlans]);
  const profileLabels = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile.label])), [profiles]);
  const groups = data.familyGroups ?? [];

  function toggleProfile(id: string) {
    setSelectedProfiles((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function selectGroup(group: VaultFamilyGroup) {
    setSelectedProfiles(group.profile_ids);
  }

  function groupIsSelected(group: VaultFamilyGroup) {
    return group.profile_ids.length === selectedProfiles.length && group.profile_ids.every((id) => selectedProfiles.includes(id));
  }

  function planProfileSummary(plan: VaultPlan) {
    const labels = plan.profile_ids.map((id) => profileLabels.get(id)).filter((label): label is string => Boolean(label));
    return labels.length > 0 ? dict.dailyGuide.planFor.replace("{profiles}", labels.join(", ")) : null;
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!unlocked || !title.trim()) return;
    const planDetails = {
      title: title.trim(),
      date,
      starts_at: start || null,
      ends_at: end || null,
      profile_ids: selectedProfiles,
      notes: notes.trim(),
    };
    if (editingPlanId) {
      await update((current) => ({ ...current, plans: (current.plans ?? []).map((plan) => plan.id === editingPlanId ? { ...plan, ...planDetails } : plan) }));
      setEditingPlanId(null);
    } else {
      const plan: VaultPlan = { id: crypto.randomUUID(), ...planDetails, source: "manual", created_at: new Date().toISOString() };
      await update((current) => ({ ...current, plans: [...(current.plans ?? []), plan] }));
    }
    setTitle("");
    setStart("");
    setEnd("");
    setNotes("");
  }

  function editPlan(plan: VaultPlan) {
    setEditingPlanId(plan.id);
    setTitle(plan.title);
    setDate(plan.date);
    setStart(plan.starts_at ?? "");
    setEnd(plan.ends_at ?? "");
    setNotes(plan.notes);
    setSelectedProfiles(plan.profile_ids);
  }

  function cancelPlanEdit() {
    setEditingPlanId(null);
    setTitle("");
    setStart("");
    setEnd("");
    setNotes("");
  }

  function applyTemplate(templateTitle: string) {
    setEditingPlanId(null);
    setTitle(templateTitle);
    setStart("");
    setEnd("");
    setNotes("");
  }

  async function saveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!unlocked || !groupLabel.trim() || selectedProfiles.length === 0) return;
    const group: VaultFamilyGroup = {
      id: crypto.randomUUID(),
      label: groupLabel.trim(),
      profile_ids: selectedProfiles,
      created_at: new Date().toISOString(),
    };
    await update((current) => ({ ...current, familyGroups: [...(current.familyGroups ?? []), group] }));
    setGroupLabel("");
  }

  async function removePlan(id: string) {
    await update((current) => ({ ...current, plans: (current.plans ?? []).filter((plan) => plan.id !== id) }));
  }

  async function copyPlanToNextDay(plan: VaultPlan) {
    const copiedDate = addDays(plan.date, 1);
    const copy: VaultPlan = { ...plan, id: crypto.randomUUID(), date: copiedDate, created_at: new Date().toISOString() };
    await update((current) => ({ ...current, plans: [...(current.plans ?? []), copy] }));
    setCopyMessage(dict.dailyGuide.planCopied.replace("{date}", formatWeekDate(copiedDate, locale)));
  }

  async function removeGroup(id: string) {
    await update((current) => ({ ...current, familyGroups: (current.familyGroups ?? []).filter((group) => group.id !== id) }));
  }

  function downloadAgenda() {
    const events = plansToIcsEvents(plans);
    if (events.length === 0) {
      setExportMessage(dict.dailyGuide.agendaExportUnavailable);
      return;
    }
    downloadIcs(`daily-agenda-${date}.ics`, buildIcs(events));
    setExportMessage(null);
  }

  function downloadWeekAgenda() {
    const events = plansToIcsEvents(allWeekPlans);
    if (events.length === 0) {
      setWeekExportMessage(dict.dailyGuide.plannerWeekExportUnavailable);
      return;
    }
    downloadIcs(`weekly-agenda-${date}.ics`, buildIcs(events));
    setWeekExportMessage(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-bold">{dict.dailyGuide.plannerTitle}</h1>
        <p className="mt-1 text-sm leading-relaxed opacity-80 sm:text-base">{dict.dailyGuide.plannerDescription}</p>
        <Link href={`/${locale}/daily-guide`} className="mt-3 inline-block text-sm font-semibold text-accent underline">{dict.dailyGuide.backToGuide}</Link>
      </header>

      {!unlocked ? (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm" data-testid="planner-locked">
          {dict.dailyGuide.plannerLocked}
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-black/10 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[.03]">
            <div data-testid="planner-date-controls" className="flex flex-wrap items-end justify-between gap-3">
              <label className="block max-w-xs text-sm font-medium">
                {dict.ui.pickDate}
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setDate(addDays(date, -1))} className="rounded-lg border border-black/15 px-3 py-2 text-sm font-semibold dark:border-white/20">{dict.ui.previousDay}</button>
                <button type="button" onClick={() => setDate(initialDate())} className="rounded-lg border border-black/15 px-3 py-2 text-sm font-semibold dark:border-white/20">{dict.ui.backToToday}</button>
                <button type="button" onClick={() => setDate(addDays(date, 1))} className="rounded-lg border border-black/15 px-3 py-2 text-sm font-semibold dark:border-white/20">{dict.ui.nextDay}</button>
              </div>
            </div>
            <form onSubmit={savePlan} className="mt-4 grid gap-3 lg:grid-cols-2">
              <fieldset className="lg:col-span-2"><legend className="text-sm font-medium">{dict.dailyGuide.plannerTemplatesTitle}</legend><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => applyTemplate(dict.dailyGuide.plannerTemplatePuja)} className="rounded-full border border-accent/40 px-3 py-1.5 text-sm font-semibold text-accent">{dict.dailyGuide.plannerTemplatePuja}</button><button type="button" onClick={() => applyTemplate(dict.dailyGuide.plannerTemplateFamilyVisit)} className="rounded-full border border-accent/40 px-3 py-1.5 text-sm font-semibold text-accent">{dict.dailyGuide.plannerTemplateFamilyVisit}</button><button type="button" onClick={() => applyTemplate(dict.dailyGuide.plannerTemplatePoya)} className="rounded-full border border-accent/40 px-3 py-1.5 text-sm font-semibold text-accent">{dict.dailyGuide.plannerTemplatePoya}</button></div></fieldset>
              <label className="text-sm font-medium">{dict.dailyGuide.planTitle}<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">{dict.dailyGuide.planStart}<input type="time" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20" /></label>
                <label className="text-sm font-medium">{dict.dailyGuide.planEnd}<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20" /></label>
              </div>
              <label className="text-sm font-medium lg:col-span-2">{dict.dailyGuide.planNotes}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20" /></label>
              {groups.length > 0 && <fieldset data-testid="planner-group-picker" className="lg:col-span-2"><legend className="text-sm font-medium">{dict.dailyGuide.useGroupForPlan}</legend><div className="mt-2 flex flex-wrap gap-2">{groups.map((group) => <button key={group.id} type="button" aria-pressed={groupIsSelected(group)} onClick={() => selectGroup(group)} className="rounded-full border border-accent/40 px-3 py-1.5 text-sm font-semibold text-accent">{group.label} · {group.profile_ids.length}</button>)}</div></fieldset>}
              <div className="lg:col-span-2"><ProfileChoices profiles={profiles} selected={selectedProfiles} onToggle={toggleProfile} dict={dict} /></div>
              <div className="flex flex-wrap gap-3 lg:col-span-2"><button type="submit" className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">{editingPlanId ? dict.dailyGuide.savePlan : dict.dailyGuide.addPlan}</button>{editingPlanId && <button type="button" onClick={cancelPlanEdit} className="w-fit rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold dark:border-white/20">{dict.dailyGuide.cancelPlanEdit}</button>}</div>
            </form>
          </section>

          <section data-testid="planner-agenda" className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{dict.dailyGuide.agendaTitle}</h2><button type="button" onClick={downloadAgenda} className="rounded-lg border border-accent/40 px-3 py-1.5 text-sm font-semibold text-accent">{dict.dailyGuide.exportAgenda}</button></div>
            <p className="mt-1 text-xs opacity-70">{dict.dailyGuide.agendaExportHelp}</p>
            {plans.length === 0 ? <p className="mt-2 text-sm opacity-70">{dict.dailyGuide.agendaEmpty}</p> : <ul className="mt-3 space-y-2">{plans.map((plan) => { const profileSummary = planProfileSummary(plan); return <li key={plan.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-black/10 p-3 text-sm dark:border-white/10"><div><p className="font-semibold">{plan.starts_at ? `${plan.starts_at}${plan.ends_at ? `–${plan.ends_at}` : ""} · ` : ""}{plan.title}</p>{profileSummary && <p className="mt-1 opacity-70">{profileSummary}</p>}{plan.notes && <p className="mt-1 opacity-70">{plan.notes}</p>}</div><div className="flex flex-wrap gap-3"><button type="button" onClick={() => { void copyPlanToNextDay(plan); }} className="text-xs text-accent underline">{dict.dailyGuide.copyPlan}</button><button type="button" onClick={() => editPlan(plan)} className="text-xs text-accent underline">{dict.dailyGuide.editPlan}</button><button type="button" onClick={() => { void removePlan(plan.id); }} className="text-xs text-accent underline">{dict.ui.deleteProfile}</button></div></li>; })}</ul>}
            {exportMessage && <p role="status" className="mt-2 text-sm text-accent">{exportMessage}</p>}
            {copyMessage && <p role="status" className="mt-2 text-sm text-accent">{copyMessage}</p>}
          </section>

          <section data-testid="planner-week" className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{dict.dailyGuide.plannerWeekTitle}</h2>
              <button type="button" onClick={downloadWeekAgenda} className="rounded-lg border border-accent/40 px-3 py-1.5 text-sm font-semibold text-accent">{dict.dailyGuide.plannerWeekExport}</button>
            </div>
            <p className="mt-1 text-sm opacity-80">{dict.dailyGuide.plannerWeekDescription}</p>
            {weekExportMessage && <p role="status" className="mt-2 text-sm text-accent">{weekExportMessage}</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {weekDates.map((day) => {
                const dayPlans = weekPlans.get(day) ?? [];
                const formattedDate = formatWeekDate(day, locale);
                return (
                  <article key={day} className={`rounded-lg border p-3 ${day === date ? "border-accent bg-accent/5" : "border-black/10 dark:border-white/10"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{formattedDate}</h3>
                      <button type="button" aria-label={dict.dailyGuide.plannerOpenDay.replace("{date}", formattedDate)} onClick={() => setDate(day)} className="text-xs font-semibold text-accent underline">{dict.dailyGuide.plannerOpenDay.replace("{date}", formattedDate)}</button>
                    </div>
                    {dayPlans.length === 0 ? <p className="mt-3 text-sm opacity-65">{dict.dailyGuide.plannerWeekEmpty}</p> : <ul className="mt-3 space-y-2 text-sm">{dayPlans.map((plan) => { const profileSummary = planProfileSummary(plan); return <li key={plan.id}><span className="font-medium">{plan.starts_at ? `${plan.starts_at} · ` : ""}{plan.title}</span>{profileSummary && <p className="mt-0.5 opacity-65">{profileSummary}</p>}{plan.notes && <p className="mt-0.5 opacity-65">{plan.notes}</p>}</li>; })}</ul>}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <h2 className="text-lg font-semibold">{dict.dailyGuide.groupTitle}</h2>
            <p className="mt-1 text-sm opacity-80">{dict.dailyGuide.groupDescription}</p>
            <form onSubmit={saveGroup} className="mt-3 flex flex-wrap gap-3"><input required value={groupLabel} onChange={(event) => setGroupLabel(event.target.value)} placeholder={dict.dailyGuide.groupNamePlaceholder} className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/20" /><button type="submit" className="rounded-lg border border-accent/40 px-4 py-2 text-sm font-semibold text-accent">{dict.dailyGuide.saveGroup}</button></form>
            {groups.length > 0 && <ul className="mt-4 space-y-2">{groups.map((group) => <li key={group.id} className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"><span>{group.label} · {group.profile_ids.length}</span><button type="button" onClick={() => { void removeGroup(group.id); }} className="text-xs text-accent underline">{dict.ui.deleteProfile}</button></li>)}</ul>}
          </section>
        </>
      )}
    </div>
  );
}

type ProfileChoicesProps = {
  profiles: SavedProfile[];
  selected: string[];
  onToggle: (id: string) => void;
  dict: ReturnType<typeof getDictionary>;
};

function ProfileChoices({ profiles, selected, onToggle, dict }: ProfileChoicesProps) {
  if (profiles.length === 0) return <p className="text-sm opacity-70">{dict.dailyGuide.groupNoProfiles}</p>;
  return (
    <fieldset>
      <legend className="text-sm font-medium">{dict.dailyGuide.groupProfiles}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {profiles.map((profile) => (
          <label key={profile.id} className="flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-sm dark:border-white/20">
            <input type="checkbox" checked={selected.includes(profile.id)} onChange={() => onToggle(profile.id)} />
            {profile.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
