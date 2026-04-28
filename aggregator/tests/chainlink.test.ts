import axios from 'axios';
import { ChainlinkSource } from '../src/sources/chainlink';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const MOCK_RESPONSE = {
  data: {
    stellar:  { usd: 0.12, last_updated_at: 1700000000 },
    bitcoin:  { usd: 45000, last_updated_at: 1700000000 },
    ethereum: { usd: 2500, last_updated_at: 1700000000 },
    'usd-coin': { usd: 1.0, last_updated_at: 1700000000 },
  },
};

describe('ChainlinkSource', () => {
  let source: ChainlinkSource;

  beforeEach(() => {
    source = new ChainlinkSource();
    jest.clearAllMocks();
  });

  test('name is chainlink', () => {
    expect(source.name).toBe('chainlink');
  });

  describe('fetchPrices', () => {
    test('returns prices for supported pairs', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue(MOCK_RESPONSE);

      const result = await source.fetchPrices(['XLM/USD', 'BTC/USD']);

      expect(result.size).toBe(2);
      expect(result.get('XLM/USD')?.price).toBe(0.12);
      expect(result.get('BTC/USD')?.price).toBe(45000);
    });

    test('sets source name and timestamp correctly', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue(MOCK_RESPONSE);

      const result = await source.fetchPrices(['XLM/USD']);
      const point = result.get('XLM/USD')!;

      expect(point.source).toBe('chainlink');
      expect(point.timestamp).toBe(1700000000 * 1000);
      expect(point.confidence).toBeGreaterThan(0);
      expect(point.confidence).toBeLessThanOrEqual(1);
    });

    test('skips unsupported pairs', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue(MOCK_RESPONSE);

      const result = await source.fetchPrices(['UNKNOWN/USD']);
      expect(result.size).toBe(0);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    test('skips pair when price is missing from response', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue({ data: { stellar: {} } });

      const result = await source.fetchPrices(['XLM/USD']);
      expect(result.size).toBe(0);
    });

    test('skips pair when price is zero', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue({
        data: { stellar: { usd: 0, last_updated_at: 1700000000 } },
      });

      const result = await source.fetchPrices(['XLM/USD']);
      expect(result.size).toBe(0);
    });

    test('throws on network error', async () => {
      mockedAxios.get = jest.fn().mockRejectedValue(new Error('Network error'));
      await expect(source.fetchPrices(['XLM/USD'])).rejects.toThrow('Network error');
    });
  });

  describe('fetchPrice', () => {
    test('returns a single price point', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue(MOCK_RESPONSE);

      const point = await source.fetchPrice('ETH/USD');
      expect(point.price).toBe(2500);
      expect(point.source).toBe('chainlink');
    });

    test('throws for unsupported pair', async () => {
      await expect(source.fetchPrice('UNKNOWN/USD')).rejects.toThrow('unsupported pair');
    });
  });

  describe('fetchPricesWithRetry', () => {
    test('retries on failure and succeeds', async () => {
      mockedAxios.get = jest.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(MOCK_RESPONSE);

      const result = await source.fetchPricesWithRetry(['XLM/USD']);
      expect(result.get('XLM/USD')?.price).toBe(0.12);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });
});
