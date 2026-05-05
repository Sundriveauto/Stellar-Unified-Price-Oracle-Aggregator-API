# Architecture Overview

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Stellar Blockchain                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Soroban Price Oracle Contract (Rust)                │   │
│  │  - initialize(admin)                                 │   │
│  │  - submit_price(submission)                          │   │
│  │  - submit_prices(submissions[])  ← batch             │   │
│  │  - get_price(asset_pair)                             │   │
│  │  - get_all_prices()                                  │   │
│  │  - get_price_history(asset_pair, limit)              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ submit_prices (batch tx)
                            │
┌─────────────────────────────────────────────────────────────┐
│              Off-Chain Aggregator Service (Node.js)          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Price Sources (parallel fetch)                      │   │
│  │  ├── ChainlinkSource  → CoinGecko REST API           │   │
│  │  ├── RedstoneSource   → Redstone Finance API         │   │
│  │  ├── BandSource       → Band Protocol REST API       │   │
│  │  └── ReflectorSource  → Reflector Network API        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Aggregation Engine                                  │   │
│  │  - Fetch all sources in parallel (Promise.allSettled)│   │
│  │  - Compute median across available sources           │   │
│  │  - Confidence = avg(source confidences) × 10000      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  In-Memory Price Store (shared singleton)            │   │
│  │  - Latest price per pair                             │   │
│  │  - History ring buffer (1000 entries/pair)           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ reads priceStore
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    REST + WebSocket API (Express)            │
│                                                              │
│  REST                                                        │
│  ├── GET /health                                             │
│  ├── GET /api/prices[?pairs=...]                             │
│  ├── GET /api/prices/:pair                                   │
│  └── GET /api/prices/:pair/history[?limit&offset]            │
│                                                              │
│  WebSocket (ws://host:3000)                                  │
│  ├── subscribe   { action, assetPairs[] }                    │
│  ├── unsubscribe { action, assetPairs[] }                    │
│  └── broadcast   price_update every WS_BROADCAST_INTERVAL   │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Collection** — Aggregator polls all 4 sources in parallel every `POLL_INTERVAL` ms.
2. **Aggregation** — Median computed across successful source responses.
3. **Store** — Result written to in-memory `priceStore` (shared with API process via import).
4. **Submission** — Batch `submit_prices` call sent to Soroban contract (signed with `AGGREGATOR_SECRET_KEY`).
5. **API** — REST endpoints read directly from `priceStore`; WebSocket manager broadcasts on interval.

## Price Encoding

On-chain prices are stored as `i128` scaled by **1e7** to avoid floating-point:

```
stored_value = round(human_price × 10_000_000)
```

Off-chain (API responses) prices are plain `number` (float).

## Fault Tolerance

- Source failures are caught individually; aggregation proceeds with remaining sources.
- Soroban submission failures are logged but do not crash the aggregator.
- API returns stale in-memory data if the aggregator is temporarily down.

## Security

- Only the admin address (set at `initialize`) can submit prices to the contract.
- `AGGREGATOR_SECRET_KEY` must be kept secret and never committed.
- API is read-only — no write endpoints exposed.
