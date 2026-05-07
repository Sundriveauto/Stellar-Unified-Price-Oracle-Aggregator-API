# Stellar Price Oracle — Backend

Off-chain aggregator service and REST + WebSocket API for the Stellar Price Oracle system.

## Overview

| Component | Description |
|-----------|-------------|
| **Aggregator** | Polls Chainlink, Redstone, Band, and Reflector; computes median price; submits to Soroban contract |
| **API** | REST + WebSocket server for consuming price data |
| **Contract** | Soroban smart contract (Rust) for on-chain price storage |

## Project Structure

```
.
├── shared/
│   └── src/
│       ├── db.ts               PostgreSQL pool + migrations
│       └── store.ts            Shared pg-backed price store
├── aggregator/
│   ├── src/
│   │   ├── index.ts            Entry point (runs migrations)
│   │   ├── aggregator.ts       Polling loop + median aggregation + Soroban submission
│   │   ├── store.ts            Re-exports shared store
│   │   ├── sources/
│   │   │   ├── base.ts         Abstract PriceSource (with retry)
│   │   │   ├── chainlink.ts    Chainlink / CoinGecko
│   │   │   ├── redstone.ts     Redstone Finance
│   │   │   ├── band.ts         Band Protocol
│   │   │   └── reflector.ts    Reflector (Stellar-native)
│   │   └── utils/logger.ts
│   └── tests/aggregator.test.ts
├── api/
│   ├── src/
│   │   ├── index.ts            Express + WebSocket server
│   │   ├── routes/prices.ts    REST price endpoints (validated)
│   │   ├── middleware/
│   │   │   ├── auth.ts         API key authentication
│   │   │   └── metrics.ts      Prometheus-style /metrics
│   │   └── utils/
│   │       ├── subscriptions.ts  WebSocket subscription manager
│   │       └── logger.ts
│   └── tests/api.test.ts
├── contract/
│   ├── Cargo.toml
│   ├── src/lib.rs              Soroban contract
│   └── README.md
├── docs/
├── .github/workflows/ci.yml   CI pipeline
├── docker-compose.yml          Includes PostgreSQL service
├── Makefile
└── .env.example
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (optional)
- Rust + `wasm32-unknown-unknown` target (for contract)

### Install & Run

```bash
# Install dependencies
make install

# Copy and configure environment
cp .env.example .env

# Build
make build

# Run tests
make test

# Start API (development)
cd api && npm run dev

# Start aggregator (development, separate terminal)
cd aggregator && npm run dev
```

### Docker

```bash
cp .env.example .env
# Edit .env with your CONTRACT_ID and AGGREGATOR_SECRET_KEY

make docker-build
make docker-up
# API available at http://localhost:3000

make docker-down
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SOROBAN_RPC_URL` | testnet | Soroban RPC endpoint |
| `CONTRACT_ID` | — | Deployed contract address |
| `AGGREGATOR_SECRET_KEY` | — | Stellar secret key for submissions |
| `POLL_INTERVAL` | `60000` | Aggregation interval (ms) |
| `ASSET_PAIRS` | `XLM/USD,...` | Comma-separated pairs to track |
| `PORT` | `3000` | API server port |
| `WS_BROADCAST_INTERVAL` | `5000` | WebSocket push interval (ms) |
| `REFLECTOR_API_URL` | reflector.network | Reflector API base URL |

## API

### REST

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/prices` | All latest prices (or `?pairs=XLM/USD,BTC/USD`) |
| `GET` | `/api/prices/:pair` | Single pair (URL-encode `/` → `%2F`) |
| `GET` | `/api/prices/:pair/history` | History (`?limit=100&offset=0`) |

### WebSocket

Connect to `ws://localhost:3000`, then send JSON:

```json
{ "action": "subscribe", "assetPairs": ["XLM/USD", "BTC/USD"] }
{ "action": "unsubscribe", "assetPairs": ["BTC/USD"] }
```

Receive:
```json
{ "type": "price_update", "assetPair": "XLM/USD", "price": 0.12, "timestamp": 1700000000000, "confidence": 0.95, "sources": ["chainlink", "redstone"] }
```

## Smart Contract

See [contract/README.md](contract/README.md) for build, deploy, and interface docs.

```bash
# Build contract
make contract-build

# Test contract
make contract-test
```

## Architecture

See [docs/architecture.md](docs/architecture.md).

## Roadmap

- [x] Chainlink source integration (via CoinGecko)
- [x] Redstone source integration
- [x] Band Protocol source integration
- [x] Reflector source integration
- [x] Median price aggregation
- [x] Soroban contract submission
- [x] Historical data storage (in-memory)
- [x] WebSocket subscriptions
- [ ] Persistent database (PostgreSQL)
- [ ] Rate limiting
- [ ] Monitoring / alerting

## License

See LICENSE file for details.
