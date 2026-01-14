# Architecture

Zk-RWA-Kit connects **private off-chain proofs** to **on-chain compliance state** that DeFi protocols can consume.

## End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                                 │
│  ┌──────────────────────┐   ┌──────────────────────┐                    │
│  │ Your dApp (React)     │──▶│ @zk-rwa-kit/sdk      │                    │
│  └──────────┬───────────┘   └──────────┬───────────┘                    │
│             │                          │                                │
└─────────────┼──────────────────────────┼────────────────────────────────┘
              │ WebSocket                │ HTTPS
              ▼                          ▼
    ┌──────────────────┐        ┌──────────────────────┐
    │ Prover Server     │        │ Relayer              │
    │ (Rust, MPC-TLS)   │        │ (Node.js)            │
    └──────────┬────────┘        └──────────┬───────────┘
               │                            │
               │ HTTPS                      │ ethers.js
               ▼                            ▼
    ┌──────────────────┐        ┌──────────────────────────┐
    │ Eligibility       │        │ Mantle Sepolia           │
    │ Source (HTTPS)    │        │ IdentityRegistry         │
    └──────────────────┘        │ ZkOracle                 │
                                └──────────────────────────┘
```

## Component Breakdown

### 1. Client-Side SDK

**Technology:** TypeScript + TLSNotary WASM

The browser SDK handles:

- Connecting to the prover server via WebSocket
- Participating in MPC-TLS key splitting
- Fetching data from an eligibility source
- Generating a selective-disclosure proof
- Submitting the proof to the relayer

```typescript
// User never sees the complexity
const { transcript } = await proveEligibility();
const { txHash } = await submitProof(wallet, transcript);
```

### 2. Prover Server

**Technology:** Rust, TLSNotary

The prover server acts as the "notary" in the MPC-TLS protocol:

- Holds one share of the TLS session keys
- Participates in the TLS handshake without seeing plaintext
- Signs the resulting proof

The user proves to the notary that specific fields in an HTTPS response satisfy a condition, without revealing the full response.

### 3. Relayer

**Technology:** Node.js, Express, ethers.js

The relayer bridges off-chain proofs to on-chain credentials:

- Receives proof submissions from the SDK
- Validates the proof format and extracted claims
- Submits a transaction to the ZkOracle contract
- Pays gas on behalf of the user

In production, the relayer is the only entity with `AGENT_ROLE` on the ZkOracle.

### 4. Smart Contracts

**Technology:** Solidity, OpenZeppelin

| Contract             | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| **ZkOracle**         | Receives claims from the relayer, writes to IdentityRegistry |
| **IdentityRegistry** | Stores claims with expiry times, provides `isVerified()`     |
| **RWAToken**         | Example compliant token that checks credentials on transfer  |
| **mYieldVault**      | Example ERC-4626 vault with eligibility checks               |

### 5. Compliant Perimeter

Any token or protocol that calls `IdentityRegistry.isVerified()` becomes part of the compliant perimeter:

```solidity
function _update(address from, address to, uint256 amount) internal override {
    // Skip compliance for minting/burning
    if (from != address(0) && to != address(0)) {
        require(
            identityRegistry.isVerified(from, ELIGIBLE_CLAIM) &&
            identityRegistry.isVerified(to, ELIGIBLE_CLAIM),
            "Transfer not compliant"
        );
    }
    super._update(from, to, amount);
}
```

## Session Credentials

The key innovation is **temporary credentials** instead of permanent allowlists:

| Property | Permanent Allowlist      | Session Credential      |
| -------- | ------------------------ | ----------------------- |
| Privacy  | ❌ Wallet doxxed forever | ✅ Expires after 24h    |
| UX       | ❌ One-time KYC only     | ✅ Re-prove anytime     |
| Control  | ❌ Hard to revoke        | ✅ Clear expiry         |
| DeFi     | ❌ Breaks composability  | ✅ Works with any check |

## Data Flow

1. **User authenticates** to an eligibility source (mock bank, KYC provider)
2. **SDK generates proof** that specific fields satisfy conditions
3. **Relayer verifies** the proof and submits to ZkOracle
4. **ZkOracle writes** a claim to IdentityRegistry with 24h expiry
5. **Tokens/protocols check** `isVerified()` before transfers

## Security Model

- **Prover server** is semi-trusted (sees nothing but participates in MPC)
- **Relayer** is trusted to verify proofs correctly (MVP tradeoff)
- **Contracts** are trustless once deployed
- **Credentials** auto-expire, limiting damage from compromise

Future upgrade: Replace relayer verification with on-chain ZK verifiers.

## Next Steps

- [SDK Overview](/sdk/overview) — Client-side proof generation
- [Relayer API](/relayer/overview) — Endpoints and self-hosting
- [Contracts](/contracts/overview) — On-chain components
