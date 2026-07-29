import type { ImgHTMLAttributes } from "react";

type PosterImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  avifSrcSet: string;
  webpSrcSet: string;
  fallbackSrcSet: string;
  sizes: string;
  avifSrc: string;
  webpSrc: string;
  fallbackSrc: string;
  pictureClassName?: string;
};

/**
 * Serves a native responsive source set for AVIF, WebP, then JPEG. The browser
 * chooses both the smallest suitable width and supported format before it
 * downloads an image.
 */
export function PosterImage({
  avifSrcSet,
  webpSrcSet,
  fallbackSrcSet,
  sizes,
  avifSrc,
  webpSrc,
  fallbackSrc,
  pictureClassName,
  ...imageProps
}: PosterImageProps) {
  return (
    <picture className={pictureClassName}>
      <source srcSet={avifSrcSet} sizes={sizes} type="image/avif" />
      <source srcSet={webpSrcSet} sizes={sizes} type="image/webp" />
      <img src={fallbackSrc} srcSet={fallbackSrcSet} sizes={sizes} {...imageProps} />
    </picture>
  );
}
