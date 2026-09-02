"use client";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton-base skeleton-shimmer ${className}`} />;
}

export function SkeletonRegion({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div role="status" className={className}><span className="sr-only">{label}</span>{children}</div>;
}
