import type { ActivityId } from "@/lib/api-client";
import { ACTIVITY_COLORS as TOKENS } from "@fernandofamily/design-system";

// Thin re-export of the shared design tokens so existing import sites keep
// working — the single source of truth is packages/design-system/tokens.ts,
// which future astrology modules must also consume.
export const ACTIVITY_COLORS: Record<ActivityId, string> = TOKENS;
