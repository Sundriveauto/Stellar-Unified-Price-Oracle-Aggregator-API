import { getPool } from './db';

export interface PriceRecord {
  assetPair: string;
  price: number;
  timestamp: number;
  confidence: number;
  sources: string[];
  stale?: boolean;
}

/** Age in ms after which a price is considered stale (default 5 min). */
const STALE_THRESHOLD_MS = parseInt(process.env.STALE_THRESHOLD_MS || '300000', 10);

function markStale(r: PriceRecord): PriceRecord {
  return { ...r, stale: Date.now() - r.timestamp > STALE_THRESHOLD_MS };
}

export class PriceStore {
  /** Write a new price record to the database. */
  async set(record: PriceRecord): Promise<void> {
    await getPool().query(
      `INSERT INTO prices (asset_pair, price, timestamp, confidence, sources)
       VALUES ($1, $2, $3, $4, $5)`,
      [record.assetPair, record.price, record.timestamp, record.confidence, record.sources],
    );
  }

  /** Get the latest price for an asset pair. */
  async get(assetPair: string): Promise<PriceRecord | undefined> {
    const { rows } = await getPool().query(
      `SELECT asset_pair, price, timestamp, confidence, sources
       FROM prices WHERE asset_pair = $1
       ORDER BY timestamp DESC LIMIT 1`,
      [assetPair],
    );
    if (!rows[0]) return undefined;
    return markStale(rowToRecord(rows[0]));
  }

  /** Get the latest price for every known asset pair. */
  async getAll(): Promise<PriceRecord[]> {
    const { rows } = await getPool().query(`
      SELECT DISTINCT ON (asset_pair) asset_pair, price, timestamp, confidence, sources
      FROM prices
      ORDER BY asset_pair, timestamp DESC
    `);
    return rows.map(r => markStale(rowToRecord(r)));
  }

  /** Get price history with pagination. */
  async getHistory(assetPair: string, limit = 100, offset = 0): Promise<PriceRecord[]> {
    const { rows } = await getPool().query(
      `SELECT asset_pair, price, timestamp, confidence, sources
       FROM prices WHERE asset_pair = $1
       ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
      [assetPair, limit, offset],
    );
    return rows.map(r => markStale(rowToRecord(r)));
  }

  /** Total history count for an asset pair. */
  async historyCount(assetPair: string): Promise<number> {
    const { rows } = await getPool().query(
      `SELECT COUNT(*)::int AS cnt FROM prices WHERE asset_pair = $1`,
      [assetPair],
    );
    return rows[0]?.cnt ?? 0;
  }
}

function rowToRecord(row: Record<string, unknown>): PriceRecord {
  return {
    assetPair: row.asset_pair as string,
    price: row.price as number,
    timestamp: Number(row.timestamp),
    confidence: row.confidence as number,
    sources: row.sources as string[],
  };
}

export const priceStore = new PriceStore();
