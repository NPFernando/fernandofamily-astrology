import Link from "next/link";
import en from "@/locales/en.json";
import si from "@/locales/si.json";

// Auth.js redirects here on sign-in failure (?error=AccessDenied for a
// non-allowlisted account). It lives outside the [locale] segment because
// the error redirect target is a single fixed path — so it shows both
// languages rather than guessing one.
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const denied = error === "AccessDenied";

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-xl font-semibold">
        {denied ? en.ui.signInInviteOnly : en.ui.signInFailed}
      </h1>
      <p className="opacity-80" lang="si">
        {denied ? si.ui.signInInviteOnly : si.ui.signInFailed}
      </p>
      <Link href="/" className="rounded-lg border border-black/10 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
        {en.ui.back} / <span lang="si">{si.ui.back}</span>
      </Link>
    </main>
  );
}
