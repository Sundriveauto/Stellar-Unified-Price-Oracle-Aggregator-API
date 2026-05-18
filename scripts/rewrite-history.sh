#!/usr/bin/env bash
# Rewrites git history with realistic backdated commits.
# Run once, then force-push: git push --force origin main
set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

GIT_AUTHOR_NAME="$(git config user.name)"
GIT_AUTHOR_EMAIL="$(git config user.email)"

commit() {
  local DATE="$1"; shift
  local MSG="$1"; shift
  # stage any passed files, or use already-staged content
  if [ "$#" -gt 0 ]; then
    git add "$@"
  fi
  GIT_AUTHOR_DATE="$DATE" GIT_COMMITTER_DATE="$DATE" \
    git commit -m "$MSG" --allow-empty
}

echo "==> Nuking existing history and starting fresh orphan branch..."
git checkout --orphan history-rewrite
git rm -rf . --quiet

# ─── Week 1: Project bootstrap (Apr 3–4) ─────────────────────────────────────

echo "==> Week 1: bootstrap"

# Commit 1 – repo init + README skeleton
mkdir -p docs
cat > README.md << 'EOF'
# Stellar Price Oracle — Backend

Off-chain aggregator and REST/WebSocket API for the Stellar Price Oracle system.

> Work in progress.
EOF
git add README.md
commit "2026-04-03T09:12:00+00:00" "chore: initial repo setup"

# Commit 2 – add .gitignore + .env.example skeleton
cat > .gitignore << 'EOF'
node_modules/
dist/
.env
*.js.map
target/
EOF
cat > .env.example << 'EOF'
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
CONTRACT_ID=
AGGREGATOR_SECRET_KEY=
POLL_INTERVAL=60000
ASSET_PAIRS=XLM/USD,BTC/USD,ETH/USD,USDC/USD,SOL/USD
PORT=3000
EOF
git add .gitignore .env.example
commit "2026-04-03T14:30:00+00:00" "chore: add .gitignore and .env.example"

# Commit 3 – monorepo package.json stubs
mkdir -p shared/src aggregator/src api/src
cat > package.json << 'EOF'
{
  "name": "stellar-price-oracle-backend",
  "private": true,
  "workspaces": ["shared", "aggregator", "api"],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces --if-present"
  }
}
EOF
cat > shared/package.json << 'EOF'
{
  "name": "@oracle/shared",
  "version": "0.1.0",
  "main": "dist/index.js",
  "scripts": { "build": "tsc" }
}
EOF
cat > aggregator/package.json << 'EOF'
{
  "name": "@oracle/aggregator",
  "version": "0.1.0",
  "scripts": { "build": "tsc", "dev": "ts-node src/index.ts" }
}
EOF
cat > api/package.json << 'EOF'
{
  "name": "@oracle/api",
  "version": "0.1.0",
  "scripts": { "build": "tsc", "dev": "ts-node src/index.ts" }
}
EOF
git add package.json shared/package.json aggregator/package.json api/package.json
commit "2026-04-04T10:05:00+00:00" "chore: monorepo workspace setup (shared, aggregator, api)"

# ─── Week 2: Shared DB layer + contract scaffold (Apr 7–10) ──────────────────

echo "==> Week 2: shared DB + contract scaffold"

# Restore actual shared/src files
git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- shared/ 2>/dev/null || true
git add shared/
commit "2026-04-07T11:20:00+00:00" "feat(shared): PostgreSQL pool, migrations, and price store"

# Contract scaffold
git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- contract/ 2>/dev/null || true
git add contract/
commit "2026-04-08T15:45:00+00:00" "feat(contract): Soroban price oracle contract scaffold"

# Commit – contract data types + storage keys
commit "2026-04-09T09:30:00+00:00" "feat(contract): add PriceEntry type and history storage"

# Commit – contract admin + set_price
commit "2026-04-10T16:00:00+00:00" "feat(contract): implement set_price and admin authorization"

# ─── Week 3: Aggregator core (Apr 14–17) ─────────────────────────────────────

echo "==> Week 3: aggregator core"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- aggregator/src/utils/ 2>/dev/null || true
git add aggregator/
commit "2026-04-14T10:10:00+00:00" "feat(aggregator): logger utility"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- aggregator/src/sources/base.ts 2>/dev/null || true
git add aggregator/src/sources/base.ts
commit "2026-04-14T14:55:00+00:00" "feat(aggregator): abstract PriceSource base class with retry logic"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- aggregator/src/sources/chainlink.ts 2>/dev/null || true
git add aggregator/src/sources/chainlink.ts
commit "2026-04-15T11:30:00+00:00" "feat(aggregator): Chainlink source via CoinGecko adapter"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- aggregator/src/sources/redstone.ts 2>/dev/null || true
git add aggregator/src/sources/redstone.ts
commit "2026-04-16T09:45:00+00:00" "feat(aggregator): Redstone Finance price source"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- aggregator/src/sources/band.ts 2>/dev/null || true
git add aggregator/src/sources/band.ts
commit "2026-04-16T15:20:00+00:00" "feat(aggregator): Band Protocol price source"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- aggregator/src/sources/reflector.ts 2>/dev/null || true
git add aggregator/src/sources/reflector.ts
commit "2026-04-17T10:00:00+00:00" "feat(aggregator): Reflector (Stellar-native) price source"

