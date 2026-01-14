# Relayer API Endpoints

## POST /submit-proof

Submit a TLS proof for verification and on-chain credential issuance.

### Request

```http
POST /submit-proof
Content-Type: application/json

{
  "walletAddress": "0x1234567890123456789012345678901234567890",
  "transcript": {
    "sent": "base64-encoded-request",
    "received": "base64-encoded-response",
    "serverName": "bank.example.com"
  },
  "claimType": "ELIGIBLE",
  "extractedValue": "true"
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | Ethereum address (0x...) |
| `transcript` | object | Yes | Verified TLS transcript |
| `transcript.sent` | string | Yes | Base64 request data |
| `transcript.received` | string | Yes | Base64 response data |
| `transcript.serverName` | string | Yes | Server hostname |
| `claimType` | string | Yes | Claim type (e.g., "ELIGIBLE") |
| `extractedValue` | string | No | Override extracted value |

### Success Response

```json
{
  "success": true,
  "txHash": "0xabc123...",
  "claimType": "ELIGIBLE",
  "claimValue": "true",
  "expiry": 1705420800
}
```

### Error Response

```json
{
  "success": false,
  "error": "Invalid wallet address format",
  "code": "INVALID_TRANSCRIPT"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `MISSING_FIELD` | 400 | Required field missing |
| `INVALID_TRANSCRIPT` | 400 | Transcript validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `CHAIN_ERROR` | 500/503 | On-chain transaction failed |
| `INTERNAL_ERROR` | 500 | Server error |

---

## GET /status/:txHash

Check the status of a submitted transaction.

### Request

```http
GET /status/0xabc123...
```

### Success Response

```json
{
  "status": "CONFIRMED",
  "blockNumber": 12345678
}
```

### Pending Response

```json
{
  "status": "PENDING"
}
```

### Failed Response

```json
{
  "status": "FAILED",
  "error": "Transaction reverted"
}
```

---

## GET /health

Check if the relayer is operational.

### Request

```http
GET /health
```

### Response

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "chain": {
    "rpc": "configured",
    "oracle": "configured",
    "token": "configured"
  }
}
```

---

## POST /mint

Mint test tokens for demo purposes.

::: warning
This endpoint is for demos only and may not be available in production.
:::

### Request

```http
POST /mint
Content-Type: application/json

{
  "walletAddress": "0x1234567890123456789012345678901234567890",
  "amount": "1000"
}
```

### Response

```json
{
  "success": true,
  "txHash": "0xdef456...",
  "amount": "1000000000000000000000"
}
```

---

## cURL Examples

### Submit Proof

```bash
curl -X POST https://zk-rwa-kitrelayer-production.up.railway.app/submit-proof \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "transcript": {
      "sent": "...",
      "received": "...",
      "serverName": "bank.example.com"
    },
    "claimType": "ELIGIBLE",
    "extractedValue": "true"
  }'
```

### Check Status

```bash
curl https://zk-rwa-kitrelayer-production.up.railway.app/status/0xabc123...
```

### Health Check

```bash
curl https://zk-rwa-kitrelayer-production.up.railway.app/health
```

## Next Steps

- [Self-Hosting](/relayer/self-hosting) — Run your own relayer
- [SDK Submission](/sdk/proof-submission) — Use the SDK wrapper
