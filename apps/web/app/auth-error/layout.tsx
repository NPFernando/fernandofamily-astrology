import "../globals.css";

// Minimal root layout for the fixed-path auth error page, which lives
// outside the [locale] segment (Auth.js redirects to one fixed error path).
export default function AuthErrorLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
