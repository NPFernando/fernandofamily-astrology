/* eslint-disable @next/next/no-img-element */
import type { CSSProperties, ImgHTMLAttributes } from "react";

export type GeneratedIconProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "height" | "src" | "srcSet" | "width"> & {
  // Most uses sit beside visible text and remain decorative. A standalone
  // icon can opt into a meaningful accessible name without a separate image
  // implementation or an accidental duplicate announcement.
  label?: string;
};

export function GeneratedIcon({
  name,
  src,
  srcSet,
  className,
  style,
  label,
  ...props
}: GeneratedIconProps & {
  name: string;
  src: string;
  srcSet: string;
}) {
  const mergedStyle: CSSProperties = {
    width: "1.5em",
    height: "1.5em",
    minWidth: "1.5em",
    objectFit: "contain",
    verticalAlign: "-0.35em",
    ...style,
  };

  return (
    <img
      {...props}
      alt={label ?? ""}
      aria-hidden={label ? undefined : "true"}
      className={["inline-block", className].filter(Boolean).join(" ")}
      decoding="async"
      height={64}
      loading="eager"
      src={src}
      srcSet={srcSet}
      sizes="1.5em"
      style={mergedStyle}
      width={64}
      data-icon={name}
    />
  );
}
