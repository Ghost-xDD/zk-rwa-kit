<div align="center">

# ⬡ Zk-RWA-Kit

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
  <a href="https://www.npmjs.com/package/@zk-rwa-kit/client-sdk"><img src="https://img.shields.io/npm/v/@zk-rwa-kit/client-sdk?style=flat-square&color=cb3837" alt="npm" /></a>
  <a href="https://sepolia.mantlescan.xyz"><img src="https://img.shields.io/badge/chain-Mantle_Sepolia-65b3ae?style=flat-square" alt="Mantle" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-f5a623?style=flat-square" alt="MIT" /></a>
</p>

---

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Components](#components)
- [Quick Start](#quick-start)
- [SDK Reference](#sdk-reference)
- [Architecture](#architecture)
- [Local Development](#local-development)
- [Deployments](#deployments)
- [Documentation](#documentation)

---

## Overview

Zk-RWA-Kit enables developers to build **privacy-preserving, compliance-gated Real World Asset (RWA)** workflows on Mantle. Users prove eligibility using TLSNotary MPC-TLS proofs without exposing sensitive credentials.

**How it works:**

1. User generates a TLSNotary proof in the browser (selective disclosure)
2. Relayer verifies the proof and writes a time-bounded credential on-chain
3. Compliant tokens and protocols check the credential before transfers

## Problem Statement

- **Users want privacy:** Access compliant RWA yield without permanently linking their wallet to a centralized KYC flow that doxxes their on-chain history.

- **Developers want composability:** Permissioned assets (ERC-3643-style allowlists) break standard DeFi building blocks because protocols and users aren't recognized as eligible recipients.

- **Ecosystems need tooling:** Developers lack a plug-and-play way to turn "private eligibility proofs" into "composable compliance" that DeFi apps can consume safely.

## Solution

Zk-RWA-Kit creates a **compliant perimeter** where RWAs become DeFi-composable among eligible users and integrations — without a permanent public allowlist.

It does **not** bypass compliance. Instead, verified claims become **expiring Session Credentials** (e.g., valid for 24 hours) that DeFi integrations check instead of permanent KYC flags.

## Components

| Component                                     | Description                                               |
| --------------------------------------------- | --------------------------------------------------------- |
| **[Client SDK](./packages/client-sdk)**       | TypeScript/WASM library for TLSNotary proof generation    |
| **[Relayer](./packages/relayer)**             | Off-chain proof verification + on-chain credential writer |
| **[Contracts](./packages/contracts)**         | IdentityRegistry, ZkOracle, compliance middleware         |
| **[Prover Server](./services/prover-server)** | Rust TLSNotary notary service                             |

## Quick Start

### Install

```bash
npm install @zk-rwa-kit/client-sdk
```

### Usage

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

> **Note:** Requires `SharedArrayBuffer`. See [browser setup](https://zk-rwa-kit-docs.vercel.app/getting-started/quick-start#browser-requirements).

## SDK Reference

### Core API

- **`proveEligibility(options?)`** → `ProveResult`
  - Returns: `{ success, transcript?: VerifiedTranscript, error? }`
  - Options: `proverUrl`, `timeout`, `demoMode`, `maxSentData`, `maxRecvData`

- **`submitProof(walletAddress, transcript, options?)`** → `SubmitResult`
  - Sends transcript to relayer, which verifies + writes on-chain credential
  - Options: `relayerUrl`, `claimType`, `extractedValue`, `timeout`

- **`checkTransactionStatus(txHash)`** / **`waitForConfirmation(txHash)`**

### Utilities

- `transcriptToString`, `extractClaims`, `extractField`, `parseJsonFromTranscript`
- `serializeTranscript`, `deserializeTranscript`

### Constants

- `DEFAULT_PROVER_URL`, `DEFAULT_RELAYER_URL`, `MANTLE_SEPOLIA_CONFIG`, `CLAIM_TYPES`

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                             │
│  ┌──────────────────────┐   ┌──────────────────────┐                │
│  │ Your dApp             │──▶│ @zk-rwa-kit/sdk      │                │
│  └──────────┬───────────┘   └──────────┬───────────┘                │
│             │ WebSocket                │ HTTPS                       │
└─────────────┼──────────────────────────┼────────────────────────────┘
              │                          │
              ▼                          ▼
    ┌──────────────────┐        ┌──────────────────────┐
    │ Prover Server     │        │ Relayer              │
    │ (Rust, MPC-TLS)   │        │ (Node.js)            │
    └──────────┬────────┘        └──────────┬───────────┘
               │                            │
               ▼                            ▼
    ┌──────────────────┐        ┌──────────────────────────┐
    │ Eligibility       │        │ Mantle Sepolia           │
    │ Source (HTTPS)    │        │ IdentityRegistry + Vault │
    └──────────────────┘        └──────────────────────────┘
```

## Local Development

### Prerequisites

- Node.js 18+
- pnpm 8+
- Rust toolchain (for prover server)

### Setup

```bash
git clone https://github.com/Ghost-xDD/zk-rwa-kit.git && cd zk-rwa-kit
cp env.example .env
pnpm install && pnpm build
```

### Run Services

```bash
pnpm dev:relayer                         # Relayer
pnpm dev:mock-bank                       # Mock eligibility source
cd services/prover-server && cargo run   # Prover
cd examples/yield-vault && pnpm dev      # Demo app
```

### Repo Structure

```
zk-rwa-kit/
├── packages/
│   ├── client-sdk/         # @zk-rwa-kit/client-sdk
│   ├── contracts/          # Solidity contracts
│   └── relayer/            # Express relayer
├── services/
│   ├── prover-server/      # Rust TLSNotary
│   └── mock-bank/          # Demo source
├── examples/
│   ├── token-transfer/     # Token demo
│   └── yield-vault/        # Vault demo
└── docs/                   # VitePress docs
```

## Deployments

### Live Services

| Service       | URL                                                                |
| ------------- | ------------------------------------------------------------------ |
| Documentation | [zk-rwa-kit-docs.vercel.app](https://zk-rwa-kit-docs.vercel.app)   |
| Token Demo    | [zk-rwa-kit-token.vercel.app](https://zk-rwa-kit-token.vercel.app) |
| Vault Demo    | [zk-rwa-kit-yield.vercel.app](https://zk-rwa-kit-yield.vercel.app) |
| Prover        | `wss://zk-rwa-prover-production.up.railway.app/prove`              |
| Relayer       | `https://zk-rwa-kitrelayer-production.up.railway.app`              |

### Contracts (Mantle Sepolia)

| Contract          | Address                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| IdentityRegistry  | [`0x58698a19006443eD2e9F1e4284Bd0c341B1a5A12`](https://sepolia.mantlescan.xyz/address/0x58698a19006443eD2e9F1e4284Bd0c341B1a5A12) |
| ZkOracle          | [`0x3321FD3C919D4D935c09E7854F5b10ee15215577`](https://sepolia.mantlescan.xyz/address/0x3321FD3C919D4D935c09E7854F5b10ee15215577) |
| ComplianceModule  | [`0x172717c3f37684Aabf4F9a07dB45c98251dcCb52`](https://sepolia.mantlescan.xyz/address/0x172717c3f37684Aabf4F9a07dB45c98251dcCb52) |
| mUSDY (Mock USDY) | [`0x1AFF98321D111A555F56FE977B3cBc01704FECBF`](https://sepolia.mantlescan.xyz/address/0x1AFF98321D111A555F56FE977B3cBc01704FECBF) |
| mYieldVault       | [`0xc7effA35eFFE2d1EaB90B3107927CaBeE4258170`](https://sepolia.mantlescan.xyz/address/0xc7effA35eFFE2d1EaB90B3107927CaBeE4258170) |

## Documentation

Full documentation at **[zk-rwa-kit-docs.vercel.app](https://zk-rwa-kit-docs.vercel.app)**

- [Getting Started](https://zk-rwa-kit-docs.vercel.app/getting-started/introduction)
- [SDK Reference](https://zk-rwa-kit-docs.vercel.app/sdk/overview)
- [Smart Contracts](https://zk-rwa-kit-docs.vercel.app/contracts/overview)
- [Architecture](https://zk-rwa-kit-docs.vercel.app/getting-started/architecture)

## Security

- Relayer is trusted in the MVP (off-chain verification)
- Session credentials auto-expire after 24 hours
- Never commit private keys

---

<p align="center">
  <strong>Built for Mantle Global Hackathon 2025</strong><br/>
  MIT License
</p>
