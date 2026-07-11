export const PUBLIC_REPOSITORY_URL =
  process.env.NEXT_PUBLIC_REPOSITORY_URL ?? "https://github.com/NPFernando/fernandofamily-astrology";

export const PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://astrology.fernandofamily.com";

// Set at build time (Phase 6 wires the real value in via a Docker build ARG);
// "dev" in local development.
export const DEPLOYED_COMMIT = process.env.NEXT_PUBLIC_DEPLOYED_COMMIT ?? "dev";
