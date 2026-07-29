import type { SVGProps } from "react";
import type { FeatureVisualId } from "@/lib/feature-assets";

export type FeatureIconProps = SVGProps<SVGSVGElement>;

function Glyph({ feature }: { feature: FeatureVisualId }) {
  switch (feature) {
    case "birth-nakshatra": return <path d="m12 30 7-7 5 5 11-14 5 5M12 43h28M16 16h.01M42 38h.01" />;
    case "pancha-pakshi": return <path d="M13 37c10-1 16-7 20-18 2 8 7 13 15 15-7 4-13 5-19 4-5 6-11 8-16 7 2-3 2-5 0-8Z" />;
    case "panchanga": return <><circle cx="32" cy="32" r="10" /><path d="M32 10v7M32 47v7M10 32h7M47 32h7M16 16l5 5M43 43l5 5M48 16l-5 5M21 43l-5 5" /></>;
    case "moon-calendar": return <path d="M40 13a19 19 0 1 0 10 29A17 17 0 1 1 40 13Z" />;
    case "daily-guide": return <><path d="M18 39h28M22 33h20M26 27h12" /><path d="M32 12v8M20 17l5 5M44 17l-5 5" /></>;
    case "family-almanac": return <><rect x="14" y="16" width="36" height="32" rx="4" /><path d="M14 26h36M24 16v32M38 16v32" /></>;
    case "muhurta": return <path d="M32 12c8 9 13 16 13 24a13 13 0 1 1-26 0c0-8 5-15 13-24Zm0 15c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10Z" />;
    case "compatibility": return <><circle cx="24" cy="31" r="9" /><circle cx="40" cy="31" r="9" /><path d="M29 31h6" /></>;
    case "divisional-charts": return <><path d="M32 11 53 32 32 53 11 32 32 11Z" /><path d="m21 21 22 22M43 21 21 43M32 11v42M11 32h42" /></>;
    case "porondam": return <><path d="M18 25c0-5 6-8 10-4l4 4 4-4c4-4 10-1 10 4 0 8-14 16-14 16S18 33 18 25Z" /><path d="M15 46h34" /></>;
    case "birth-chart": return <><path d="M32 10 54 32 32 54 10 32 32 10Z" /><path d="M32 10v44M10 32h44M21 21l22 22M43 21 21 43" /></>;
    case "horoscope-report": return <><rect x="17" y="12" width="30" height="40" rx="3" /><path d="M23 23h18M23 31h18M23 39h11" /><circle cx="40" cy="42" r="5" /></>;
    case "dasha": return <><circle cx="32" cy="32" r="19" /><circle cx="32" cy="32" r="10" /><path d="M32 13v19l10 6" /></>;
    case "ashtakavarga": return <><path d="M14 17h36v30H14zM14 27h36M26 17v30M38 17v30" /><path d="M20 22h.01M32 22h.01M44 22h.01M20 35h.01M32 35h.01M44 35h.01" /></>;
  }
}

export function FeatureIcon({ feature, className, ...props }: FeatureIconProps & { feature: FeatureVisualId }) {
  return (
    <svg viewBox="0 0 64 64" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} data-icon={feature} aria-hidden="true" {...props}>
      <circle cx="32" cy="32" r="29" stroke="currentColor" strokeOpacity="0.24" />
      <Glyph feature={feature} />
    </svg>
  );
}

export const BirthNakshatraIcon = (props: FeatureIconProps) => <FeatureIcon feature="birth-nakshatra" {...props} />;
export const PanchaPakshiIcon = (props: FeatureIconProps) => <FeatureIcon feature="pancha-pakshi" {...props} />;
export const PanchangaIcon = (props: FeatureIconProps) => <FeatureIcon feature="panchanga" {...props} />;
export const MoonCalendarIcon = (props: FeatureIconProps) => <FeatureIcon feature="moon-calendar" {...props} />;
export const DailyGuideIcon = (props: FeatureIconProps) => <FeatureIcon feature="daily-guide" {...props} />;
export const FamilyAlmanacIcon = (props: FeatureIconProps) => <FeatureIcon feature="family-almanac" {...props} />;
export const MuhurtaIcon = (props: FeatureIconProps) => <FeatureIcon feature="muhurta" {...props} />;
export const CompatibilityIcon = (props: FeatureIconProps) => <FeatureIcon feature="compatibility" {...props} />;
export const DivisionalChartsIcon = (props: FeatureIconProps) => <FeatureIcon feature="divisional-charts" {...props} />;
export const PorondamIcon = (props: FeatureIconProps) => <FeatureIcon feature="porondam" {...props} />;
export const BirthChartIcon = (props: FeatureIconProps) => <FeatureIcon feature="birth-chart" {...props} />;
export const HoroscopeReportIcon = (props: FeatureIconProps) => <FeatureIcon feature="horoscope-report" {...props} />;
export const DashaIcon = (props: FeatureIconProps) => <FeatureIcon feature="dasha" {...props} />;
export const AshtakavargaIcon = (props: FeatureIconProps) => <FeatureIcon feature="ashtakavarga" {...props} />;
