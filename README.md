<p align="center">
  <img src="https://raw.githubusercontent.com/Ghost-xDD/zk-rwa-kit/main/docs/public/logo.svg" width="60" alt="Zk-RWA-Kit" />
</p>

<h1 align="center">Zk-RWA-Kit</h1>

<p align="center">
  Privacy-preserving compliance for Real World Assets on Mantle.<br/>
  <strong>Session credentials that expire — not permanent allowlists.</strong>
</p>

<p align="center">
  <a href="https://zk-rwa-kit-docs.vercel.app">Documentation</a> ·
  <a href="https://zk-rwa-kit-yield.vercel.app">Live Demo</a> ·
  <a href="https://www.npmjs.com/package/@zk-rwa-kit/client-sdk">npm</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zk-rwa-kit/client-sdk"><img src="https://img.shields.io/npm/v/@zk-rwa-kit/client-sdk?style=flat-square&labelColor=000&color=000" alt="npm" /></a>
  <a href="https://sepolia.mantlescan.xyz"><img src="https://img.shields.io/badge/chain-Mantle_Sepolia-000?style=flat-square&labelColor=000" alt="Mantle" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-000?style=flat-square&labelColor=000" alt="MIT" /></a>
</p>

---

## Overview

Zk-RWA-Kit converts private eligibility proofs into temporary on-chain credentials. Users prove compliance once, receive a 24-hour session credential, and interact with DeFi protocols freely — without permanent KYC flags or broken composability.

**How it works:**

1. User generates a TLSNotary proof in the browser (selective disclosure)
2. Relayer verifies the proof and writes a time-bounded credential on-chain
3. Compliant tokens and protocols check the credential before transfers

## Install

```bash
npm install @zk-rwa-kit/client-sdk
```

## Quick Start

```typescript
import {
  proveEligibility,
  submitProof,
  CLAIM_TYPES,
} from '@zk-rwa-kit/client-sdk';

// Generate proof
const { transcript } = await proveEligibility();

// Submit → get on-chain credential (valid 24h)
const { txHash } = await submitProof(walletAddress, transcript, {
  claimType: CLAIM_TYPES.ELIGIBLE,
});
```

> Requires `SharedArrayBuffer`. See [browser setup](https://zk-rwa-kit-docs.vercel.app/getting-started/quick-start#browser-requirements).

## Packages

| Package                                           | Description                                     |
| ------------------------------------------------- | ----------------------------------------------- |
| [`@zk-rwa-kit/client-sdk`](./packages/client-sdk) | Browser SDK for proof generation and submission |
| [`contracts`](./packages/contracts)               | IdentityRegistry, ZkOracle, RWAToken            |
| [`relayer`](./packages/relayer)                   | Proof verification and on-chain writer          |
| [`prover-server`](./services/prover-server)       | Rust TLSNotary notary                           |

## Examples

| Demo                                                  | Description                 |
| ----------------------------------------------------- | --------------------------- |
| [Token Transfer](https://zk-rwa-kit-token.vercel.app) | Compliant ERC-20 transfers  |
| [Yield Vault](https://zk-rwa-kit-yield.vercel.app)    | Compliant ERC-4626 deposits |

## Development

```bash
git clone https://github.com/Ghost-xDD/zk-rwa-kit.git && cd zk-rwa-kit
pnpm install && pnpm build

pnpm dev:relayer           # Relayer
pnpm dev:mock-bank         # Mock eligibility source
cd services/prover-server && cargo run  # Prover
cd examples/yield-vault && pnpm dev     # Demo app
```

## Deployments

**Mantle Sepolia:**

| Contract         | Address                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| IdentityRegistry | [`0x58698a19006443eD2e9F1e4284Bd0c341B1a5A12`](https://sepolia.mantlescan.xyz/address/0x58698a19006443eD2e9F1e4284Bd0c341B1a5A12) |
| mUSDY            | [`0x1AFF98321D111A555F56FE977B3cBc01704FECBF`](https://sepolia.mantlescan.xyz/address/0x1AFF98321D111A555F56FE977B3cBc01704FECBF) |
| mYieldVault      | [`0xc7effA35eFFE2d1EaB90B3107927CaBeE4258170`](https://sepolia.mantlescan.xyz/address/0xc7effA35eFFE2d1EaB90B3107927CaBeE4258170) |

**Services:**

- Prover: `wss://zk-rwa-prover-production.up.railway.app/prove`
- Relayer: `https://zk-rwa-kitrelayer-production.up.railway.app`

## Documentation

Full documentation at **[zk-rwa-kit-docs.vercel.app](https://zk-rwa-kit-docs.vercel.app)**

- [Getting Started](https://zk-rwa-kit-docs.vercel.app/getting-started/introduction)
- [SDK Reference](https://zk-rwa-kit-docs.vercel.app/sdk/overview)
- [Smart Contracts](https://zk-rwa-kit-docs.vercel.app/contracts/overview)
- [Architecture](https://zk-rwa-kit-docs.vercel.app/getting-started/architecture)

## License

MIT — Built for Mantle Global Hackathon 2025
