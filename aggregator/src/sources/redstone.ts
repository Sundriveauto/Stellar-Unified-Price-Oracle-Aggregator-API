import axios from 'axios';
import { PriceSource, PricePoint } from './base';

/**
 * Redstone Finance public price API.
 * Docs: https://docs.redstone.finance/docs/get-started/data-formatting-processing
 * Public endpoint: https://api.redstone.finance/prices
 */

const REDSTONE_SYMBOLS: Record<string, string> = {
  'XLM/USD': 'XLM',
  'BTC/USD': 'BTC',
  'ETH/USD': 'ETH',
  'USDC/USD': 'USDC',
  'SOL/USD': 'SOL',
};

export class RedstoneSource extends PriceSource {
  name = 'redstone';

  private readonly baseUrl = 'https://api.redstone.finance';

  async fetchPrice(assetPair: string): Promise<PricePoint> {
    const symbol = REDSTONE_SYMBOLS[assetPair];
    if (!symbol) throw new Error(`Redstone: unsupported pair ${assetPair}`);

    const { data } = await axios.get(`${this.baseUrl}/prices`, {
      params: { symbol, provider: 'redstone' },
      timeout: 10_000,
    });

    const price = data?.value;
    const ts = data?.timestamp;
    if (!this.validatePrice(price)) throw new Error(`Invalid price from Redstone for ${assetPair}`);

    return { source: this.name, price, timestamp: ts, confidence: 0.95 };
  }

  async fetchPrices(assetPairs: string[]): Promise<Map<string, PricePoint>> {
    const supported = assetPairs.filter(p => REDSTONE_SYMBOLS[p]);
    if (supported.length === 0) return new Map();

    const symbols = supported.map(p => REDSTONE_SYMBOLS[p]).join(',');
    const { data } = await axios.get(`${this.baseUrl}/prices`, {
      params: { symbols, provider: 'redstone' },
      timeout: 10_000,
    });

    const result = new Map<string, PricePoint>();
    for (const pair of supported) {
      const symbol = REDSTONE_SYMBOLS[pair];
      const entry = Array.isArray(data) ? data.find((d: any) => d.symbol === symbol) : data[symbol];
      if (entry && this.validatePrice(entry.value)) {
        result.set(pair, {
          source: this.name,
          price: entry.value,
          timestamp: entry.timestamp,
          confidence: 0.95,
        });
      }
    }
    return result;
  }
}
