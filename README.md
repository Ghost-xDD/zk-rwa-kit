# Zk-RWA-Kit

> **Privacy-preserving, just-in-time compliance for Real World Assets on Mantle**

[![npm version](https://img.shields.io/npm/v/@zk-rwa-kit/client-sdk?style=flat&color=0a0a0a)](https://www.npmjs.com/package/@zk-rwa-kit/client-sdk)
[![Mantle Sepolia](https://img.shields.io/badge/Mantle-Sepolia-0a0a0a?style=flat)](https://sepolia.mantlescan.xyz)
[![License: MIT](https://img.shields.io/badge/License-MIT-0a0a0a?style=flat)](https://opensource.org/licenses/MIT)

**[Documentation](https://zk-rwa-kit-docs.vercel.app)** · **[Live Demo](https://zk-rwa-kit-yield.vercel.app)** · **[npm Package](https://www.npmjs.com/package/@zk-rwa-kit/client-sdk)**

---

Zk-RWA-Kit is an infrastructure SDK that converts private eligibility proofs into temporary on-chain credentials. Compliant assets can move freely among verified participants without permanent public allowlists.

## Why This Exists

Real World Assets on-chain today force a trade-off between privacy and composability:

- **Users** must permanently link their wallet to KYC flows, doxxing their entire on-chain history
- **Developers** struggle with ERC-3643-style tokens that break standard DeFi integrations
- **Protocols** lack plug-and-play tooling for privacy-preserving compliance

Zk-RWA-Kit solves this with **Session Credentials** — 24-hour on-chain credentials that expire automatically. No permanent KYC flags. No broken composability.

## Installation

```bash
npm install @zk-rwa-kit/client-sdk
```

## Usage

```typescript
import {
  proveEligibility,
  submitProof,
  CLAIM_TYPES,
} from '@zk-rwa-kit/client-sdk';

// Generate proof in browser (TLSNotary MPC-TLS)
const { transcript } = await proveEligibility();

// Submit to relayer → writes on-chain credential
const { txHash } = await submitProof(walletAddress, transcript, {
  claimType: CLAIM_TYPES.ELIGIBLE,
});

// User now has a 24-hour SessionCredential on Mantle
```

> **Browser Requirement:** TLS proofs require `SharedArrayBuffer`. Your app must serve COOP/COEP headers. See [documentation](https://zk-rwa-kit-docs.vercel.app/getting-started/quick-start#browser-requirements).

## How It Works

```
Generate Proof          Verify + Issue          Compliant DeFi
    (SDK)          →      (Relayer)       →      (On-Chain)
       │                      │                      │
  TLSNotary              Off-chain            SessionCredential
  MPC-TLS               verification            valid 24h
```

1. User authenticates to an eligibility source
2. SDK generates a TLSNotary proof with selective disclosure
3. Relayer verifies the proof and writes an expiring credential on-chain
4. Tokens and protocols check the credential before transfers

## Architecture

```
packages/
├── client-sdk/         # @zk-rwa-kit/client-sdk — proof generation + submission
├── contracts/          # Solidity — IdentityRegistry, ZkOracle, RWAToken
└── relayer/            # Express — proof verification + chain writer

services/
├── prover-server/      # Rust — TLSNotary notary service
└── mock-bank/          # Node — demo eligibility source

examples/
├── token-transfer/     # Reference dApp — compliant token transfers
└── yield-vault/        # Reference dApp — compliant ERC-4626 vault
```

## Live Deployments

| Service            | Endpoint                                              |
| ------------------ | ----------------------------------------------------- |
| Documentation      | https://zk-rwa-kit-docs.vercel.app                    |
| Token Demo         | https://zk-rwa-kit-token.vercel.app                   |
| Vault Demo         | https://zk-rwa-kit-yield.vercel.app                   |
| Prover (WebSocket) | `wss://zk-rwa-prover-production.up.railway.app/prove` |
| Relayer (API)      | `https://zk-rwa-kitrelayer-production.up.railway.app` |

## Contracts (Mantle Sepolia)

| Contract         | Address                                      |
| ---------------- | -------------------------------------------- |
| IdentityRegistry | `0x58698a19006443eD2e9F1e4284Bd0c341B1a5A12` |
| mUSDY            | `0x1AFF98321D111A555F56FE977B3cBc01704FECBF` |
| mYieldVault      | `0xc7effA35eFFE2d1EaB90B3107927CaBeE4258170` |

## Local Development

```bash
git clone https://github.com/Ghost-xDD/zk-rwa-kit.git
cd zk-rwa-kit

cp env.example .env
pnpm install
pnpm build

# Run services
pnpm dev:relayer          # Terminal 1
pnpm dev:mock-bank        # Terminal 2
cd services/prover-server && cargo run   # Terminal 3
cd examples/yield-vault && pnpm dev      # Terminal 4
```

## Security

- Relayer is trusted in the MVP architecture (off-chain verification)
- Session credentials auto-expire after 24 hours
- Future: on-chain ZK verification

## Documentation

- [Getting Started](https://zk-rwa-kit-docs.vercel.app/getting-started/introduction)
- [SDK Reference](https://zk-rwa-kit-docs.vercel.app/sdk/overview)
- [Smart Contracts](https://zk-rwa-kit-docs.vercel.app/contracts/overview)
- [Relayer API](https://zk-rwa-kit-docs.vercel.app/relayer/overview)

## License

MIT
