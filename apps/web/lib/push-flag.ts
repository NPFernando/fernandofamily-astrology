import "server-only";

// Push is opt-in infrastructure like auth: the whole surface (opt-in card,
// /api/push routes, dispatch) exists only when the VAPID keys are present.
// Unlike Google OAuth these need no external account — `npx web-push
// generate-vapid-keys` at deploy time is enough — so in production this is
// expected to be ON.
export const pushEnabled: boolean = Boolean(
  process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
);

export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}
