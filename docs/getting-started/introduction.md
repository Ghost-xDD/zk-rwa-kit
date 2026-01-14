# Introduction

Zk-RWA-Kit is an **infrastructure SDK** that enables privacy-preserving, just-in-time compliance for Real World Asset (RWA) workflows on Mantle.

## The Problem

RWAs today force a bad trade-off: **privacy or composability — pick one.**

### Users lose privacy

To access compliant RWA yield (like USDY), users must link their main wallet to a centralized KYC flow — permanently doxxing their on-chain history.

### Developers hit dead ends

Permissioned tokens (ERC-3643-style) break standard DeFi. Transfers fail because AMMs, lending pools, and users aren't on the allowlist. Implementing this correctly is complex.

### Ecosystems lack tooling

Mantle is pushing RWAs and privacy, but developers still lack a **plug-and-play toolkit** that turns private proofs into composable compliance.

## The Solution

Zk-RWA-Kit doesn't bypass compliance — it creates a **compliant perimeter** where RWAs become DeFi-composable among eligible users and contracts.

Instead of permanent public allowlists, we use **Session Credentials**:

```
validUntil[user][claimType] = now + 24h
```

This gives you:

- **Privacy:** No permanent public KYC flag
- **UX:** No repeated KYC per interaction
- **Control:** Clear expiry and revocation patterns

## What's in the Kit

| Component           | Description                                               |
| ------------------- | --------------------------------------------------------- |
| **Client SDK**      | TypeScript/WASM library for TLSNotary proof generation    |
| **Relayer**         | Off-chain proof verification + on-chain credential writer |
| **Smart Contracts** | IdentityRegistry, ZkOracle, compliance middleware         |
| **Reference dApps** | Token transfer and yield vault examples                   |

## Target Audience

- **RWA / DeFi app developers** who need repeatable compliance checks
- **Protocol builders** (vaults, lending, AMMs) who want composable compliance
- **Hackathon teams** who want an end-to-end reference flow

## Next Steps

- [Quick Start](/getting-started/quick-start) — Get up and running in 5 minutes
- [Architecture](/getting-started/architecture) — Understand the end-to-end flow
- [SDK Reference](/sdk/overview) — Deep dive into the client SDK
