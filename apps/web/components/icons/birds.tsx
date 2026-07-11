import type { SVGProps } from "react";
import type { BirdId } from "@/lib/api-client";

// Original line iconography drawn for this project (see THIRD_PARTY_NOTICES.md)
// — stylized, consistent 24x24 stroke icons, one per Pancha Pakshi bird.
// They inherit currentColor so surrounding text color/theme applies.

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

// Hooked beak, bare head on a long curved neck — the carrion glider.
export function VultureIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="14.5" cy="6.5" r="2.5" />
      <path d="M17 6.5c1.2 0 2 .6 2.4 1.6l-2.1.4" />
      <path d="M12.2 7.8C9.5 9.5 8 12 8 15.5c0 2 .8 3.5 2 4.5" />
      <path d="M8 15.5c-2.5 0-4.3-1.2-5-3 1.6-.4 3-.3 4.4.3" />
      <path d="M10 20c2.8.8 5.6.4 7.5-1.5" />
    </svg>
  );
}

// Big round eyes and ear tufts — the night watcher.
export function OwlIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5 8c0-1.5.5-3 1.5-4L8 6h8l1.5-2C18.5 5 19 6.5 19 8v6a7 7 0 0 1-14 0Z" />
      <circle cx="9" cy="10" r="1.9" />
      <circle cx="15" cy="10" r="1.9" />
      <path d="M12 12.5l-1 1.5h2Z" />
      <path d="M9 20.5V19M15 20.5V19" />
    </svg>
  );
}

// Sleek profile with a straight, pointed beak — the clever caller.
export function CrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M13.5 5.5a3 3 0 0 1 3 3l4 1.5-4 .8" />
      <circle cx="14.6" cy="7.6" r="0.4" fill="currentColor" stroke="none" />
      <path d="M13.5 5.5C9 5.5 6 8.5 6 13c0 2.7 1.2 4.8 3 6" />
      <path d="M6.5 13.5c-1.8.5-3.2 1.6-4 3.2 1.7.4 3.3.2 4.8-.6" />
      <path d="M9 19c2.2 1.2 4.8 1 7-.5l-2-4" />
    </svg>
  );
}

// Comb, wattle and an upright chest — the dawn herald.
export function CockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M10.5 5.5c.3-1.2 1-2 2-2.5.1.8 0 1.5-.3 2.1.9-.4 1.8-.4 2.7 0-.6.5-1.2.9-1.9 1.1" />
      <path d="M13 6.2a2.6 2.6 0 0 1 2.6 2.6l2.9 1-2.9.9" />
      <path d="M13.2 12.2c.1 1.1-.3 1.9-1.2 2.5" />
      <path d="M13 6.2c-4 0-6.5 2.6-6.5 6.3 0 3.6 2.4 6 6 6 2 0 3.6-.7 4.7-1.9l-3.3-4.4" />
      <path d="M6.8 14.5c-1.6-.1-2.9-.8-3.8-2 1.3-.7 2.6-.9 4-.6" />
    </svg>
  );
}

// Crest of three plumes and a long elegant neck — the royal dancer.
export function PeacockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M11 4.5V2.8M13.4 5.2l1-1.4M8.9 5.2l-1-1.4" />
      <circle cx="11" cy="7.5" r="2.2" />
      <path d="M12.8 9c1.8 1.5 2.7 3.7 2.7 6.2 0 2.2-.8 4-2.2 5.3" />
      <path d="M15.4 15.5c2.1.2 3.9 1.1 5.1 2.7-1.7.9-3.5 1.1-5.3.6" />
      <path d="M13.3 20.5c-2.6 1-5.3.6-7.3-1.2 1.4-1.2 3-1.8 4.8-1.8" />
    </svg>
  );
}

export const BIRD_ICONS: Record<BirdId, (props: SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  vulture: VultureIcon,
  owl: OwlIcon,
  crow: CrowIcon,
  cock: CockIcon,
  peacock: PeacockIcon,
};
