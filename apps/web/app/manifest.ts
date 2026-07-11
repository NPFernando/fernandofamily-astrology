import type { MetadataRoute } from "next";

// PWA manifest. Icon is currently a single original SVG (public/icons/icon.svg)
// covering all sizes; PNG rasters at 192/512 should be added for the fullest
// browser "add to home screen" support, but SVG "any" is broadly installable
// today and unblocks the rest of the PWA work.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fernando Family Astrology",
    short_name: "FF Astrology",
    description: "Bilingual traditional astrology tools, starting with a live Pancha Pakshi timetable.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf3",
    theme_color: "#b45309",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
