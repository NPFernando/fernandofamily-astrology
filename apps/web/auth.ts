import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { authEnabled, allowedEmails } from "@/lib/auth-flag";

// JWT session strategy — no database adapter. The session is a signed cookie;
// the only server-side user data lives in the profiles/preferences tables,
// keyed by the session's email (see app/api/account/*).
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: authEnabled
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : [],
  session: { strategy: "jwt" },
  pages: {
    // Non-allowlisted accounts land here with ?error=AccessDenied — the page
    // renders the bilingual "invite-only" message.
    error: "/auth-error",
  },
  callbacks: {
    signIn({ user }) {
      const email = user.email?.toLowerCase();
      // Invite-only: reject anything not explicitly allowlisted. Returning
      // false surfaces AccessDenied on the error page, with no session made.
      return Boolean(email && allowedEmails().includes(email));
    },
  },
});
