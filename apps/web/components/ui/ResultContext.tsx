import Link from "next/link";

export function ResultNavigation({ label, items }: { label: string; items: { href: string; label: string }[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2 text-sm" data-testid="result-navigation">
      {items.map((item) => (
        <a key={item.href} href={item.href} className="rounded-full border border-black/10 px-3 py-1.5 hover:border-accent hover:text-accent dark:border-white/15">
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function SourceContext({
  title,
  body,
  methodologyHref,
  methodologyLabel,
}: {
  title: string;
  body: string;
  methodologyHref: string;
  methodologyLabel: string;
}) {
  return (
    <details data-testid="source-context" className="rounded-xl border border-black/10 bg-white/35 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[.03]">
      <summary className="cursor-pointer font-semibold text-accent">{title}</summary>
      <p className="mt-2 leading-relaxed opacity-80">{body}</p>
      <Link href={methodologyHref} className="mt-2 inline-block text-sm font-semibold text-accent underline">
        {methodologyLabel}
      </Link>
    </details>
  );
}
