import { PriceAggregator } from '../src/aggregator';
import { priceStore } from '../src/store';

// Mock the pg pool so tests don't need a real database
jest.mock('../../shared/src/db', () => ({
  getPool: jest.fn(),
  runMigrations: jest.fn().mockResolvedValue(undefined),
}));

// In-memory store mock
const memStore = new Map<string, import('../../shared/src/store').PriceRecord>();
const memHistory = new Map<string, import('../../shared/src/store').PriceRecord[]>();

jest.mock('../../shared/src/store', () => ({
  priceStore: {
    set: jest.fn(async (r: import('../../shared/src/store').PriceRecord) => {
      memStore.set(r.assetPair, r);
      const h = memHistory.get(r.assetPair) ?? [];
      h.push(r);
      memHistory.set(r.assetPair, h);
    }),
    get: jest.fn(async (pair: string) => memStore.get(pair)),
    getAll: jest.fn(async () => Array.from(memStore.values())),
    getHistory: jest.fn(async (pair: string, limit = 100, offset = 0) => {
      const h = memHistory.get(pair) ?? [];
      return h.slice().reverse().slice(offset, offset + limit);
    }),
    historyCount: jest.fn(async (pair: string) => (memHistory.get(pair) ?? []).length),
  },
}));

function makeAggregator() {
  return new PriceAggregator({
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    contractId: '',
    secretKey: '',
    pollInterval: 999_999,
    assetPairs: ['XLM/USD', 'BTC/USD'],
  });
}

// ── median ─────────────────────────────────────────────────────────────────

describe('PriceAggregator.median', () => {
  const agg = makeAggregator();

  test('single value', () => { expect((agg as any).median([42])).toBe(42); });
  test('odd count', () => { expect((agg as any).median([3, 1, 2])).toBe(2); });
  test('even count', () => { expect((agg as any).median([1, 2, 3, 4])).toBe(2.5); });
  test('already sorted', () => { expect((agg as any).median([10, 20, 30])).toBe(20); });
  test('throws on empty', () => { expect(() => (agg as any).median([])).toThrow(); });
});

// ── priceStore (mocked) ────────────────────────────────────────────────────

describe('priceStore', () => {
  beforeEach(() => { memStore.clear(); memHistory.clear(); });

  test('set and get', async () => {
    await priceStore.set({ assetPair: 'XLM/USD', price: 0.15, timestamp: 2000, confidence: 0.95, sources: ['a'] });
    const r = await priceStore.get('XLM/USD');
    expect(r?.price).toBe(0.15);
  });

  test('get returns undefined for unknown pair', async () => {
    expect(await priceStore.get('UNKNOWN/USD')).toBeUndefined();
  });

  test('getAll returns all pairs', async () => {
    await priceStore.set({ assetPair: 'XLM/USD', price: 0.12, timestamp: 1000, confidence: 0.9, sources: [] });
    await priceStore.set({ assetPair: 'BTC/USD', price: 50000, timestamp: 1000, confidence: 0.99, sources: [] });
    const pairs = (await priceStore.getAll()).map(r => r.assetPair);
    expect(pairs).toContain('XLM/USD');
    expect(pairs).toContain('BTC/USD');
  });

  test('getHistory returns entries most-recent first', async () => {
    for (const [price, ts] of [[2000, 1000], [2100, 2000], [2200, 3000]] as [number, number][]) {
      await priceStore.set({ assetPair: 'ETH/USD', price, timestamp: ts, confidence: 0.9, sources: [] });
    }
    const hist = await priceStore.getHistory('ETH/USD', 2);
    expect(hist).toHaveLength(2);
    expect(hist[0].price).toBe(2200);
  });

  test('historyCount', async () => {
    await priceStore.set({ assetPair: 'SOL/USD', price: 100, timestamp: 1000, confidence: 0.9, sources: [] });
    await priceStore.set({ assetPair: 'SOL/USD', price: 110, timestamp: 2000, confidence: 0.9, sources: [] });
    expect(await priceStore.historyCount('SOL/USD')).toBeGreaterThanOrEqual(2);
  });
});
