import axios from 'axios';
import { PriceSource, PricePoint } from './base';

/**
 * Reflector Oracle — native Stellar/Soroban price oracle.
 * Docs: https://reflector.network
 * Public API: https://data.reflector.network/api/v1/prices
 */

const REFLECTOR_ASSETS: Record<string, string> = {
  'XLM/USD': 'XLM',
  'BTC/USD': 'BTC',
  'ETH/USD': 'ETH',
  'USDC/USD': 'USDC',
  'SOL/USD': 'SOL',
};

export class ReflectorSource extends PriceSource {
  name = 'reflector';

  private readonly baseUrl =
    process.env.REFLECTOR_API_URL || 'https://data.reflector.network/api/v1';

  async fetchPrice(assetPair: string): Promise<PricePoint> {
    const asset = REFLECTOR_ASSETS[assetPair];
    if (!asset) throw new Error(`Reflector: unsupported pair ${assetPair}`);

    const { data } = await axios.get(`${this.baseUrl}/prices`, {
      params: { asset },
      timeout: 10_000,
    });

    const price = data?.price;
    const ts = data?.timestamp;
    if (!this.validatePrice(price)) throw new Error(`Invalid price from Reflector for ${assetPair}`);

    return { source: this.name, price, timestamp: ts, confidence: 0.98 };
  }

  async fetchPrices(assetPairs: string[]): Promise<Map<string, PricePoint>> {
    const supported = assetPairs.filter(p => REFLECTOR_ASSETS[p]);
    if (supported.length === 0) return new Map();

    const { data } = await axios.get(`${this.baseUrl}/prices`, { timeout: 10_000 });

    const result = new Map<string, PricePoint>();
    const entries: any[] = Array.isArray(data) ? data : data?.prices ?? [];

    for (const pair of supported) {
      const asset = REFLECTOR_ASSETS[pair];
      const entry = entries.find((e: any) => e.asset === asset || e.symbol === asset);
      if (entry && this.validatePrice(entry.price)) {
        result.set(pair, {
          source: this.name,
          price: entry.price,
          timestamp: entry.timestamp,
          confidence: 0.98,
        });
      }
    }
    return result;
  }
}