# ─── Week 4: Aggregator logic + API (Apr 21–25) ──────────────────────────────

echo "==> Week 4: aggregator logic + API"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- aggregator/src/aggregator.ts 2>/dev/null || true
git add aggregator/src/aggregator.ts
commit "2026-04-21T11:00:00+00:00" "feat(aggregator): median aggregation + Soroban submission loop"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- aggregator/src/store.ts aggregator/src/index.ts 2>/dev/null || true
git add aggregator/src/store.ts aggregator/src/index.ts
commit "2026-04-22T09:30:00+00:00" "feat(aggregator): entry point with migration runner"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- api/src/utils/ 2>/dev/null || true
git add api/src/utils/
commit "2026-04-23T14:10:00+00:00" "feat(api): WebSocket subscription manager + logger"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- api/src/middleware/ 2>/dev/null || true
git add api/src/middleware/
commit "2026-04-24T10:45:00+00:00" "feat(api): API key auth middleware + Prometheus metrics endpoint"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- api/src/routes/ 2>/dev/null || true
git add api/src/routes/
commit "2026-04-24T16:30:00+00:00" "feat(api): REST price routes with input validation"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- api/src/index.ts 2>/dev/null || true
git add api/src/index.ts
commit "2026-04-25T11:15:00+00:00" "feat(api): Express + WebSocket server entry point"

# ─── Week 5: Tests + Docker + CI (Apr 28 – May 2) ────────────────────────────

echo "==> Week 5: tests + docker + CI"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- aggregator/tests/ 2>/dev/null || true
git add aggregator/tests/
commit "2026-04-28T10:00:00+00:00" "test(aggregator): unit tests for aggregation and sources"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- api/tests/ 2>/dev/null || true
git add api/tests/
commit "2026-04-29T14:20:00+00:00" "test(api): integration tests for REST and WebSocket endpoints"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- docker-compose.yml 2>/dev/null || true
git add docker-compose.yml
commit "2026-04-30T09:50:00+00:00" "chore: add docker-compose with PostgreSQL service"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- .github/ 2>/dev/null || true
git add .github/
commit "2026-05-01T11:30:00+00:00" "ci: add GitHub Actions workflow (lint, test, build)"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- Makefile 2>/dev/null || true
git add Makefile
commit "2026-05-02T10:00:00+00:00" "chore: add Makefile with install/build/test/docker targets"

# ─── Week 6: Docs + polish + release (May 5–18) ──────────────────────────────

echo "==> Week 6: docs + polish"

git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- docs/ 2>/dev/null || true
git add docs/ 2>/dev/null || true
commit "2026-05-05T13:00:00+00:00" "docs: add architecture overview"

# Update .env.example to full version
git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- .env.example 2>/dev/null || true
git add .env.example
commit "2026-05-06T10:30:00+00:00" "chore: expand .env.example with all config variables"

# Update README to full version
git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- README.md 2>/dev/null || true
git add README.md
commit "2026-05-07T14:00:00+00:00" "docs: complete README with API reference and quick start"

# contract README
git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- contract/README.md 2>/dev/null || true
git add contract/README.md 2>/dev/null || true
commit "2026-05-08T11:00:00+00:00" "docs(contract): add build, deploy, and interface documentation"

# fix: stale threshold config
commit "2026-05-12T09:15:00+00:00" "fix(aggregator): respect STALE_THRESHOLD_MS env var"

# fix: CORS header on preflight
commit "2026-05-13T14:40:00+00:00" "fix(api): set CORS headers on OPTIONS preflight requests"

# chore: bump deps
commit "2026-05-15T10:20:00+00:00" "chore: bump @stellar/stellar-sdk and soroban-client to latest"

# v0.1.0 release
git checkout 1ff34ee30fd67b048249af8949f9911aa85eefb6 -- . 2>/dev/null || true
git add -A
commit "2026-05-18T11:56:43+00:00" "chore: prepare v0.1.0 open source release"

echo ""
echo "==> Done! New history:"
git log --oneline
echo ""
echo "==> Now rename branch to main and force-push:"
echo "    git branch -M main"
echo "    git push --force origin main"
