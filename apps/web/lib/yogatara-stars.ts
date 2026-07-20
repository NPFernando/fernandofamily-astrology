// Display labels for the 27 yogataras (junction stars), keyed by nakshatra
// key (locales/nakshatras.json / backend NAKSHATRA_KEYS). IAU proper names +
// Bayer designations are international astronomical nomenclature, shown
// untranslated in both locales — the same language-neutral convention as the
// chart's °/′ degree display; the *nakshatra* name is the localized element.
// Identifications follow the 1955 Calendar Reform Committee, Table 5 — see
// apps/api/app/modules/birth_chart/yogatara.py for the pinned source and the
// documented divergences (Ashlesha, Vishakha, Shatabhisha).
export const YOGATARA_STAR_LABELS: Record<string, string> = {
  ashwini: "Sheratan (β Ari)",
  bharani: "41 Arietis",
  krittika: "Alcyone (η Tau)",
  rohini: "Aldebaran (α Tau)",
  mrigashirsha: "Meissa (λ Ori)",
  ardra: "Betelgeuse (α Ori)",
  punarvasu: "Pollux (β Gem)",
  pushya: "Asellus Australis (δ Cnc)",
  ashlesha: "Acubens (α Cnc)",
  magha: "Regulus (α Leo)",
  "purva-phalguni": "Zosma (δ Leo)",
  "uttara-phalguni": "Denebola (β Leo)",
  hasta: "Algorab (δ Crv)",
  chitra: "Spica (α Vir)",
  swati: "Arcturus (α Boo)",
  vishakha: "Zubenelgenubi (α² Lib)",
  anuradha: "Dschubba (δ Sco)",
  jyeshtha: "Antares (α Sco)",
  mula: "Shaula (λ Sco)",
  "purva-ashadha": "Kaus Media (δ Sgr)",
  "uttara-ashadha": "Nunki (σ Sgr)",
  shravana: "Altair (α Aql)",
  dhanishtha: "Rotanev (β Del)",
  shatabhisha: "Hydor (λ Aqr)",
  "purva-bhadrapada": "Markab (α Peg)",
  "uttara-bhadrapada": "Algenib (γ Peg)",
  revati: "Revati (ζ Psc)",
};
