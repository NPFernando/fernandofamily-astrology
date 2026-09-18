import "server-only";
import { normalizeAccountLocation } from "@/lib/account-location";
import { query } from "@/lib/db";

export type PrivacyVaultMigrationTelemetry = {
  schema_version: 1;
  aggregate_only: true;
  generated_at: string;
  completion_status: "complete" | "pending" | "needs_review" | "no_accounts";
  accounts: { total: number; complete: number; pending: number; needs_review: number };
};

type LegacyLocationRow = { default_location: unknown };

/** Reduce legacy-location rows to aggregate status without returning values. */
export function summarizeLegacyLocationRows(
  rows: Array<LegacyLocationRow>,
  generatedAt = new Date().toISOString(),
): PrivacyVaultMigrationTelemetry {
  let complete = 0;
  let pending = 0;
  let needsReview = 0;
  for (const row of rows) {
    if (row.default_location === null || row.default_location === undefined) complete += 1;
    else if (normalizeAccountLocation(row.default_location) === "invalid") needsReview += 1;
    else pending += 1;
  }
  const total = rows.length;
  return {
    schema_version: 1,
    aggregate_only: true,
    generated_at: generatedAt,
    completion_status:
      total === 0 ? "no_accounts" : needsReview > 0 ? "needs_review" : pending > 0 ? "pending" : "complete",
    accounts: { total, complete, pending, needs_review: needsReview },
  };
}

export async function getPrivacyVaultMigrationTelemetry(): Promise<PrivacyVaultMigrationTelemetry> {
  // Read only the legacy-location column and reduce it before returning.
  const rows = await query<LegacyLocationRow>("SELECT default_location FROM preferences");
  return summarizeLegacyLocationRows(rows);
}
