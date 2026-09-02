"use client";

import { useLocale } from "@/lib/locale-context";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

// Layout-matched placeholder while a schedule computes, so the page doesn't
// jump when the result lands. Pulse is motion-safe only; screen readers get
// the plain loading announcement instead of the decorative blocks.
export function ScheduleSkeleton() {
  const { dict } = useLocale();
  return (
    <SkeletonRegion label={dict.ui.loading} className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-9 rounded-lg" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </div>
    </SkeletonRegion>
  );
}
