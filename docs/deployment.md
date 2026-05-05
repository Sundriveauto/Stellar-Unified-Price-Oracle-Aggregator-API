# Deployment Guide

## Prerequisites

- Node.js 20+
- Rust + `wasm32-unknown-unknown` target (for contract)
- Stellar CLI (`stellar`)

## 1. Deploy the Soroban Contract

```bash
# Install Rust wasm target
rustup target add wasm32-unknown-unknown

# Build
cd contract
cargo build --target wasm32-unknown-unknown --release

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_price_oracle.wasm \
  --source <YOUR_ACCOUNT> \
  --network testnet

# Note the CONTRACT_ID from the output, then initialize:
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <ADMIN_ACCOUNT> \
  --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS>
```

## 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
CONTRACT_ID=<from step 1>
AGGREGATOR_SECRET_KEY=<Stellar secret key of admin account>
POLL_INTERVAL=60000
ASSET_PAIRS=XLM/USD,BTC/USD,ETH/USD,USDC/USD,SOL/USD
PORT=3000
WS_BROADCAST_INTERVAL=5000
```

## 3. Run with Docker (recommended)

```bash
make docker-build
make docker-up

# API available at http://localhost:3000
# Logs:
docker-compose logs -f
```

## 4. Run Locally

```bash
make install

# Terminal 1 — API
cd api && npm run dev

# Terminal 2 — Aggregator
cd aggregator && npm run dev
```

## 5. Verify

```bash
# Health check
curl http://localhost:3000/health

# Latest prices
curl http://localhost:3000/api/prices

# Single pair
curl http://localhost:3000/api/prices/XLM%2FUSD

# History
curl "http://localhost:3000/api/prices/XLM%2FUSD/history?limit=10"
```

## Production Checklist

- [ ] Use mainnet `SOROBAN_RPC_URL`
- [ ] Secure `AGGREGATOR_SECRET_KEY` (use secrets manager)
- [ ] Add rate limiting (nginx or express-rate-limit)
- [ ] Set up monitoring (health endpoint + alerting)
- [ ] Configure log aggregation
- [ ] Replace in-memory store with PostgreSQL for persistence
