<div align="center">

# ⬡ Zk-RWA-Kit

### Privacy-Preserving RWA Compliance for Mantle

**Just-in-time session credentials, not permanent allowlists.**

[![Mantle Sepolia](https://img.shields.io/badge/Mantle-Sepolia-blue?style=flat-square)](https://sepolia.mantlescan.xyz)
[![TLSNotary](https://img.shields.io/badge/TLSNotary-MPC--TLS-green?style=flat-square)](https://tlsnotary.org)
[![npm](https://img.shields.io/npm/v/@zk-rwa-kit/client-sdk?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@zk-rwa-kit/client-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](https://opensource.org/licenses/MIT)

[Documentation](https://zk-rwa-kit-docs.vercel.app/) · [Token Demo](https://zk-rwa-kit-token.vercel.app) · [Vault Demo](https://zk-rwa-kit-yield.vercel.app) · [GitHub](https://github.com/Ghost-xDD/zk-rwa-kit)

</div>

---

##  The Problem

RWAs today force a bad trade-off: **privacy or composability — pick one.**

| Pain Point                      | Description                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 👤 **Users lose privacy**       | To access compliant RWA yield, users must permanently link their wallet to KYC, doxxing their entire on-chain history. |
| 🔧 **Developers hit dead ends** | ERC-3643-style tokens break standard DeFi. Transfers fail because AMMs and users aren't on the allowlist.               |
| 🧩 **Ecosystems lack tooling**  | No plug-and-play way to turn private eligibility proofs into composable compliance.                                     |

##  The Solution

Zk-RWA-Kit creates a **compliant perimeter** where RWAs become DeFi-composable among verified participants without permanent public allowlists.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Generate Proof │ ──▶ │  Verify + Issue │ ──▶ │  Compliant DeFi │
│  (Browser SDK)  │     │  (Relayer)      │     │  (On-Chain)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
   TLSNotary              Off-chain              Session Credential
   MPC-TLS                verification            valid 24h
```

**Key innovation:** Session credentials expire (24h), so users get privacy + UX + control.

## 🚀 Quick Start

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

// 1. Generate proof in browser
const { transcript } = await proveEligibility();

// 2. Submit to relayer → on-chain credential
const { txHash } = await submitProof(walletAddress, transcript, {
  claimType: CLAIM_TYPES.ELIGIBLE,
});

// ✅ User now has a 24-hour SessionCredential on Mantle
```

> **Note:** TLS proofs require `SharedArrayBuffer`. Add COOP/COEP headers to your app. See [docs](https://zk-rwa-kit-docs.vercel.app/getting-started/quick-start#browser-requirements).

##  What's in the Kit

| Component                                           | Description                                       |
| --------------------------------------------------- | ------------------------------------------------- |
| **[@zk-rwa-kit/client-sdk](./packages/client-sdk)** | TypeScript SDK for proof generation + submission  |
| **[Relayer](./packages/relayer)**                   | Off-chain verifier + on-chain credential writer   |
| **[Smart Contracts](./packages/contracts)**         | IdentityRegistry, ZkOracle, compliance middleware |
| **[Prover Server](./services/prover-server)**       | Rust TLSNotary notary service                     |
| **[Token Demo](./examples/token-transfer)**         | Reference dApp: compliant token transfers         |
| **[Vault Demo](./examples/yield-vault)**            | Reference dApp: compliant ERC-4626 vault          |

##  Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                             │
│  ┌──────────────────────┐   ┌──────────────────────┐                │
│  │ Your dApp (React)     │──▶│ @zk-rwa-kit/sdk      │                │
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

##  Repo Structure

```
zk-rwa-kit/
├── packages/
│   ├── client-sdk/         # @zk-rwa-kit/client-sdk
│   ├── contracts/          # Solidity contracts
│   └── relayer/            # Express relayer service
├── services/
│   ├── prover-server/      # Rust TLSNotary prover
│   └── mock-bank/          # Demo eligibility source
├── examples/
│   ├── landing/            # Landing page
│   ├── token-transfer/     # Token demo dApp
│   └── yield-vault/        # Vault demo dApp
├── docs/                   # VitePress documentation
└── docker-compose.yml
```

##  Local Development

### Prerequisites

- Node.js 18+
- pnpm 8+
- Rust toolchain (for prover server)

### Setup

```bash
git clone https://github.com/Ghost-xDD/zk-rwa-kit.git
cd zk-rwa-kit

cp env.example .env
pnpm install
pnpm build
```

### Run Services

```bash
# Terminal 1: Relayer
pnpm dev:relayer

# Terminal 2: Mock Bank
pnpm dev:mock-bank

# Terminal 3: Prover Server
cd services/prover-server && cargo run

# Terminal 4: Example dApp
cd examples/yield-vault && pnpm dev
```

##  Live Deployments

| Service           | URL                                                                |
| ----------------- | ------------------------------------------------------------------ |
| **Landing Page**  | [zk-rwa-kit.vercel.app](https://zk-rwa-kit.vercel.app)             |
| **Documentation** | [zk-rwa-kit-docs.vercel.app](https://zk-rwa-kit-docs.vercel.app)   |
| **Token Demo**    | [zk-rwa-kit-token.vercel.app](https://zk-rwa-kit-token.vercel.app) |
| **Vault Demo**    | [zk-rwa-kit-yield.vercel.app](https://zk-rwa-kit-yield.vercel.app) |
| **Prover Server** | `wss://zk-rwa-prover-production.up.railway.app/prove`              |
| **Relayer API**   | `https://zk-rwa-kitrelayer-production.up.railway.app`              |

##  Deployed Contracts (Mantle Sepolia)

| Contract           | Address                                      |
| ------------------ | -------------------------------------------- |
| IdentityRegistry   | `0x58698a19006443eD2e9F1e4284Bd0c341B1a5A12` |
| mUSDY (Mock Token) | `0x1AFF98321D111A555F56FE977B3cBc01704FECBF` |
| mYieldVault        | `0xc7effA35eFFE2d1EaB90B3107927CaBeE4258170` |

##  Security Notes

- **Relayer is trusted** in the MVP — it verifies proofs off-chain
- **Session credentials expire** after 24 hours
- **Never commit private keys** — use environment variables

## 📚 Learn More

- [📖 Full Documentation](https://zk-rwa-kit-docs.vercel.app/)
- [🚀 Quick Start Guide](https://zk-rwa-kit-docs.vercel.app/getting-started/quick-start)
- [🔧 SDK Reference](https://zk-rwa-kit-docs.vercel.app/sdk/overview)
- [📜 Smart Contracts](https://zk-rwa-kit-docs.vercel.app/contracts/overview)

## 🏆 Built For

**Mantle Global Hackathon 2025**

---

<div align="center">

**[⬡ Try the Demos](https://zk-rwa-kit-yield.vercel.app)** · **[📖 Read the Docs](https://zk-rwa-kit-docs.vercel.app)** · **[⭐ Star on GitHub](https://github.com/Ghost-xDD/zk-rwa-kit)**

MIT License

</div>
