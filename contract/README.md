# Stellar Price Oracle - Soroban Contract

Soroban smart contract for on-chain price storage and retrieval.

## Features

- Admin-controlled price submission (single and batch)
- On-chain price history (up to 1000 entries per asset pair)
- Price scaled by 1e7 (7 decimal places)
- Confidence score in basis points (0–10000)
- Event emission on every price update

## Build

```bash
# Install wasm target
rustup target add wasm32-unknown-unknown

# Build
cargo build --target wasm32-unknown-unknown --release

# Optimised wasm output
ls target/wasm32-unknown-unknown/release/stellar_price_oracle.wasm
```

## Test

```bash
cargo test
```

## Deploy (Testnet)

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_price_oracle.wasm \
  --source <YOUR_ACCOUNT> \
  --network testnet
```

## Initialize

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <ADMIN_ACCOUNT> \
  --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS>
```

## Price Format

Prices are stored as `i128` scaled by **1e7**. For example:

| Human price | Stored value |
|-------------|-------------|
| $1.00       | 10_000_000  |
| $45,000.00  | 450_000_000_000_000 |
| $0.12345678 | 1_234_567   |

## Contract Interface

| Function | Description |
|----------|-------------|
| `initialize(admin)` | One-time setup |
| `set_admin(new_admin)` | Transfer admin |
| `get_admin()` | Query admin |
| `submit_price(submission)` | Submit single price |
| `submit_prices(submissions)` | Submit batch prices |
| `get_price(asset_pair)` | Get latest price |
| `get_all_prices()` | Get all latest prices |
| `get_price_history(asset_pair, limit)` | Get price history |
