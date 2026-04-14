export interface PricePoint {
  source: string;
  price: number;
  /** Unix milliseconds */
  timestamp: number;
  /** 0–1 confidence score */
  confidence: number;
}

const MAX_RETRIES = parseInt(process.env.SOURCE_MAX_RETRIES || '3', 10);
const RETRY_DELAY_MS = parseInt(process.env.SOURCE_RETRY_DELAY_MS || '1000', 10);

export abstract class PriceSource {
  abstract name: string;

  abstract fetchPrice(assetPair: string): Promise<PricePoint>;

  abstract fetchPrices(assetPairs: string[]): Promise<Map<string, PricePoint>>;

  /** Wrap fetchPrices with exponential-backoff retry. */
  async fetchPricesWithRetry(assetPairs: string[]): Promise<Map<string, PricePoint>> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.fetchPrices(assetPairs);
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * 2 ** attempt));
        }
      }
    }
    throw lastErr;
  }

  protected validatePrice(price: unknown): price is number {
    return typeof price === 'number' && !isNaN(price) && isFinite(price) && price > 0;
  }
}
