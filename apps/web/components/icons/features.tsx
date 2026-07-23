import type { FeatureVisualId } from "@/lib/feature-assets";
import { GeneratedIcon, type GeneratedIconProps } from "./generated-icon";

function featureIcon(feature: FeatureVisualId, props: GeneratedIconProps) {
  const base = `/icons/generated/features/${feature}`;
  return (
    <GeneratedIcon
      {...props}
      name={feature}
      src={`${base}-64.png`}
      srcSet={`${base}-64.png 1x, ${base}-128.png 2x, ${base}-256.png 4x`}
    />
  );
}

export function FeatureIcon({
  feature,
  ...props
}: GeneratedIconProps & {
  feature: FeatureVisualId;
}) {
  return featureIcon(feature, props);
}

export function BirthNakshatraIcon(props: GeneratedIconProps) {
  return featureIcon("birth-nakshatra", props);
}

export function PanchaPakshiIcon(props: GeneratedIconProps) {
  return featureIcon("pancha-pakshi", props);
}

export function PanchangaIcon(props: GeneratedIconProps) {
  return featureIcon("panchanga", props);
}

export function MoonCalendarIcon(props: GeneratedIconProps) {
  return featureIcon("moon-calendar", props);
}

export function DailyGuideIcon(props: GeneratedIconProps) {
  return featureIcon("daily-guide", props);
}

export function FamilyAlmanacIcon(props: GeneratedIconProps) {
  return featureIcon("family-almanac", props);
}

export function MuhurtaIcon(props: GeneratedIconProps) {
  return featureIcon("muhurta", props);
}

export function CompatibilityIcon(props: GeneratedIconProps) {
  return featureIcon("compatibility", props);
}

export function DivisionalChartsIcon(props: GeneratedIconProps) {
  return featureIcon("divisional-charts", props);
}

export function PorondamIcon(props: GeneratedIconProps) {
  return featureIcon("porondam", props);
}

export function BirthChartIcon(props: GeneratedIconProps) {
  return featureIcon("birth-chart", props);
}

export function HoroscopeReportIcon(props: GeneratedIconProps) {
  return featureIcon("horoscope-report", props);
}

export function DashaIcon(props: GeneratedIconProps) {
  return featureIcon("dasha", props);
}
