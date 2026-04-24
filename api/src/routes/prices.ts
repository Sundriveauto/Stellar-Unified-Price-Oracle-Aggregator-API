import { Router, Request, Response } from 'express';
import { priceStore } from '../../../shared/src/store';

const router = Router();

const MAX_PAIRS = 50;
const PAIR_RE = /^[A-Z0-9]{1,10}\/[A-Z0-9]{1,10}$/;

function parsePagination(query: Request['query']): { limit: number; offset: number } | null {
  const limit = query.limit !== undefined ? parseInt(query.limit as string, 10) : 100;
  const offset = query.offset !== undefined ? parseInt(query.offset as string, 10) : 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) return null;
  if (!Number.isInteger(offset) || offset < 0) return null;
  return { limit, offset };
}

// ── GET /api/prices ────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const pairsParam = req.query.pairs as string | undefined;

  if (pairsParam !== undefined) {
    const pairs = pairsParam.split(',').map(p => p.trim()).filter(Boolean);
    if (pairs.length > MAX_PAIRS) {
      return res.status(400).json({ error: `Too many pairs (max ${MAX_PAIRS})`, code: 'INVALID_INPUT' });
    }
    const invalid = pairs.find(p => !PAIR_RE.test(p));
    if (invalid) {
      return res.status(400).json({ error: `Invalid pair format: ${invalid}`, code: 'INVALID_INPUT' });
    }
    const records = await Promise.all(pairs.map(p => priceStore.get(p)));
    const prices: Record<string, object> = {};
    for (const r of records) {
      if (r) prices[r.assetPair] = { price: r.price, timestamp: r.timestamp, confidence: r.confidence, sources: r.sources, stale: r.stale };
    }
    return res.json({ prices });
  }

  const all = await priceStore.getAll();
  const prices: Record<string, object> = {};
  for (const r of all) {
    prices[r.assetPair] = { price: r.price, timestamp: r.timestamp, confidence: r.confidence, sources: r.sources, stale: r.stale };
  }
  res.json({ prices });
});

// ── GET /api/prices/:assetPair ─────────────────────────────────────────────
router.get('/:assetPair', async (req: Request, res: Response) => {
  const assetPair = decodeURIComponent(req.params.assetPair);
  if (!PAIR_RE.test(assetPair)) {
    return res.status(400).json({ error: 'Invalid asset pair format', code: 'INVALID_INPUT' });
  }

  const record = await priceStore.get(assetPair);
  if (!record) {
    return res.status(404).json({ error: 'Asset pair not found', code: 'ASSET_NOT_FOUND' });
  }
  res.json({ assetPair: record.assetPair, price: record.price, timestamp: record.timestamp, confidence: record.confidence, sources: record.sources, stale: record.stale });
});

// ── GET /api/prices/:assetPair/history ─────────────────────────────────────
router.get('/:assetPair/history', async (req: Request, res: Response) => {
  const assetPair = decodeURIComponent(req.params.assetPair);
  if (!PAIR_RE.test(assetPair)) {
    return res.status(400).json({ error: 'Invalid asset pair format', code: 'INVALID_INPUT' });
  }

  const pagination = parsePagination(req.query);
  if (!pagination) {
    return res.status(400).json({ error: 'Invalid limit or offset', code: 'INVALID_INPUT' });
  }

  const [prices, total] = await Promise.all([
    priceStore.getHistory(assetPair, pagination.limit, pagination.offset),
    priceStore.historyCount(assetPair),
  ]);
  res.json({ assetPair, prices, limit: pagination.limit, offset: pagination.offset, total });
});

export const priceRouter = router;
