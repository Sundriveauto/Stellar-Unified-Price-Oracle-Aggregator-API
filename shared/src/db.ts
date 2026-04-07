import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export async function runMigrations(): Promise<void> {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS prices (
      id          BIGSERIAL PRIMARY KEY,
      asset_pair  TEXT        NOT NULL,
      price       DOUBLE PRECISION NOT NULL,
      timestamp   BIGINT      NOT NULL,
      confidence  DOUBLE PRECISION NOT NULL,
      sources     TEXT[]      NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_prices_pair_ts ON prices (asset_pair, timestamp DESC);
  `);
}
