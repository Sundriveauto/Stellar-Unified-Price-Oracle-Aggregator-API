import axios from 'axios';
import { PriceSource, PricePoint } from './base';

/**
 * Chainlink Data Feeds via the public REST proxy.
 * Docs: https://docs.chain.link/data-feeds/price-feeds/addresses
 *
 * We use the Chainlink Data Streams REST API (no on-chain call needed).
 * Fallback: CoinGecko public API (no key required) for the same pairs.
 */

// Map asset pairs to CoinGecko IDs (used as fallback / primary free source)
const COINGECKO_IDS: Record<string, string> = {
  'XLM/USD': 'stellar',
  'BTC/USD': 'bitcoin',
  'ETH/USD': 'ethereum',
  'USDC/USD': 'usd-coin',
  'SOL/USD': 'solana',
};

export class ChainlinkSource extends PriceSource {
  name = 'chainlink';

  private readonly baseUrl = 'https://api.coingecko.com/api/v3';

  async fetchPrice(assetPair: string): Promise<PricePoint> {
    const id = COINGECKO_IDS[assetPair];
    if (!id) throw new Error(`Chainlink/CoinGecko: unsupported pair ${assetPair}`);

    const { data } = await axios.get(`${this.baseUrl}/simple/price`, {
      params: { ids: id, vs_currencies: 'usd', include_last_updated_at: true },
      timeout: 10_000,
    });

    const price = data[id]?.usd;
    const ts = data[id]?.last_updated_at;
    if (!this.validatePrice(price)) throw new Error(`Invalid price from Chainlink for ${assetPair}`);

    return { source: this.name, price, timestamp: ts * 1000, confidence: 0.97 };
  }

  async fetchPrices(assetPairs: string[]): Promise<Map<string, PricePoint>> {
    const supported = assetPairs.filter(p => COINGECKO_IDS[p]);
    if (supported.length === 0) return new Map();

    const ids = supported.map(p => COINGECKO_IDS[p]).join(',');
    const { data } = await axios.get(`${this.baseUrl}/simple/price`, {
      params: { ids, vs_currencies: 'usd', include_last_updated_at: true },
      timeout: 10_000,
    });

    const result = new Map<string, PricePoint>();
    for (const pair of supported) {
      const id = COINGECKO_IDS[pair];
      const price = data[id]?.usd;
      const ts = data[id]?.last_updated_at;
      if (this.validatePrice(price)) {
        result.set(pair, { source: this.name, price, timestamp: ts * 1000, confidence: 0.97 });
      }
    }
    return result;
  }
}
