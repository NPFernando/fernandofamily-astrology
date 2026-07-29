"use client";

import { useEffect, useState } from "react";
import { PosterImage } from "@/components/PosterImage";
import { recordImageTelemetry } from "@/lib/image-telemetry";
import { useDataSaver } from "@/lib/data-saver-context";
import { useLocale } from "@/lib/locale-context";

type NetworkInformation = { effectiveType?: string; saveData?: boolean };

type DeferredPosterProps = {
  avifSrcSet: string;
  webpSrcSet: string;
  fallbackSrcSet: string;
  sizes: string;
  avifSrc: string;
  webpSrc: string;
  fallbackSrc: string;
  imageClassName: string;
};

function slowConnection() {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return connection?.saveData === true || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g";
}

/** Decorative below-the-fold artwork stays out of the DOM on constrained networks. */
export function DeferredPoster(props: DeferredPosterProps) {
  const { dict } = useLocale();
  const { alwaysShowImages } = useDataSaver();
  const [state, setState] = useState<"pending" | "suppressed" | "ready">("pending");
  const { imageClassName, ...posterProps } = props;

  useEffect(() => {
    if (slowConnection() && !alwaysShowImages) {
      setState("suppressed");
      recordImageTelemetry("deferred");
      return;
    }
    setState("ready");
  }, [alwaysShowImages]);

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-background/20" data-deferred-poster={state}>
      {state === "ready" && (
        <PosterImage
          {...posterProps}
          alt=""
          aria-hidden
          loading="lazy"
          className={imageClassName}
        />
      )}
      {state === "suppressed" && (
        <button
          type="button"
          onClick={() => {
            recordImageTelemetry("revealed");
            setState("ready");
          }}
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 px-3 text-center text-xs font-semibold text-accent underline underline-offset-4"
        >
          {dict.ui.revealDecorativeImages}
        </button>
      )}
    </div>
  );
}
