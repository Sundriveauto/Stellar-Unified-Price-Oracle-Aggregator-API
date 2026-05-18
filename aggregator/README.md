# Off-Chain Aggregator Service

TypeScript/Node service that polls oracle sources and submits aggregated prices to the Soroban contract.

## Overview

This service:
- Polls multiple oracle sources (Chainlink, Redstone, Band, Reflector)
- Aggregates prices using configurable algorithms
- Submits data to the Soroban contract
- Handles retries and error recovery

## Setup

```bash
npm install
```

## Configuration

Create a `.env` file:

```env
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
CONTRACT_ID=your-contract-id
POLL_INTERVAL=60000
LOG_LEVEL=info
```

## Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Testing

```bash
npm test
npm run test:watch
```

## Architecture

- `sources/` - Oracle source implementations
- `aggregator.ts` - Main aggregation logic
- `utils/` - Helper utilities
