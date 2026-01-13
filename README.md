# Zk-RWA-Kit

> **Privacy-preserving, compliance-gated RWA toolkit for Mantle**

Built for Mantle Global Hackathon 2025.

[![Mantle Sepolia](https://img.shields.io/badge/Mantle-Sepolia-blue)](https://sepolia.mantlescan.xyz)
[![TLSNotary](https://img.shields.io/badge/TLSNotary-v0.1.0--alpha.13-green)](https://tlsnotary.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Table of contents

- [Overview](#overview)
- [Problem statement](#problem-statement)
- [Solution](#solution)
- [Who this is for](#who-this-is-for)
- [Components](#components)
- [SDK Usage](#sdk-usage)
  - [Install](#install)
  - [Core API](#core-api)
  - [Minimal usage](#minimal-usage)
  - [Browser requirement](#browser-requirement)
- [Architecture (end-to-end flow)](#architecture-end-to-end-flow)
- [Repo layout](#repo-layout)
- [Quick start (local)](#quick-start-local)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
  - [Run services](#run-services)
  - [Run manually (without Docker)](#run-manually-without-docker)
- [Demo flow (what to show)](#demo-flow-what-to-show)
- [Scripts](#scripts)
- [Security notes](#security-notes)
- [License](#license)

## Overview

Zk-RWA-Kit enables developers to build **privacy-preserving, compliance-gated Real World Asset (RWA)** workflows on Mantle. Users can prove their eligibility for RWA tokens using TLSNotary MPC-TLS proofs without exposing sensitive credentials.

## Problem statement

- **Users want privacy:** access compliant RWA yield on Mantle without permanently linking their main wallet to a centralized KYC flow that doxxes their on-chain history.

- **Developers want composability:** permissioned assets (ERC-3643-style allowlists / transfer restrictions) break standard DeFi building blocks because protocols and users aren’t recognized as eligible recipients.

- **Ecosystems need last-mile tooling:** Mantle has strong RWA + privacy momentum, but developers still lack a plug-and-play way to turn “private eligibility proofs” into “composable compliance” that DeFi apps can consume safely.

## Solution

Zk-RWA-Kit is an **infrastructure + tooling SDK + reference dApps** that enable **just-in-time, privacy-preserving compliance** for RWA-like workflows on Mantle.

It does **not** bypass compliance. Instead, it creates a **compliant perimeter** where RWAs become DeFi-composable _among eligible users and integrations_, without a permanent public allowlist.

## Who this is for

- **RWA / DeFi app developers** who need a repeatable way to gate actions (mint / transfer / deposit) with privacy-preserving eligibility proofs.
- **Protocol builders** (vaults, lending markets, AMMs) who want “composable compliance” primitives instead of bespoke allowlists and fragile edge-case logic.
- **Hackathon / demo teams** that want an end-to-end reference flow: prove eligibility → issue a SessionCredential → interact with a compliant DeFi integration on Mantle.

## Components

### A) Client-side Prover SDK (TypeScript/WASM)

A browser library that uses **TLSNotary-style MPC-TLS proofs** to generate **selective-disclosure eligibility proofs** from an HTTPS session.

- The user authenticates to a trusted eligibility source.
- The SDK proves a condition is true (e.g. “eligible”), revealing only the minimum required fields.
- Output is a proof payload suitable for verification and credential issuance.

### B) Verification + Session Credentials (Relayer + contracts)

The MVP verifies proofs **off-chain** (relayer) and writes an on-chain, time-bounded result:

- A verified claim becomes an expiring **SessionCredential** (e.g. `ELIGIBLE`).
- DeFi integrations check the credential, not a permanent KYC flag.

Future upgrade path: swap relayer verification for on-chain verifiers once costs/circuits are ready.

### C) Compliant Perimeter DeFi (example vault / example token workflow)

Reference flows that enforce “only eligible users (and optionally eligible integrations) can interact”.

This makes RWA-like workflows **DeFi-compatible within a compliant perimeter** instead of “free-trading”.

## SDK Usage

The main developer entrypoint is `@zk-rwa-kit/client-sdk`.

### Install

```bash
pnpm add @zk-rwa-kit/client-sdk
```

### Core API

- **Generate proof**: `proveEligibility(options?) → ProveResult`
  - **returns**: `{ success, transcript?: VerifiedTranscript, error? }`
  - **common options**: `proverUrl`, `timeout`, `demoMode`, `maxSentData`, `maxRecvData`

- **Submit proof**: `submitProof(walletAddress, transcript, options?) → SubmitResult`
  - **does**: sends the transcript to the relayer, which verifies + writes an on-chain SessionCredential
  - **common options**: `relayerUrl`, `claimType` (default `CLAIM_TYPES.ELIGIBLE`), `extractedValue`, `timeout`

- **Track transaction**: `checkTransactionStatus(txHash)` / `waitForConfirmation(txHash)`

- **Parse transcripts**: `transcriptToString`, `extractClaims`, `extractField`, `parseJsonFromTranscript`

- **Serialize for transport**: `serializeTranscript`, `deserializeTranscript`

- **Defaults / constants**: `DEFAULT_PROVER_URL`, `DEFAULT_RELAYER_URL`, `MANTLE_SEPOLIA_CONFIG`, `CLAIM_TYPES`, `MAX_SENT_DATA`, `MAX_RECV_DATA`

### Minimal usage

```ts
import {
  CLAIM_TYPES,
  DEFAULT_PROVER_URL,
  DEFAULT_RELAYER_URL,
  proveEligibility,
  submitProof,
  extractClaims,
  transcriptToString,
} from '@zk-rwa-kit/client-sdk';

// 1) Generate proof (use demoMode for deterministic demos)
const prove = await proveEligibility({
  proverUrl: DEFAULT_PROVER_URL,
  demoMode: false,
});
if (!prove.success || !prove.transcript) throw new Error(prove.error);

// Optional: inspect extracted fields locally
const { received } = transcriptToString(prove.transcript);
const claims = extractClaims(received);
console.log('claims:', claims);

// 2) Submit proof (relayer verifies + pays gas to write the claim on-chain)
const walletAddress = '0x0000000000000000000000000000000000000000';
const submit = await submitProof(walletAddress, prove.transcript, {
  relayerUrl: DEFAULT_RELAYER_URL,
  claimType: CLAIM_TYPES.ELIGIBLE,
});
if (!submit.success) throw new Error(submit.error);

console.log('txHash:', submit.txHash);
```

### Browser requirement

TLS proof generation requires `SharedArrayBuffer` (COOP/COEP headers). For local dev, use the included `Caddyfile` / reverse proxy that sets the required headers.

## Architecture (end-to-end flow)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                             │
│  ┌──────────────────────┐   ┌──────────────────────┐                │
│  │ Example dApp (React)  │──▶│ tlsn-wasm (Verifier)  │                │
│  └──────────┬───────────┘   └──────────┬───────────┘                │
│             │ WebSocket                │ HTTP                        │
│             ▼                          ▼                             │
│   ┌──────────────────┐        ┌──────────────────────┐              │
│   │ Prover Server     │        │ Relayer (Verifier +  │              │
│   │ (Rust, MPC-TLS)   │        │ chain writer)        │              │
│   └──────────┬────────┘        └──────────┬───────────┘              │
│              │ HTTPS (target)              │ ethers.js                │
│              ▼                             ▼                         │
│        ┌──────────────┐          ┌──────────────────────────┐        │
│        │ Mock Bank     │          │ Mantle Sepolia (5003)     │        │
│        │ (demo source) │          │ IdentityRegistry + Vault  │        │
│        └──────────────┘          └──────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

## Repo layout

```
yieldloop/
├── packages/
│   ├── client-sdk/              # @zk-rwa-kit/client-sdk (proof submit, helpers)
│   ├── contracts/               # Solidity: IdentityRegistry, ZkOracle, etc.
│   └── relayer/                 # Express relayer: proof verification + chain writes
├── services/
│   ├── prover-server/           # Rust TLSNotary prover server
│   └── mock-bank/               # Demo HTTPS target / eligibility source
├── examples/
│   ├── token-transfer/          # Reference dApp: token flow
│   └── yield-vault/             # Reference dApp: vault flow
├── docker-compose.yml
├── Caddyfile                    # Local HTTPS + COOP/COEP headers
└── env.example
```

## Quick start (local)

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker + Docker Compose
- Rust toolchain (only if running the prover server outside Docker)

### Setup

```bash
cp env.example .env
pnpm install
pnpm build:contracts
pnpm deploy
pnpm generate-certs
```

### Run services

```bash
pnpm docker:build
pnpm docker:up
```

> Note: `docker-compose.yml` currently references `./apps/*` build contexts, while this repo uses `./services/*` and `./examples/*`. If you hit build-context errors, update those paths (or run services manually; see below).

### Run manually (without Docker)

```bash
# Terminal 1: contracts (local hardhat node)
pnpm dev:contracts

# Terminal 2: relayer
pnpm dev:relayer

# Terminal 3: mock bank
pnpm dev:mock-bank

# Terminal 4: prover server (Rust)
cd services/prover-server && cargo run

# Terminal 5: example dapp
cd examples/yield-vault && pnpm dev
```

## Demo flow (what to show)

1. Connect wallet (Mantle Sepolia).
2. Generate TLS proof (client talks to prover server).
3. Submit proof (relayer verifies and writes a SessionCredential on-chain).
4. Enter the vault and deposit/withdraw within the compliant perimeter.

## Scripts

```bash
pnpm build             # build all workspaces
pnpm build:contracts   # compile contracts
pnpm deploy            # deploy to Mantle Sepolia
pnpm dev:contracts     # local hardhat node
pnpm dev:relayer       # relayer dev server
pnpm dev:mock-bank     # mock bank dev server
pnpm docker:up         # docker compose up
pnpm docker:down       # docker compose down
pnpm generate-certs    # generate local HTTPS certs
```

## Security notes

- Never commit real private keys
- Proof verification is centralized in the MVP relayer
- Rate limiting is basic

## License

MIT
