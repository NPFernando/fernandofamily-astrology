import "server-only";
import { Pool } from "pg";

// Lazily-created singleton pool against the astrology database (the only
// database the astrology_app role can reach — enforced by pg_hba on the
// host, not just convention). Absent env var = server storage unavailable;
// callers treat that the same as auth-disabled and answer 404.
let pool: Pool | null = null;

export function dbConfigured(): boolean {
  return Boolean(process.env.ASTROLOGY_DATABASE_URL);
}

export function getPool(): Pool {
  if (!pool) {
    const url = process.env.ASTROLOGY_DATABASE_URL;
    if (!url) throw new Error("ASTROLOGY_DATABASE_URL is not set");
    pool = new Pool({ connectionString: url, max: 5 });
  }
  return pool;
}

export async function query<Row = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<Row[]> {
  const result = await getPool().query(text, params);
  return result.rows as Row[];
}
