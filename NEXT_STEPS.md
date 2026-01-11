# Zk-RWA-Kit: Next Steps

> Status as of: January 11, 2026

---

## ✅ What's Complete

### Infrastructure
- [x] Monorepo structure with pnpm workspaces
- [x] Docker Compose configuration
- [x] Caddy reverse proxy config (HTTPS + COOP/COEP headers)
- [x] SSL certificate generation script

### Smart Contracts (`packages/contracts/`)
- [x] `IdentityRegistry.sol` - Identity management with roles
- [x] `ZkOracle.sol` - Stores TLS proof attestations
- [x] `ComplianceModule.sol` - Compliance rules based on attestations
- [x] `RWAToken.sol` - ERC-20 with compliance gating
- [x] All interfaces defined
- [x] Deployment script for Mantle Sepolia
- [x] Basic test file structure

### TLSNotary Prover Server (`apps/prover-server/`)
- [x] Rust source code (copied from working prover-demo)
- [x] Dockerfile (builds successfully)
- [x] **Currently running locally on port 9816** ✅

### Client SDK (`packages/client-sdk/`)
- [x] Core types and interfaces
- [x] `proveEligibility()` - Connect to prover server
- [x] `submitProof()` - Submit to relayer
- [x] Transcript serialization utilities
- [x] Field extraction utilities
- [x] Demo mode with cached proof

### Relayer (`packages/relayer/`)
- [x] Express server structure
- [x] `/submit-proof` endpoint
- [x] `/status/:txHash` endpoint
- [x] Chain service (ethers v6)
- [x] Proof verification service (placeholder)

### Mock Bank (`apps/mock-bank/`)
- [x] Express server with eligibility endpoints
- [x] `/api/account` - Returns account with `eligible: true`
- [x] `/api/balances` - Alternative balance endpoint

### Webapp (`apps/webapp/`)
- [x] React app structure (copied from prover-demo)
- [x] WASM worker for TLSNotary
- [x] Basic UI components

---

## 🔲 What's Remaining

### Priority 1: Get Local Dev Environment Running

| Task | Command | Status |
|------|---------|--------|
| 1. Install root dependencies | `cd /Users/ghostxd/Desktop/yieldloop && pnpm install` | ⬜ |
| 2. Start Mock Bank | `pnpm dev:mock-bank` | ⬜ |
| 3. Start Relayer | `pnpm dev:relayer` | ⬜ |
| 4. Verify Prover Server | Already running on :9816 | ✅ |

### Priority 2: Deploy Contracts to Mantle Sepolia

1. **Get testnet MNT tokens**
   - Faucet: https://faucet.sepolia.mantle.xyz/
   - Need ~0.5 MNT for deployments

2. **Configure `.env` file**
   ```bash
   cp env.example .env
   # Edit .env and add your PRIVATE_KEY (without 0x prefix)
   ```

3. **Deploy contracts**
   ```bash
   pnpm deploy
   ```

4. **Update `.env` with deployed addresses**
   ```
   ZK_ORACLE_ADDRESS=0x...
   IDENTITY_REGISTRY_ADDRESS=0x...
   COMPLIANCE_MODULE_ADDRESS=0x...
   RWA_TOKEN_ADDRESS=0x...
   ```

### Priority 3: Complete Relayer Integration

- [ ] Update `packages/relayer/src/services/chain.ts` with actual contract calls
- [ ] Test proof submission flow end-to-end
- [ ] Add proper error handling for chain errors

### Priority 4: Complete Webapp Integration

- [ ] Update `apps/webapp/src/app.tsx` to:
  - Connect wallet (WalletConnect or injected)
  - Call prover server for proof generation
  - Submit proof to relayer
  - Display eligibility status
  - Enable mint/transfer if eligible

### Priority 5: Adapt Prover for Mock Bank

The prover server currently targets a Swiss bank demo. Need to update:

- [ ] `apps/prover-server/src/config.rs` - Point `SERVER_URI` to mock-bank
- [ ] `apps/prover-server/src/prover.rs` - Update `redact_and_reveal_received_data()` to extract `eligible` field from our JSON

### Priority 6: Testing & Demo

- [ ] Write contract tests (`pnpm test:contracts`)
- [ ] Test full flow: Webapp → Prover → Mock Bank → Relayer → Chain
- [ ] Create 3-minute demo script
- [ ] Screen record for submission

---

## 🚀 Quick Start Commands

```bash
# Terminal 1: Prover Server (already running)
# If not running:
cd apps/prover-server && RUST_LOG=info cargo run --release

# Terminal 2: Mock Bank
cd apps/mock-bank && pnpm install && pnpm dev

# Terminal 3: Relayer
cd packages/relayer && pnpm install && pnpm dev

# Terminal 4: Webapp
cd apps/webapp && npm install && npm run dev
```

---

## 📁 Key Files to Edit

| Purpose | File |
|---------|------|
| Environment variables | `.env` |
| Contract addresses | `packages/contracts/src/index.ts` |
| Prover target URL | `apps/prover-server/src/config.rs` |
| Proof extraction logic | `apps/prover-server/src/prover.rs` |
| Frontend wallet connect | `apps/webapp/src/app.tsx` |
| Relayer chain calls | `packages/relayer/src/services/chain.ts` |

---

## 🔗 Resources

- **Mantle Sepolia RPC**: `https://rpc.sepolia.mantle.xyz`
- **Chain ID**: `5003`
- **Block Explorer**: `https://sepolia.mantlescan.xyz`
- **Faucet**: `https://faucet.sepolia.mantle.xyz/`
- **TLSNotary Docs**: `https://docs.tlsnotary.org/`

---

## 📊 Architecture Summary

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Webapp    │────▶│   Prover    │────▶│  Mock Bank  │
│  (Browser)  │     │   Server    │     │  (HTTPS)    │
│  Verifier   │◀────│   (Rust)    │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       │ Submit Proof
       ▼
┌─────────────┐     ┌─────────────┐
│   Relayer   │────▶│   Mantle    │
│  (Node.js)  │     │  Sepolia    │
│             │     │  Contracts  │
└─────────────┘     └─────────────┘
```

**Flow:**
1. User connects wallet in Webapp
2. Webapp connects to Prover Server via WebSocket
3. Prover fetches data from Mock Bank over HTTPS
4. MPC-TLS protocol runs, Webapp (verifier) gets verified transcript
5. Webapp sends proof to Relayer
6. Relayer verifies and writes attestation to ZkOracle on Mantle
7. User can now mint/transfer RWA tokens (compliance-gated)
