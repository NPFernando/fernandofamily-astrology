import type { MetadataRoute } from "next";

// PWA manifest backed by generated PNG app icons. The maskable asset keeps
// extra inset padding so launchers can crop it without cutting into the mark.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fernando Family Astrology",
    short_name: "FF Astrology",
    description: "Bilingual Sri Lankan astrology tools for Panchanga, Poya, Pancha Pakshi, Muhurta and birth charts.",
    id: "/",
    start_url: "/",
    scope: "/",
    lang: "si",
    dir: "ltr",
    display_override: ["window-controls-overlay", "standalone"],
    display: "standalone",
    shortcuts: [
      {
        name: "Pancha Pakshi",
        short_name: "Pakshi",
        description: "Open the live Pancha Pakshi calculator.",
        url: "/si/pancha-pakshi",
        icons: [{ src: "/icons/app/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Daily Guide",
        short_name: "Guide",
        description: "Open today's Sinhala astrology guide.",
        url: "/si/daily-guide",
        icons: [{ src: "/icons/app/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Moon Calendar",
        short_name: "Moon",
        description: "Open the Sri Lankan Poya and moon calendar.",
        url: "/si/moon-calendar",
        icons: [{ src: "/icons/app/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    background_color: "#fffaf3",
    theme_color: "#b45309",
    icons: [
      {
        src: "/icons/app/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
