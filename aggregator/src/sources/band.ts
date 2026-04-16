import axios from 'axios';
import { PriceSource, PricePoint } from './base';

/**
 * Band Protocol public REST oracle.
 * Docs: https://docs.bandchain.org/develop/api-endpoints
 * Endpoint: https://laozi1.bandchain.org/api/oracle/v1/request_prices
 */

const BAND_SYMBOLS: Record<string, [string, string]> = {
  'XLM/USD': ['XLM', 'USD'],
  'BTC/USD': ['BTC', 'USD'],
  'ETH/USD': ['ETH', 'USD'],
  'USDC/USD': ['USDC', 'USD'],
  'SOL/USD': ['SOL', 'USD'],
};

export class BandSource extends PriceSource {
  name = 'band';

  private readonly baseUrl = 'https://laozi1.bandchain.org/api/oracle/v1';

  async fetchPrice(assetPair: string): Promise<PricePoint> {
    const symbols = BAND_SYMBOLS[assetPair];
    if (!symbols) throw new Error(`Band: unsupported pair ${assetPair}`);

    const { data } = await axios.get(`${this.baseUrl}/request_prices`, {
      params: { symbols: symbols[0], min_count: 3, ask_count: 4 },
      timeout: 10_000,
    });

    const result = data?.price_results?.[0];
    if (!result) throw new Error(`Band: no result for ${assetPair}`);

    // Band returns multiplier and px as integers; price = px / multiplier
    const price = Number(result.px) / Number(result.multiplier);
    if (!this.validatePrice(price)) throw new Error(`Invalid price from Band for ${assetPair}`);

    return {
      source: this.name,
      price,
      timestamp: Number(result.resolve_time) * 1000,
      confidence: 0.93,
    };
  }

  async fetchPrices(assetPairs: string[]): Promise<Map<string, PricePoint>> {
    const supported = assetPairs.filter(p => BAND_SYMBOLS[p]);
    if (supported.length === 0) return new Map();

    const symbolList = supported.map(p => BAND_SYMBOLS[p][0]).join(',');
    const { data } = await axios.get(`${this.baseUrl}/request_prices`, {
      params: { symbols: symbolList, min_count: 3, ask_count: 4 },
      timeout: 10_000,
    });

    const result = new Map<string, PricePoint>();
    const priceResults: any[] = data?.price_results ?? [];

    for (const pair of supported) {
      const sym = BAND_SYMBOLS[pair][0];
      const entry = priceResults.find((r: any) => r.symbol === sym);
      if (entry) {
        const price = Number(entry.px) / Number(entry.multiplier);
        if (this.validatePrice(price)) {
          result.set(pair, {
            source: this.name,
            price,
            timestamp: Number(entry.resolve_time) * 1000,
            confidence: 0.93,
          });
        }
      }
    }
    return result;
  }
}
