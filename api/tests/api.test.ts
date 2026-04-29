import request from 'supertest';
import { app } from '../src/index';
import { priceStore } from '../../aggregator/src/store';

// Seed the store before tests.
beforeAll(() => {
  priceStore.set({ assetPair: 'XLM/USD', price: 0.12, timestamp: 1_700_000_000_000, confidence: 0.95, sources: ['chainlink', 'redstone'] });
  priceStore.set({ assetPair: 'BTC/USD', price: 45000, timestamp: 1_700_000_000_000, confidence: 0.99, sources: ['chainlink', 'band'] });
  for (let i = 0; i < 5; i++) {
    priceStore.set({ assetPair: 'ETH/USD', price: 2000 + i * 10, timestamp: 1_700_000_000_000 + i * 1000, confidence: 0.97, sources: ['redstone'] });
  }
});

// ── Health ─────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  test('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ── GET /api/prices ────────────────────────────────────────────────────────

describe('GET /api/prices', () => {
  test('returns all prices when no pairs param', async () => {
    const res = await request(app).get('/api/prices');
    expect(res.status).toBe(200);
    expect(res.body.prices).toBeDefined();
    expect(Object.keys(res.body.prices).length).toBeGreaterThanOrEqual(2);
  });

  test('filters by pairs param', async () => {
    const res = await request(app).get('/api/prices?pairs=XLM/USD,BTC/USD');
    expect(res.status).toBe(200);
    expect(res.body.prices['XLM/USD']).toBeDefined();
    expect(res.body.prices['BTC/USD']).toBeDefined();
  });

  test('returns empty for unknown pairs', async () => {
    const res = await request(app).get('/api/prices?pairs=UNKNOWN/USD');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.prices)).toHaveLength(0);
  });
});

// ── GET /api/prices/:assetPair ─────────────────────────────────────────────

describe('GET /api/prices/:assetPair', () => {
  test('returns price for known pair', async () => {
    const res = await request(app).get('/api/prices/XLM%2FUSD');
    expect(res.status).toBe(200);
    expect(res.body.assetPair).toBe('XLM/USD');
    expect(res.body.price).toBe(0.12);
    expect(res.body.confidence).toBeDefined();
    expect(res.body.sources).toContain('chainlink');
  });

  test('returns 404 for unknown pair', async () => {
    const res = await request(app).get('/api/prices/UNKNOWN%2FUSD');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ASSET_NOT_FOUND');
  });
});

// ── GET /api/prices/:assetPair/history ─────────────────────────────────────

describe('GET /api/prices/:assetPair/history', () => {
  test('returns history array', async () => {
    const res = await request(app).get('/api/prices/ETH%2FUSD/history');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.prices)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(5);
  });

  test('respects limit param', async () => {
    const res = await request(app).get('/api/prices/ETH%2FUSD/history?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.prices.length).toBeLessThanOrEqual(2);
  });

  test('returns empty history for unknown pair', async () => {
    const res = await request(app).get('/api/prices/UNKNOWN%2FUSD/history');
    expect(res.status).toBe(200);
    expect(res.body.prices).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });
});
