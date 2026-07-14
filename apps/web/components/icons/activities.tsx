import type { ActivityId } from "@/lib/api-client";
import { GeneratedIcon, type GeneratedIconProps } from "./generated-icon";

const ACTIVITY_ICON_PATHS: Record<ActivityId, string> = {
  ruling: "/icons/generated/activities/ruling",
  eating: "/icons/generated/activities/eating",
  walking: "/icons/generated/activities/walking",
  sleeping: "/icons/generated/activities/sleeping",
  dying: "/icons/generated/activities/dying",
};

function activityIcon(activity: ActivityId, props: GeneratedIconProps) {
  const base = ACTIVITY_ICON_PATHS[activity];
  return (
    <GeneratedIcon
      {...props}
      name={activity}
      src={`${base}-64.png`}
      srcSet={`${base}-64.png 1x, ${base}-128.png 2x, ${base}-256.png 4x`}
    />
  );
}

export function RulingIcon(props: GeneratedIconProps) {
  return activityIcon("ruling", props);
}

export function EatingIcon(props: GeneratedIconProps) {
  return activityIcon("eating", props);
}

export function WalkingIcon(props: GeneratedIconProps) {
  return activityIcon("walking", props);
}

export function SleepingIcon(props: GeneratedIconProps) {
  return activityIcon("sleeping", props);
}

export function DyingIcon(props: GeneratedIconProps) {
  return activityIcon("dying", props);
}

export const ACTIVITY_ICONS: Record<ActivityId, (props: GeneratedIconProps) => React.JSX.Element> = {
  ruling: RulingIcon,
  eating: EatingIcon,
  walking: WalkingIcon,
  sleeping: SleepingIcon,
  dying: DyingIcon,
};
