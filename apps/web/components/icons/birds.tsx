import type { BirdId } from "@/lib/api-client";
import { GeneratedIcon, type GeneratedIconProps } from "./generated-icon";

const BIRD_ICON_PATHS: Record<BirdId, string> = {
  vulture: "/icons/generated/birds/vulture",
  owl: "/icons/generated/birds/owl",
  crow: "/icons/generated/birds/crow",
  cock: "/icons/generated/birds/cock",
  peacock: "/icons/generated/birds/peacock",
};

function birdIcon(bird: BirdId, props: GeneratedIconProps) {
  const base = BIRD_ICON_PATHS[bird];
  return (
    <GeneratedIcon
      {...props}
      name={bird}
      src={`${base}-64.png`}
      srcSet={`${base}-64.png 1x, ${base}-128.png 2x, ${base}-256.png 4x`}
    />
  );
}

export function VultureIcon(props: GeneratedIconProps) {
  return birdIcon("vulture", props);
}

export function OwlIcon(props: GeneratedIconProps) {
  return birdIcon("owl", props);
}

export function CrowIcon(props: GeneratedIconProps) {
  return birdIcon("crow", props);
}

export function CockIcon(props: GeneratedIconProps) {
  return birdIcon("cock", props);
}

export function PeacockIcon(props: GeneratedIconProps) {
  return birdIcon("peacock", props);
}

export const BIRD_ICONS: Record<BirdId, (props: GeneratedIconProps) => React.JSX.Element> = {
  vulture: VultureIcon,
  owl: OwlIcon,
  crow: CrowIcon,
  cock: CockIcon,
  peacock: PeacockIcon,
};
