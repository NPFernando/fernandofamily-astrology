import type { MetadataRoute } from "next";
import { enabledFeatures } from "@/lib/feature-registry";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { PUBLIC_BASE_URL } from "@/lib/site-config";

const STATIC_ROUTES = ["", "/about", "/methodology", "/privacy", "/disclaimer", "/licensing"];
const EXTRA_ROUTES = ["/pancha-pakshi/live"];

export default function sitemap(): MetadataRoute.Sitemap {
  const featureRoutes = enabledFeatures().map((f) => f.route);
  const routes = [...STATIC_ROUTES, ...featureRoutes, ...EXTRA_ROUTES];

  return routes.flatMap((route) =>
    SUPPORTED_LOCALES.map((locale) => ({
      url: `${PUBLIC_BASE_URL}/${locale}${route}`,
      lastModified: new Date(),
    })),
  );
}
