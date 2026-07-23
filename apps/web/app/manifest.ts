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
    display: "standalone",
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
