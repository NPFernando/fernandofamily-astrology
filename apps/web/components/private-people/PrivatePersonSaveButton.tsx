"use client";

import { useId, useState } from "react";
import { useLocale } from "@/lib/locale-context";

type Props = {
  disabled?: boolean;
  onSave: (label: string) => Promise<void>;
};

/**
 * Inline, localized save affordance for birth-detail forms. A form keeps the
 * label entry usable on mobile and makes the vault action keyboard accessible;
 * the browser's native prompt is intentionally avoided because it is not
 * localized and cannot be styled or announced consistently.
 */
export function PrivatePersonSaveButton({ disabled = false, onSave }: Props) {
  const { dict } = useLocale();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  function close() {
    if (saving) return;
    setOpen(false);
    setLabel("");
    setError(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError(true);
      return;
    }
    setSaving(true);
    setError(false);
    try {
      await onSave(trimmed);
      close();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="w-fit rounded-lg border border-accent/40 px-4 py-2 text-sm font-semibold text-accent disabled:opacity-40"
      >
        {dict.ui.savePrivatePerson}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-wrap items-end gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3" data-testid="private-person-save-form">
      <div className="min-w-44 flex-1">
        <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-accent">
          {dict.ui.personName}
        </label>
        <input
          id={inputId}
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            if (error) setError(false);
          }}
          autoFocus
          required
          disabled={saving}
          aria-invalid={error}
          className="w-full rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20"
        />
        {error && <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-300">{dict.ui.error}</p>}
      </div>
      <button type="submit" disabled={saving} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
        {saving ? dict.ui.loading : dict.ui.saveChanges}
      </button>
      <button type="button" disabled={saving} onClick={close} className="rounded-lg border border-black/15 px-3 py-1.5 text-xs dark:border-white/20">
        {dict.ui.cancel}
      </button>
    </form>
  );
}
