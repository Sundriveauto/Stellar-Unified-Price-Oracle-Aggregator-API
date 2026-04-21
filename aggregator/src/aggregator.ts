import * as StellarSdk from '@stellar/stellar-sdk';
import { PriceSource } from './sources/base';
import { ChainlinkSource } from './sources/chainlink';
import { RedstoneSource } from './sources/redstone';
import { BandSource } from './sources/band';
import { ReflectorSource } from './sources/reflector';
import { priceStore } from './store';
import { logger } from './utils/logger';

export interface AggregatorConfig {
  sorobanRpcUrl: string;
  contractId: string;
  secretKey: string;
  pollInterval: number;
  assetPairs: string[];
}

/** Price scaled by 1e7 for on-chain storage. */
const PRICE_SCALE = 10_000_000n;

export class PriceAggregator {
  private config: AggregatorConfig;
  private sources: PriceSource[];
  private isRunning = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: AggregatorConfig) {
    this.config = config;
    this.sources = [
      new ChainlinkSource(),
      new RedstoneSource(),
      new BandSource(),
      new ReflectorSource(),
    ];
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('Aggregator started', { pairs: this.config.assetPairs });
    await this.poll();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) clearTimeout(this.timer);
    logger.info('Aggregator stopped');
  }

  // ── Core loop ──────────────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    if (!this.isRunning) return;
    try {
      await this.aggregateAndSubmit();
    } catch (err) {
      logger.error('Aggregation cycle failed', err);
    }
    this.timer = setTimeout(() => this.poll(), this.config.pollInterval);
  }

  private async aggregateAndSubmit(): Promise<void> {
    const results = await this.fetchAllPrices();
    if (results.size === 0) {
      logger.warn('No prices fetched from any source');
      return;
    }

    const submissions: Array<{
      assetPair: string;
      price: bigint;
      timestamp: bigint;
      confidence: number;
      sources: number;
    }> = [];

    for (const [pair, points] of results) {
      if (points.length === 0) continue;

      const aggregated = this.median(points.map(p => p.price));
      const confidence = Math.round(
        (points.reduce((s, p) => s + p.confidence, 0) / points.length) * 10_000,
      );
      const timestamp = Math.max(...points.map(p => p.timestamp));

      // Persist to database (shared with API).
      await priceStore.set({
        assetPair: pair,
        price: aggregated,
        timestamp,
        confidence: confidence / 10_000,
        sources: points.map(p => p.source),
      });

      submissions.push({
        assetPair: pair,
        price: BigInt(Math.round(aggregated * Number(PRICE_SCALE))),
        timestamp: BigInt(Math.floor(timestamp / 1000)),
        confidence,
        sources: points.length,
      });

      logger.info(`Aggregated ${pair}`, {
        price: aggregated,
        sources: points.length,
        confidence,
      });
    }

    if (submissions.length > 0 && this.config.contractId && this.config.secretKey) {
      await this.submitToContract(submissions);
    }
  }

  // ── Price fetching ─────────────────────────────────────────────────────────

  private async fetchAllPrices(): Promise<Map<string, Array<{ price: number; confidence: number; timestamp: number; source: string }>>> {
    const result = new Map<string, Array<{ price: number; confidence: number; timestamp: number; source: string }>>();

    const fetches = this.sources.map(async source => {
      try {
        const prices = await source.fetchPricesWithRetry(this.config.assetPairs);
        for (const [pair, point] of prices) {
          if (!result.has(pair)) result.set(pair, []);
          result.get(pair)!.push(point);
        }
      } catch (err) {
        logger.warn(`Source ${source.name} failed after retries`, err);
      }
    });

    await Promise.allSettled(fetches);
    return result;
  }

  // ── Aggregation algorithm ──────────────────────────────────────────────────

  /** Compute the median of an array of numbers. */
  median(values: number[]): number {
    if (values.length === 0) throw new Error('Cannot compute median of empty array');
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  // ── Soroban submission ─────────────────────────────────────────────────────

  private async submitToContract(
    submissions: Array<{
      assetPair: string;
      price: bigint;
      timestamp: bigint;
      confidence: number;
      sources: number;
    }>,
  ): Promise<void> {
    try {
      const server = new StellarSdk.SorobanRpc.Server(this.config.sorobanRpcUrl);
      const keypair = StellarSdk.Keypair.fromSecret(this.config.secretKey);
      const account = await server.getAccount(keypair.publicKey());

      const contract = new StellarSdk.Contract(this.config.contractId);

      // Build submission XDR values.
      const submissionArgs = submissions.map(s =>
        StellarSdk.nativeToScVal({
          asset_pair: s.assetPair,
          price: s.price,
          timestamp: s.timestamp,
          confidence: s.confidence,
          sources: s.sources,
        }),
      );

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            'submit_prices',
            StellarSdk.nativeToScVal(submissionArgs, { type: 'vec' }),
          ),
        )
        .setTimeout(30)
        .build();

      const prepared = await server.prepareTransaction(tx);
      prepared.sign(keypair);

      const response = await server.sendTransaction(prepared);
      logger.info('Submitted prices to contract', { hash: response.hash, count: submissions.length });

      // Wait for confirmation.
      await this.waitForConfirmation(server, response.hash);
    } catch (err) {
      logger.error('Failed to submit to Soroban contract', err);
    }
  }

  private async waitForConfirmation(
    server: StellarSdk.SorobanRpc.Server,
    hash: string,
    retries = 10,
  ): Promise<void> {
    for (let i = 0; i < retries; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const result = await server.getTransaction(hash);
      if (result.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        logger.info('Transaction confirmed', { hash });
        return;
      }
      if (result.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.FAILED) {
        logger.error('Transaction failed', { hash });
        return;
      }
    }
    logger.warn('Transaction confirmation timeout', { hash });
  }
}
