import type { CSSProperties, SVGProps } from "react";

// Original line-style full-moon icon for the Poya badge — same sizing
// contract as SunIcon so the two mix cleanly wherever they appear together.
export function FullMoonIcon({ style, ...props }: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="9.2" cy="9.6" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.3" cy="12.4" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="10.6" cy="15" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
