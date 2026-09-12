"use client";

// A compact progressive-disclosure pattern for calculated results. Keeping
// the explanation closed by default lets returning users stay focused, while
// making the interpretation and decision boundary available in context.
export function ResultExplanation({ title, body }: { title: string; body: string }) {
  return (
    <details
      data-testid="result-explanation"
      className="rounded-xl border border-black/10 bg-white/40 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[.04]"
    >
      <summary className="cursor-pointer font-semibold text-accent">{title}</summary>
      <p className="mt-2 leading-relaxed opacity-80">{body}</p>
    </details>
  );
}
