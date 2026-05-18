# REST + WebSocket API

Express-based API for consuming price data from the oracle.

## Overview

Provides:
- REST endpoints for price queries
- WebSocket subscriptions for real-time updates
- Historical price data retrieval
- Batch price queries

## Setup

```bash
npm install
```

## Configuration

Create a `.env` file:

```env
PORT=3000
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
CONTRACT_ID=your-contract-id
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

## API Endpoints

### REST

- `GET /api/prices/:assetPair` - Get current price
- `GET /api/prices/:assetPair/history` - Get price history
- `GET /api/prices` - Get multiple prices
- `GET /health` - Health check

### WebSocket

Connect to `ws://localhost:3000` and subscribe to price updates.

## Testing

```bash
npm test
npm run test:watch
```
