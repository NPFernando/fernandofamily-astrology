/* eslint-disable @next/next/no-img-element */
import type { CSSProperties, ImgHTMLAttributes } from "react";

export type GeneratedIconProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "height" | "src" | "srcSet" | "width">;

export function GeneratedIcon({
  name,
  src,
  srcSet,
  className,
  style,
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
      alt=""
      aria-hidden="true"
      className={["inline-block", className].filter(Boolean).join(" ")}
      decoding="async"
      height={64}
      loading="eager"
      src={src}
      srcSet={srcSet}
      style={mergedStyle}
      width={64}
      data-icon={name}
    />
  );
}
