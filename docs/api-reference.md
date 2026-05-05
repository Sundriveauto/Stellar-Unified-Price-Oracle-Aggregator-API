# API Reference

## REST Endpoints

### Get Current Price

```
GET /api/prices/:assetPair
```

**Parameters:**
- `assetPair` (string, required) - Asset pair (e.g., "BTC/USD", "ETH/USD")

**Response:**
```json
{
  "assetPair": "BTC/USD",
  "price": 45000.50,
  "timestamp": 1234567890,
  "confidence": 0.99,
  "sources": ["chainlink", "redstone", "band"]
}
```

### Get Price History

```
GET /api/prices/:assetPair/history?limit=100&offset=0
```

**Parameters:**
- `assetPair` (string, required) - Asset pair
- `limit` (number, optional) - Number of records (default: 100)
- `offset` (number, optional) - Pagination offset (default: 0)

**Response:**
```json
{
  "assetPair": "BTC/USD",
  "prices": [
    {
      "price": 45000.50,
      "timestamp": 1234567890,
      "confidence": 0.99
    }
  ],
  "limit": 100,
  "offset": 0,
  "total": 1000
}
```

### Get Multiple Prices

```
GET /api/prices?pairs=BTC/USD,ETH/USD,XLM/USD
```

**Parameters:**
- `pairs` (string, required) - Comma-separated asset pairs

**Response:**
```json
{
  "prices": {
    "BTC/USD": {
      "price": 45000.50,
      "timestamp": 1234567890,
      "confidence": 0.99
    },
    "ETH/USD": {
      "price": 2500.25,
      "timestamp": 1234567890,
      "confidence": 0.98
    }
  }
}
```

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "ok"
}
```

## WebSocket

### Connect

```
ws://localhost:3000
```

### Subscribe to Price Updates

```json
{
  "action": "subscribe",
  "assetPairs": ["BTC/USD", "ETH/USD"]
}
```

### Unsubscribe

```json
{
  "action": "unsubscribe",
  "assetPairs": ["BTC/USD"]
}
```

### Price Update Message

```json
{
  "type": "price_update",
  "assetPair": "BTC/USD",
  "price": 45000.50,
  "timestamp": 1234567890,
  "confidence": 0.99
}
```

## Error Responses

### 404 Not Found

```json
{
  "error": "Asset pair not found",
  "code": "ASSET_NOT_FOUND"
}
```

### 400 Bad Request

```json
{
  "error": "Invalid asset pair format",
  "code": "INVALID_FORMAT"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```
