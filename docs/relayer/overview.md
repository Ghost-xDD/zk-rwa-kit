# Relayer Overview

The Relayer is a backend service that bridges off-chain TLS proofs to on-chain credentials.

## What It Does

1. **Receives proofs** from the client SDK
2. **Validates** transcript format and extracted claims
3. **Submits transactions** to the ZkOracle contract
4. **Pays gas** on behalf of users
5. **Returns** transaction hashes for tracking

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Client SDK     │────▶│  Relayer        │────▶│  ZkOracle       │
│  (Browser)      │     │  (Node.js)      │     │  (Mantle)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     POST /submit-proof        ethers.js         submitClaim()
```

## Production Endpoint

The hosted relayer is available at:

```
https://zk-rwa-kitrelayer-production.up.railway.app
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/submit-proof` | Submit a proof for verification |
| GET | `/status/:txHash` | Check transaction status |
| GET | `/health` | Health check |
| POST | `/mint` | Mint test tokens (demo only) |

## Rate Limiting

The production relayer has rate limits:
- **10 requests** per minute per IP
- Returns `429` with `RATE_LIMITED` code when exceeded

## Security Model

::: warning
The relayer is **trusted** in the MVP architecture. It verifies proofs off-chain and has authority to write credentials on-chain.

In production, consider:
- Multiple independent relayers
- On-chain ZK verification
- Rate limiting and monitoring
:::

## Self-Hosting

See [Self-Hosting](/relayer/self-hosting) for running your own relayer.

## Next Steps

- [Endpoints](/relayer/endpoints) — Full API reference
- [Self-Hosting](/relayer/self-hosting) — Run your own relayer
