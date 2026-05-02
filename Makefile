.PHONY: help install build test lint format clean dev docker-build docker-up docker-down contract-build contract-test

help:
	@echo "Available commands:"
	@echo "  make install         Install all Node.js dependencies"
	@echo "  make build           Build aggregator and API"
	@echo "  make test            Run all tests"
	@echo "  make lint            Run linters"
	@echo "  make format          Format code"
	@echo "  make clean           Remove build artifacts"
	@echo "  make docker-build    Build Docker images"
	@echo "  make docker-up       Start Docker containers"
	@echo "  make docker-down     Stop Docker containers"
	@echo "  make contract-build  Build Soroban contract (requires Rust)"
	@echo "  make contract-test   Test Soroban contract (requires Rust)"

install:
	cd shared && npm install
	cd aggregator && npm install
	cd api && npm install

build:
	cd aggregator && npm run build
	cd api && npm run build

test:
	cd aggregator && npm test
	cd api && npm test

lint:
	cd aggregator && npm run lint
	cd api && npm run lint

format:
	cd aggregator && npm run format
	cd api && npm run format

clean:
	rm -rf shared/node_modules
	rm -rf aggregator/dist aggregator/node_modules
	rm -rf api/dist api/node_modules

dev:
	@echo "Start aggregator:  cd aggregator && npm run dev"
	@echo "Start API:         cd api && npm run dev"

docker-build:
	docker-compose build

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

contract-build:
	cd contract && cargo build --target wasm32-unknown-unknown --release

contract-test:
	cd contract && cargo test
