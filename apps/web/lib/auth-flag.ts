import "server-only";

// Auth is opt-in infrastructure: the entire sign-in surface (UI, routes,
// account APIs) exists only when ALL THREE env vars are present. With any
// of them missing the site must render exactly as it did before auth was
// added — no button, no /api/auth routes, no behavioral difference.
export const authEnabled: boolean = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.AUTH_SECRET,
);

export function allowedEmails(): string[] {
  return (process.env.AUTH_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
