"use client";

import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

export function LoadingCards({
  label,
  count = 4,
  className = "",
}: {
  label: string;
  count?: number;
  className?: string;
}) {
  return (
    <SkeletonRegion label={label} className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          className="h-28 rounded-xl"
        />
      ))}
    </SkeletonRegion>
  );
}
