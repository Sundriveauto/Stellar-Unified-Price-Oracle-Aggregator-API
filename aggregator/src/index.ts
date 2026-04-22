import dotenv from 'dotenv';
import { PriceAggregator } from './aggregator';
import { runMigrations } from '../../shared/src/db';
import { logger } from './utils/logger';

dotenv.config();

const DEFAULT_PAIRS = ['XLM/USD', 'BTC/USD', 'ETH/USD', 'USDC/USD'];

async function main() {
  logger.info('Starting Stellar Price Aggregator...');

  await runMigrations();
  logger.info('Database migrations complete');

  const aggregator = new PriceAggregator({
    sorobanRpcUrl: process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
    contractId: process.env.CONTRACT_ID || '',
    secretKey: process.env.AGGREGATOR_SECRET_KEY || '',
    pollInterval: parseInt(process.env.POLL_INTERVAL || '60000', 10),
    assetPairs: (process.env.ASSET_PAIRS || DEFAULT_PAIRS.join(',')).split(',').map(s => s.trim()),
  });

  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await aggregator.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await aggregator.stop();
    process.exit(0);
  });

  await aggregator.start();
}

main().catch(err => {
  logger.error('Fatal error', err);
  process.exit(1);
});
