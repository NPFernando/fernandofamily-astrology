import type { SVGProps } from "react";
import type { ActivityId } from "@/lib/api-client";

// Original activity iconography (see THIRD_PARTY_NOTICES.md): color is never
// the only signal for an activity — these accompany the activity colors and
// the localized labels everywhere they're used.

function base(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: "0 0 24 24",
    width: "1em",
    height: "1em",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

// Ruling (Raja) — a crown.
export function RulingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 17.5 3 7.5l4.5 3.5L12 5l4.5 6L21 7.5l-1 10Z" />
      <path d="M6 20.5h12" />
    </svg>
  );
}

// Eating (Bhojana) — a bowl with rising warmth.
export function EatingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 12.5h16a8 8 0 0 1-16 0Z" />
      <path d="M9.5 8.5c0-1 .8-1.2.8-2.2M13.7 8.5c0-1 .8-1.2.8-2.2" />
    </svg>
  );
}

// Walking (Gamana) — footsteps.
export function WalkingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <ellipse cx="8" cy="7" rx="2.4" ry="3.4" />
      <path d="M6.5 12.5h3M7 15h2" />
      <ellipse cx="16" cy="12" rx="2.4" ry="3.4" />
      <path d="M14.5 17.5h3M15 20h2" />
    </svg>
  );
}

// Sleeping (Nidra) — a crescent moon and a star.
export function SleepingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M18.5 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9 9.5Z" />
      <path d="M17 5.5l.5 1.4 1.5.5-1.5.5-.5 1.4-.5-1.4-1.5-.5 1.5-.5Z" />
    </svg>
  );
}

// Marana — a sun sinking below the horizon.
export function DyingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M7.5 13.5a4.5 4.5 0 0 1 9 0" />
      <path d="M12 6.5V4M6 8.5 4.5 7M18 8.5 19.5 7" />
      <path d="M3 16.5h18M7 19.5h10" />
    </svg>
  );
}

export const ACTIVITY_ICONS: Record<ActivityId, (props: SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  ruling: RulingIcon,
  eating: EatingIcon,
  walking: WalkingIcon,
  sleeping: SleepingIcon,
  dying: DyingIcon,
};
