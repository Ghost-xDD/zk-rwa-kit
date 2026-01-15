<div align="center">

# ⬡ Zk-RWA-Kit

Privacy-preserving compliance for Real World Assets on Mantle.  
**Session credentials that expire — not permanent allowlists.**

[Documentation](https://zk-rwa-kit-docs.vercel.app) · [Live Demo](https://zk-rwa-kit-yield.vercel.app) · [npm](https://www.npmjs.com/package/@zk-rwa-kit/client-sdk)

[![npm](https://img.shields.io/npm/v/@zk-rwa-kit/client-sdk?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@zk-rwa-kit/client-sdk)
[![Mantle](https://img.shields.io/badge/Mantle-Sepolia-65b3ae?style=flat-square)](https://sepolia.mantlescan.xyz)
[![TLSNotary](https://img.shields.io/badge/TLSNotary-MPC--TLS-8b5cf6?style=flat-square)](https://tlsnotary.org)
[![MIT](https://img.shields.io/badge/license-MIT-f5a623?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Components](#components)
  - [Core Architecture](#core-architecture)
- [Quick Start](#quick-start)
- [SDK Reference](#sdk-reference)
- [Architecture](#architecture)
- [Local Development](#local-development)
- [Deployments](#deployments)
- [Security Model](#security-model)
- [Documentation](#documentation)

---

## Overview

Zk-RWA-Kit enables developers to build **privacy-preserving, compliance-gated Real World Asset (RWA)** workflows on Mantle. Users prove eligibility using [TLSNotary](https://tlsnotary.org/) MPC-TLS proofs without exposing sensitive credentials.

**How it works:**

1. User generates a TLSNotary proof in-browser via **2-party MPC over TLS** (selective disclosure)
2. Relayer verifies the cryptographic transcript and writes a time-bounded credential on-chain
3. Compliant tokens and protocols check the credential before transfers

## Problem Statement

- **Users want privacy:** Access compliant RWA yield without permanently linking their wallet to a centralized KYC flow that doxxes their on-chain history.

- **Developers want composability:** Permissioned assets (ERC-3643-style allowlists) break standard DeFi building blocks because protocols and users aren't recognized as eligible recipients.

- **Ecosystems need tooling:** Developers lack a plug-and-play way to turn "private eligibility proofs" into "composable compliance" that DeFi apps can consume safely.

## Solution

Zk-RWA-Kit creates a **compliant perimeter** where RWAs become DeFi-composable among eligible users and integrations — without a permanent public allowlist.

### Technical Approach

We use **TLSNotary's MPC-TLS protocol** to generate verifiable proofs of web data:

- **2-Party Computation (2PC):** The user's browser and a Notary server jointly compute the TLS session. Neither party alone can forge or tamper with the transcript.
- **Selective Disclosure:** Users commit to the full TLS transcript but only reveal specific fields (e.g., `"eligible": true`) — the rest remains hidden via commitments.
- **Garbled Circuits:** TLSNotary uses oblivious transfer and garbled circuits for the MPC, ensuring the Notary never sees plaintext request/response data.

The verified claim becomes an **expiring Session Credential** (default: 24h TTL) written to the `IdentityRegistry` contract. DeFi integrations query this credential instead of permanent KYC flags — enabling composability without persistent identity linkage.

## Components

| Component                                     | Description                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| **[Client SDK](./packages/client-sdk)**       | TypeScript + WASM bindings for in-browser MPC-TLS proof generation          |
| **[Relayer](./packages/relayer)**             | Verifies TLSNotary transcripts, writes `SessionCredential` structs on-chain |
| **[Contracts](./packages/contracts)**         | `IdentityRegistry`, `ZkOracle`, ERC-20/ERC-4626 compliance hooks            |
| **[Prover Server](./services/prover-server)** | Rust Notary server — executes 2PC protocol with browser over WebSocket      |

### Core Architecture

#### A) Client-Side Prover SDK (TypeScript/WASM)

A browser library that uses **TLSNotary-style MPC-TLS proofs** to generate **selective-disclosure eligibility proofs** from an HTTPS session.

* A user logs into a trusted "identity/eligibility source" (for demo reliability this is a controlled mock provider; later it can be a KYC portal or regulated provider).
* The prover generates a cryptographic proof that a specific condition is true (e.g., "country is not sanctioned", "KYC status is verified", "balance above threshold").
* The proof reveals only the minimum required fields—**not** the user's full identity, session cookies, or raw transcript.

**Developer interface goal:** one function call like:
`proveEligibility(providerUrl, claimSpec) -> ProofPayload`

#### B) Compliance Middleware on Mantle (Session Credentials)

A set of Solidity contracts that turn verified proofs into **temporary compliance credentials** rather than permanent public allowlists.

Instead of "wallet is forever KYC'd," Zk-RWA-Kit implements **Just-in-Time compliance**:

* Proof is verified (MVP: off-chain via relayer; future: on-chain ZK verification).
* If valid, the system issues a **Session Credential** (either an expiring SBT or an expiring on-chain record):
  `validUntil[user][claimType] = now + 24h`

These session credentials are what DeFi integrations check. They give:

* **privacy:** no permanent public KYC flag
* **UX:** no repeated KYC per interaction
* **control:** clear expiry and revocation patterns

#### C) "Compliant Perimeter" Token/Wrapper + Factory

A wrapper or token implementation that enforces compliance checks at transfer time—without forcing every app developer to reinvent compliance logic.

For the hackathon MVP, the kit includes:

* a **USDY-like permissioned mock asset** (to simulate transfer restrictions)
* a **zkUSDY-like demo wrapper token** (clearly labeled demo / not affiliated)

The wrapper's key behavior is:

* **Transfers are allowed only if the sender and receiver have a valid Session Credential** (and optionally if the receiving contract is also registered/approved as an eligible integration).
* This makes the asset **composable within a compliant perimeter**—so you can build lending pools, vaults, or AMMs designed for compliant participants, without leaking identities.

**Important framing:**
This does *not* claim to make restricted assets "free-trading." It makes them **DeFi-compatible inside a verified set of participants and integrations**.

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

// 1. Run MPC-TLS protocol → get signed transcript
const { transcript } = await proveEligibility();

// 2. Submit transcript → Relayer verifies + writes credential on-chain
const { txHash } = await submitProof(walletAddress, transcript, {
  claimType: CLAIM_TYPES.ELIGIBLE, // keccak256("ELIGIBLE")
});
// User now has SessionCredential valid for 24h
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
┌──────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                               │
│  ┌────────────────────┐    ┌─────────────────────────────────────────┐   │
│  │  Your dApp (React) │───▶│  @zk-rwa-kit/client-sdk                 │   │
│  └────────────────────┘    │  ├─ tlsn-wasm (Rust→WASM)               │   │
│                            │  ├─ WebSocket MPC session               │   │
│                            │  └─ Transcript serialization            │   │
│                            └──────────────┬──────────────────────────┘   │
│                                           │                              │
└───────────────────────────────────────────┼──────────────────────────────┘
                    ┌───────────────────────┴───────────────────────┐
                    │                                               │
                    ▼ WebSocket (2PC Protocol)                      ▼ HTTPS POST
         ┌─────────────────────────┐                    ┌────────────────────────┐
         │  Prover Server (Rust)   │                    │  Relayer (Node.js)     │
         │  ├─ TLSNotary Notary    │                    │  ├─ Transcript verify  │
         │  ├─ Garbled circuits    │                    │  ├─ Claim extraction   │
         │  └─ Oblivious transfer  │                    │  └─ On-chain write     │
         └────────────┬────────────┘                    └───────────┬────────────┘
                      │ TLS 1.2/1.3                                 │ eth_sendRawTx
                      ▼                                             ▼
         ┌─────────────────────────┐                    ┌────────────────────────┐
         │  Eligibility Source     │                    │  Mantle Sepolia        │
         │  (Bank API / KYC)       │                    │  ├─ IdentityRegistry   │
         │                         │                    │  ├─ ZkOracle           │
         │  {"eligible": true}     │                    │  └─ mYieldVault        │
         └─────────────────────────┘                    └────────────────────────┘
```

**Data Flow:**

1. Browser initiates 2PC with Notary over WebSocket
2. MPC computes TLS handshake — Notary never sees plaintext
3. Browser fetches eligibility data, Notary co-signs transcript
4. SDK extracts claim, sends to Relayer for verification
5. Relayer writes `SessionCredential(wallet, claimType, expiry)` to `IdentityRegistry`

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

## Security Model

| Property                 | Status                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| **Notary trust**         | Semi-trusted — cannot forge proofs, but can collude to learn plaintext (mitigated by TEEs) |
| **Relayer trust**        | Trusted in MVP — verifies proofs off-chain; production path → on-chain ZK verification     |
| **Credential expiry**    | 24h TTL enforced on-chain via `block.timestamp` checks                                     |
| **Selective disclosure** | Only committed fields are revealed; full transcript remains hidden                         |
| **Replay protection**    | Nonce + wallet binding in transcript prevents credential reuse                             |

> **Note:** Never commit private keys. Use environment variables for all secrets.

---

<p align="center">
  <strong>Built for Mantle Global Hackathon 2025</strong><br/>
  MIT License
</p>
