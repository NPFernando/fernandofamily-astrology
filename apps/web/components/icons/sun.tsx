import type { CSSProperties, SVGProps } from "react";

// Original line-style sun icon for the Panchanga feature — inline SVG rather
// than a generated PNG (the birds/activities sets predate this and use the
// GeneratedIcon pipeline; a single simple glyph doesn't need it). Sized to
// match GeneratedIcon's 1.5em contract so both icon kinds mix cleanly.
export function SunIcon({ style, ...props }: SVGProps<SVGSVGElement>) {
  const mergedStyle: CSSProperties = {
    width: "1.5em",
    height: "1.5em",
    minWidth: "1.5em",
    verticalAlign: "-0.35em",
    ...style,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      style={mergedStyle}
      {...props}
    >
      <circle cx="12" cy="12" r="4.4" />
      <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
    </svg>
  );
}
