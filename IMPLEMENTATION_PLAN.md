# Zk-RWA-Kit: Complete Implementation Plan

> **Based on TLSNotary prover-demo architecture** - Uses Rust prover server + WASM verifier pattern

## Table of Contents
1. [High-Level System Overview](#1-high-level-system-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Implementation Order](#3-implementation-order)
4. [Contracts Blueprint](#4-contracts-blueprint)
5. [Relayer Blueprint](#5-relayer-blueprint)
6. [TLSNotary Prover Server Blueprint](#6-tlsnotary-prover-server-blueprint)
7. [Client SDK Blueprint](#7-client-sdk-blueprint)
8. [Example Webapp Blueprint](#8-example-webapp-blueprint)
9. [Mock Bank Service Blueprint](#9-mock-bank-service-blueprint)
10. [Docker & Caddy Configuration](#10-docker--caddy-configuration)
11. [Scripts & Commands](#11-scripts--commands)
12. [Demo Plan](#12-demo-plan)
13. [Future Upgrades](#13-future-upgrades)

---

## 1. High-Level System Overview

**Zk-RWA-Kit** is a modular SDK enabling developers to build privacy-preserving, compliance-gated Real World Asset (RWA) workflows on Mantle. The system uses TLSNotary MPC-TLS proofs to verify off-chain data (e.g., bank balances, accreditation status) without exposing raw credentials.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐           │
│  │  Webapp (React) │───▶│  WASM Verifier  │───▶│   Submit Proof  │           │
│  │  + Wallet       │    │  (tlsn-wasm)    │    │   to Relayer    │           │
│  └─────────────────┘    └────────┬────────┘    └────────┬────────┘           │
└──────────────────────────────────┼──────────────────────┼────────────────────┘
                                   │ WebSocket            │ HTTP POST
                                   ▼                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              DOCKER COMPOSE                                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐           │
│  │  Prover Server  │───▶│   Mock Bank     │    │    Relayer      │           │
│  │  (Rust/TLSN)    │    │   (Express)     │    │    (Express)    │           │
│  │  Port 9816      │    │   Port 3002     │    │    Port 3001    │           │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘           │
│                                                          │                    │
│  ┌──────────────────────────────────────────────────────┼───────────────┐    │
│  │                         Caddy Proxy                   │               │    │
│  │  - HTTPS termination (self-signed for local dev)     │               │    │
│  │  - COOP/COEP headers (required for SharedArrayBuffer) │               │    │
│  │  - WebSocket proxy /prove → Prover Server             │               │    │
│  │  - Reverse proxy to Webapp                           ▼               │    │
│  └───────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼ ethers.js / On-Chain Write
┌──────────────────────────────────────────────────────────────────────────────┐
│                         MANTLE SEPOLIA (Chain ID: 5003)                       │
│  ┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐            │
│  │  ZkOracle   │───▶│ IdentityRegistry │◀───│ ComplianceModule  │            │
│  │ (AGENT_ROLE)│    │  (stores claims) │    │ (canTransfer)     │            │
│  └─────────────┘    └──────────────────┘    └─────────┬─────────┘            │
│                                                        │                      │
│                                              ┌─────────▼─────────┐            │
│                                              │     RWAToken      │            │
│                                              │ (compliance-gated)│            │
│                                              └───────────────────┘            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Flow Description

1. **User** connects wallet and clicks "Prove Eligibility"
2. **Webapp** loads WASM verifier (`tlsn-wasm`) and connects via WebSocket to **Prover Server**
3. **Prover Server** (Rust) performs MPC-TLS with **Mock Bank**, fetching the user's eligibility data
4. **Prover** creates proof with selective disclosure (reveals only the `eligible` field, redacts secrets)
5. **WASM Verifier** in browser receives and verifies the proof cryptographically
6. **Webapp** serializes verified transcript and POSTs to **Relayer**
7. **Relayer** validates proof structure and submits claim to **ZkOracle** on-chain (paying gas)
8. **ZkOracle** writes claim to **IdentityRegistry**
9. **RWAToken** checks **ComplianceModule** (`canTransfer`) before allowing mint/transfer
10. User is now eligible to mint and transfer RWA tokens within the compliant perimeter

### Key Technologies

| Component | Technology | Notes |
|-----------|------------|-------|
| Prover Server | Rust + tlsn v0.1.0-alpha.13 | WebSocket server, MPC-TLS |
| WASM Verifier | tlsn-wasm | Browser-side verification |
| Webapp | React + Webpack | COOP/COEP headers via Caddy |
| Relayer | Node.js + Express | Proof validation, chain writes |
| Contracts | Solidity + Hardhat | Mantle Sepolia deployment |
| Proxy | Caddy | HTTPS, headers, WebSocket proxy |
| Orchestration | Docker Compose | All services together |

---

## 2. Monorepo Structure

```
zk-rwa-kit/
├── docker-compose.yml              # Orchestrates all services
├── Caddyfile                       # Root Caddy config
├── .env.example                    # Environment template
├── .gitignore
├── package.json                    # Root workspace scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── README.md
├── IMPLEMENTATION_PLAN.md
│
├── packages/
│   ├── contracts/                  # @zk-rwa-kit/contracts
│   │   ├── contracts/
│   │   │   ├── interfaces/
│   │   │   │   ├── IZkOracle.sol
│   │   │   │   ├── IIdentityRegistry.sol
│   │   │   │   └── ICompliance.sol
│   │   │   ├── ZkOracle.sol
│   │   │   ├── IdentityRegistry.sol
│   │   │   ├── ComplianceModule.sol
│   │   │   └── RWAToken.sol
│   │   ├── scripts/deploy.ts
│   │   ├── test/RWAToken.test.ts
│   │   ├── src/index.ts            # Export ABIs + addresses
│   │   ├── hardhat.config.ts
│   │   └── package.json
│   │
│   ├── relayer/                    # @zk-rwa-kit/relayer
│   │   ├── src/
│   │   │   ├── index.ts            # Express server
│   │   │   ├── routes/proof.ts     # POST /submit-proof
│   │   │   ├── routes/status.ts    # GET /status/:txHash
│   │   │   ├── services/verifier.ts
│   │   │   └── services/chain.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── client-sdk/                 # @zk-rwa-kit/client-sdk
│       ├── src/
│       │   ├── index.ts
│       │   ├── prover.ts           # Connect to prover server
│       │   ├── submitter.ts        # Submit to relayer
│       │   └── types.ts
│       └── package.json
│
├── apps/
│   ├── webapp/                     # Reference dApp
│   │   ├── src/
│   │   │   ├── app.tsx             # Main React app
│   │   │   ├── worker.ts           # Web Worker for WASM
│   │   │   └── app.scss
│   │   ├── tlsn-wasm-pkg/          # WASM package (copied from prover-demo)
│   │   │   ├── tlsn_wasm.js
│   │   │   ├── tlsn_wasm.d.ts
│   │   │   ├── tlsn_wasm_bg.wasm
│   │   │   └── package.json
│   │   ├── webpack.js
│   │   ├── Caddyfile               # COOP/COEP headers
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── prover-server/              # Rust TLSNotary prover
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── lib.rs
│   │   │   ├── config.rs
│   │   │   ├── prover.rs           # MPC-TLS proving logic
│   │   │   ├── verifier.rs
│   │   │   └── axum_websocket.rs
│   │   ├── Cargo.toml
│   │   ├── Dockerfile
│   │   └── README.md
│   │
│   └── mock-bank/                  # Mock HTTPS bank API
│       ├── src/
│       │   ├── index.ts
│       │   └── routes/account.ts
│       ├── Dockerfile
│       └── package.json
│
├── certs/                          # Self-signed certs for local HTTPS
│   ├── fullchain.pem
│   └── privkey.pem
│
└── docs/
    ├── architecture.md
    └── deployment-guide.md
```

### Package Responsibilities

| Package | Description | Publishable |
|---------|-------------|-------------|
| `@zk-rwa-kit/contracts` | Solidity contracts, ABIs, deployment scripts | ✅ npm |
| `@zk-rwa-kit/relayer` | Proof verification, gas-sponsored chain writes | ✅ npm |
| `@zk-rwa-kit/client-sdk` | Browser SDK for proof flow | ✅ npm |
| `webapp` | Reference React dApp | ❌ Example |
| `prover-server` | Rust TLSNotary prover | ❌ Docker only |
| `mock-bank` | Fake bank API | ❌ Docker only |

---

## 3. Implementation Order

### Phase 1: Bootstrap & Contracts (Day 1, Morning - 4 hours)

**Purpose:** Set up monorepo, deploy contracts to Mantle Sepolia

**Tasks:**
- [ ] Initialize pnpm workspace
- [ ] Create Hardhat project with Mantle Sepolia config
- [ ] Implement interfaces: `IZkOracle`, `IIdentityRegistry`, `ICompliance`
- [ ] Implement `IdentityRegistry.sol`
- [ ] Implement `ZkOracle.sol` with AGENT_ROLE
- [ ] Implement `ComplianceModule.sol` with `canTransfer`
- [ ] Implement `RWAToken.sol` with compliance hooks
- [ ] Write deployment script with correct wiring
- [ ] Deploy to Mantle Sepolia
- [ ] Export ABIs and addresses

**Key Files:**
```
packages/contracts/contracts/*.sol
packages/contracts/scripts/deploy.ts
packages/contracts/src/index.ts
```

**Acceptance Criteria:**
- [x] `pnpm test:contracts` passes with 4+ tests
- [x] All contracts deployed to Mantle Sepolia
- [x] Addresses exported to `deployments/mantle-sepolia.json`

---

### Phase 2: Prover Server Setup (Day 1, Afternoon - 4 hours)

**Purpose:** Get Rust TLSNotary prover server running, adapted from prover-demo

**Tasks:**
- [ ] Copy `prover-demo/server` to `apps/prover-server`
- [ ] Modify `config.rs` to target our mock-bank URL
- [ ] Update `prover.rs` to extract `eligible` field from JSON response
- [ ] Create Dockerfile for prover-server
- [ ] Test WebSocket connection locally

**Key Files:**
```
apps/prover-server/src/config.rs      # Point to mock-bank
apps/prover-server/src/prover.rs      # Extract "eligible" field
apps/prover-server/Cargo.toml
apps/prover-server/Dockerfile
```

**Acceptance Criteria:**
- [x] Prover server builds with `cargo build`
- [x] Prover server starts on port 9816
- [x] WebSocket endpoint `/prove` accepts connections

---

### Phase 3: Mock Bank Service (Day 1, Evening - 2 hours)

**Purpose:** Stable HTTPS endpoint for TLS proving

**Tasks:**
- [ ] Create Express server with TypeScript
- [ ] Implement `GET /api/account` returning stable JSON
- [ ] Add realistic headers and optional auth
- [ ] Create Dockerfile
- [ ] Add self-signed HTTPS support for TLS proofs

**Key Files:**
```
apps/mock-bank/src/index.ts
apps/mock-bank/src/routes/account.ts
apps/mock-bank/Dockerfile
```

**Mock Bank Response:**
```json
{
  "accountId": "ACC-12345678",
  "accountHolder": "Demo User",
  "balance": 150000.00,
  "currency": "USD",
  "eligible": true,
  "accredited": true,
  "kycVerified": true,
  "lastUpdated": "2025-01-11T00:00:00Z"
}
```

**Acceptance Criteria:**
- [x] `GET /api/account` returns consistent JSON
- [x] Server runs on port 3002
- [x] HTTPS enabled with self-signed cert

---

### Phase 4: Webapp + WASM Integration (Day 2 - Full Day)

**Purpose:** Browser webapp with WASM verifier connecting to prover

**Tasks:**
- [ ] Copy `prover-demo/webapp` structure to `apps/webapp`
- [ ] Copy `tlsn-wasm-pkg/` for WASM binaries
- [ ] Adapt `app.tsx` for RWA flow (remove POAP, add wallet connect)
- [ ] Keep `worker.ts` for Web Worker WASM isolation
- [ ] Add wagmi/viem for wallet connection
- [ ] Add proof submission to relayer after verification
- [ ] Create Caddyfile with COOP/COEP headers
- [ ] Create Dockerfile (multi-stage: build → Caddy serve)

**Key Files:**
```
apps/webapp/src/app.tsx              # Main UI
apps/webapp/src/worker.ts            # WASM worker
apps/webapp/tlsn-wasm-pkg/           # WASM binaries
apps/webapp/webpack.js
apps/webapp/Caddyfile
apps/webapp/Dockerfile
```

**Caddyfile (COOP/COEP Headers):**
```caddyfile
:80 {
    root * /usr/share/caddy
    file_server {
        precompressed br gzip
    }
    try_files {path} {path}/ /index.html
    
    # Required for SharedArrayBuffer
    header /* {
        Cross-Origin-Embedder-Policy "require-corp"
        Cross-Origin-Opener-Policy "same-origin"
    }
}
```

**Acceptance Criteria:**
- [x] Webapp builds with `npm run build`
- [x] WASM loads and initializes
- [x] Wallet connection works (MetaMask/WalletConnect)
- [x] WebSocket connects to prover server
- [x] Verification completes and shows transcript

---

### Phase 5: Relayer Service (Day 3, Morning - 4 hours)

**Purpose:** Proof validation and gas-sponsored chain writes

**Tasks:**
- [ ] Create Express server with TypeScript
- [ ] Implement `POST /submit-proof` endpoint
- [ ] Implement `GET /status/:txHash` endpoint
- [ ] Build proof validation (check transcript structure)
- [ ] Implement chain write with ethers v6
- [ ] Add CORS and rate limiting
- [ ] Create Dockerfile

**Key Files:**
```
packages/relayer/src/index.ts
packages/relayer/src/routes/proof.ts
packages/relayer/src/services/chain.ts
packages/relayer/Dockerfile
```

**Acceptance Criteria:**
- [x] Relayer starts on port 3001
- [x] Valid transcript submission returns txHash
- [x] Transaction confirms on Mantle Sepolia
- [x] User address appears in IdentityRegistry

---

### Phase 6: Docker Compose Integration (Day 3, Afternoon - 4 hours)

**Purpose:** Run all services together with proper networking

**Tasks:**
- [ ] Create `docker-compose.yml` with all services
- [ ] Create root `Caddyfile` for reverse proxy
- [ ] Generate self-signed certificates for local HTTPS
- [ ] Configure environment variables
- [ ] Test full flow end-to-end

**Key Files:**
```
docker-compose.yml
Caddyfile
certs/fullchain.pem
certs/privkey.pem
```

**Acceptance Criteria:**
- [x] `docker compose up` starts all services
- [x] Full flow works: prove → verify → submit → mint

---

### Phase 7: Polish & Demo (Day 4)

**Purpose:** Demo preparation, documentation, cleanup

**Tasks:**
- [ ] Add demo mode toggle to webapp
- [ ] Add cached proof fallback for reliability
- [ ] Write README with quick start
- [ ] Create demo script
- [ ] Record 3-minute demo video
- [ ] Final Mantle Sepolia deployment

**Acceptance Criteria:**
- [x] Demo mode works reliably
- [x] README enables setup in <5 minutes
- [x] Demo video ready for submission

---

## 4. Contracts Blueprint

### Contract Overview

| Contract | Responsibility |
|----------|----------------|
| `IZkOracle` | Interface for oracle that writes verified claims |
| `IIdentityRegistry` | Interface for identity storage and queries |
| `ICompliance` | Interface for transfer compliance checks |
| `ZkOracle` | Receives relayer calls, writes to IdentityRegistry |
| `IdentityRegistry` | Stores identity claims by address |
| `ComplianceModule` | Implements `canTransfer` logic |
| `RWAToken` | ERC-20 with compliance hooks |

### Access Control Model

```
ROLES:
├── DEFAULT_ADMIN_ROLE    → Deployer (manages all roles)
├── ORACLE_ROLE           → ZkOracle contract (writes claims to IdentityRegistry)
├── AGENT_ROLE            → Relayer EOA (calls ZkOracle.submitClaim)
└── MINTER_ROLE           → Admin (can mint RWATokens to eligible addresses)
```

### Interfaces

#### IZkOracle.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IZkOracle {
    event ClaimSubmitted(
        address indexed subject,
        bytes32 indexed claimType,
        bytes32 claimValue,
        uint256 expiry
    );

    function submitClaim(
        address subject,
        bytes32 claimType,
        bytes32 claimValue,
        uint256 expiry,
        bytes calldata proof
    ) external;

    function getClaim(address subject, bytes32 claimType) 
        external view returns (bytes32 value, uint256 expiry);
}
```

#### IIdentityRegistry.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IIdentityRegistry {
    event IdentityRegistered(address indexed wallet, uint256 indexed identityId);
    event ClaimAdded(address indexed wallet, bytes32 indexed claimType, bytes32 value);

    function registerIdentity(address wallet) external returns (uint256 identityId);
    function addClaim(address wallet, bytes32 claimType, bytes32 value, uint256 expiry) external;
    function isVerified(address wallet, bytes32 claimType) external view returns (bool);
    function getClaim(address wallet, bytes32 claimType) external view returns (bytes32 value, uint256 expiry);
    function hasIdentity(address wallet) external view returns (bool);
}
```

#### ICompliance.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICompliance {
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);
    function transferred(address from, address to, uint256 amount) external;
}
```

### Deployment Order

```typescript
// scripts/deploy.ts
import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. Deploy IdentityRegistry
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy(deployer.address);
  await identityRegistry.waitForDeployment();
  console.log("IdentityRegistry:", await identityRegistry.getAddress());

  // 2. Deploy ZkOracle (needs IdentityRegistry)
  const ZkOracle = await ethers.getContractFactory("ZkOracle");
  const zkOracle = await ZkOracle.deploy(
    await identityRegistry.getAddress(),
    deployer.address
  );
  await zkOracle.waitForDeployment();
  console.log("ZkOracle:", await zkOracle.getAddress());

  // 3. Grant ORACLE_ROLE to ZkOracle on IdentityRegistry
  const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
  await identityRegistry.grantRole(ORACLE_ROLE, await zkOracle.getAddress());
  console.log("Granted ORACLE_ROLE to ZkOracle");

  // 4. Grant AGENT_ROLE to relayer EOA on ZkOracle
  const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));
  const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;
  await zkOracle.grantRole(AGENT_ROLE, relayerAddress);
  console.log("Granted AGENT_ROLE to:", relayerAddress);

  // 5. Deploy ComplianceModule
  const ComplianceModule = await ethers.getContractFactory("ComplianceModule");
  const complianceModule = await ComplianceModule.deploy(
    await identityRegistry.getAddress()
  );
  await complianceModule.waitForDeployment();
  console.log("ComplianceModule:", await complianceModule.getAddress());

  // 6. Deploy RWAToken
  const RWAToken = await ethers.getContractFactory("RWAToken");
  const rwaToken = await RWAToken.deploy(
    "RWA Demo Token",
    "RWAD",
    await complianceModule.getAddress(),
    deployer.address
  );
  await rwaToken.waitForDeployment();
  console.log("RWAToken:", await rwaToken.getAddress());

  // Save addresses
  const addresses = {
    identityRegistry: await identityRegistry.getAddress(),
    zkOracle: await zkOracle.getAddress(),
    complianceModule: await complianceModule.getAddress(),
    rwaToken: await rwaToken.getAddress(),
    deployer: deployer.address,
    relayer: relayerAddress,
    chainId: "5003",
    network: "mantle-sepolia"
  };
  
  const dir = "./deployments";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  fs.writeFileSync(
    `${dir}/mantle-sepolia.json`,
    JSON.stringify(addresses, null, 2)
  );
  console.log("Addresses saved to deployments/mantle-sepolia.json");
}

main().catch(console.error);
```

### Tests

```typescript
// test/RWAToken.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("RWAToken Compliance", function () {
  let identityRegistry: any;
  let zkOracle: any;
  let complianceModule: any;
  let rwaToken: any;
  let owner: any, relayer: any, user1: any, user2: any;
  
  const ELIGIBLE_CLAIM = ethers.keccak256(ethers.toUtf8Bytes("ELIGIBLE"));
  const CLAIM_VALUE = ethers.encodeBytes32String("true");
  
  beforeEach(async function () {
    [owner, relayer, user1, user2] = await ethers.getSigners();
    
    // Deploy all contracts
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy(owner.address);
    
    const ZkOracle = await ethers.getContractFactory("ZkOracle");
    zkOracle = await ZkOracle.deploy(await identityRegistry.getAddress(), owner.address);
    
    const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
    await identityRegistry.grantRole(ORACLE_ROLE, await zkOracle.getAddress());
    
    const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));
    await zkOracle.grantRole(AGENT_ROLE, relayer.address);
    
    const ComplianceModule = await ethers.getContractFactory("ComplianceModule");
    complianceModule = await ComplianceModule.deploy(await identityRegistry.getAddress());
    
    const RWAToken = await ethers.getContractFactory("RWAToken");
    rwaToken = await RWAToken.deploy(
      "RWA Token", "RWA",
      await complianceModule.getAddress(),
      owner.address
    );
  });

  it("should reject mint to non-eligible address", async function () {
    await expect(rwaToken.mint(user1.address, 1000))
      .to.be.revertedWith("Recipient not eligible");
  });

  it("should allow mint after eligibility verified", async function () {
    const expiry = Math.floor(Date.now() / 1000) + 86400;
    await zkOracle.connect(relayer).submitClaim(
      user1.address, ELIGIBLE_CLAIM, CLAIM_VALUE, expiry, "0x1234"
    );
    
    await expect(rwaToken.mint(user1.address, 1000))
      .to.emit(rwaToken, "Transfer")
      .withArgs(ethers.ZeroAddress, user1.address, 1000);
  });

  it("should reject transfer to non-eligible address", async function () {
    // Make user1 eligible and mint
    const expiry = Math.floor(Date.now() / 1000) + 86400;
    await zkOracle.connect(relayer).submitClaim(
      user1.address, ELIGIBLE_CLAIM, CLAIM_VALUE, expiry, "0x1234"
    );
    await rwaToken.mint(user1.address, 1000);
    
    // Transfer to non-eligible user2 should fail
    await expect(rwaToken.connect(user1).transfer(user2.address, 100))
      .to.be.revertedWith("Transfer not compliant");
  });

  it("should allow transfer between eligible addresses", async function () {
    const expiry = Math.floor(Date.now() / 1000) + 86400;
    
    // Make both users eligible
    await zkOracle.connect(relayer).submitClaim(
      user1.address, ELIGIBLE_CLAIM, CLAIM_VALUE, expiry, "0x1234"
    );
    await zkOracle.connect(relayer).submitClaim(
      user2.address, ELIGIBLE_CLAIM, CLAIM_VALUE, expiry, "0x5678"
    );
    
    await rwaToken.mint(user1.address, 1000);
    
    await expect(rwaToken.connect(user1).transfer(user2.address, 100))
      .to.emit(rwaToken, "Transfer")
      .withArgs(user1.address, user2.address, 100);
  });

  it("should reject after claim expires", async function () {
    const expiry = Math.floor(Date.now() / 1000) + 60; // 60 seconds
    await zkOracle.connect(relayer).submitClaim(
      user1.address, ELIGIBLE_CLAIM, CLAIM_VALUE, expiry, "0x1234"
    );
    
    // Fast forward past expiry
    await time.increase(120);
    
    await expect(rwaToken.mint(user1.address, 1000))
      .to.be.revertedWith("Recipient not eligible");
  });

  it("should reject claim from non-agent", async function () {
    const expiry = Math.floor(Date.now() / 1000) + 86400;
    await expect(
      zkOracle.connect(user1).submitClaim(
        user1.address, ELIGIBLE_CLAIM, CLAIM_VALUE, expiry, "0x1234"
      )
    ).to.be.reverted;
  });
});
```

---

## 5. Relayer Blueprint

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/submit-proof` | Submit verified transcript for chain write |
| `GET` | `/status/:txHash` | Check transaction status |
| `GET` | `/health` | Health check |

### Request/Response Schemas

#### POST /submit-proof

**Request:**
```typescript
interface SubmitProofRequest {
  walletAddress: string;       // User's Ethereum address (0x...)
  transcript: {
    sent: string;              // Base64 encoded sent data
    received: string;          // Base64 encoded received data
    serverName: string;        // e.g., "mockbank.local"
  };
  claimType: string;           // e.g., "ELIGIBLE"
  extractedValue: string;      // e.g., "true"
}
```

**Success Response:**
```typescript
interface SubmitProofResponse {
  success: true;
  txHash: string;
  claimType: string;
  claimValue: string;
  expiry: number;
}
```

**Error Response:**
```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: "INVALID_TRANSCRIPT" | "MISSING_FIELD" | "CHAIN_ERROR" | "RATE_LIMITED";
}
```

### Implementation

```typescript
// packages/relayer/src/index.ts
import express from 'express';
import cors from 'cors';
import { proofRouter } from './routes/proof';
import { statusRouter } from './routes/status';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/submit-proof', proofRouter);
app.use('/status', statusRouter);
app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.RELAYER_PORT || 3001;
app.listen(PORT, () => console.log(`Relayer listening on port ${PORT}`));
```

```typescript
// packages/relayer/src/routes/proof.ts
import { Router } from 'express';
import { submitClaimOnChain } from '../services/chain';
import { validateTranscript } from '../services/verifier';

export const proofRouter = Router();

proofRouter.post('/', async (req, res) => {
  try {
    const { walletAddress, transcript, claimType, extractedValue } = req.body;
    
    // Validate inputs
    if (!walletAddress || !transcript || !claimType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        code: 'MISSING_FIELD'
      });
    }
    
    // Validate transcript structure
    const validation = validateTranscript(transcript, extractedValue);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        code: 'INVALID_TRANSCRIPT'
      });
    }
    
    // Submit to chain
    const result = await submitClaimOnChain(
      walletAddress,
      claimType,
      extractedValue
    );
    
    res.json({
      success: true,
      txHash: result.txHash,
      claimType,
      claimValue: extractedValue,
      expiry: result.expiry
    });
    
  } catch (error) {
    console.error('Chain submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Chain submission failed',
      code: 'CHAIN_ERROR'
    });
  }
});
```

```typescript
// packages/relayer/src/services/chain.ts
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.MANTLE_SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Load ZkOracle ABI and address
import { ZkOracle__factory } from '@zk-rwa-kit/contracts';
const zkOracle = ZkOracle__factory.connect(process.env.ZK_ORACLE_ADDRESS!, wallet);

export async function submitClaimOnChain(
  subject: string,
  claimType: string,
  claimValue: string
): Promise<{ txHash: string; expiry: number }> {
  
  const claimTypeBytes32 = ethers.keccak256(ethers.toUtf8Bytes(claimType));
  const claimValueBytes32 = ethers.encodeBytes32String(claimValue.slice(0, 31));
  const expiry = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days
  const proofPlaceholder = ethers.toUtf8Bytes("verified");
  
  const tx = await zkOracle.submitClaim(
    subject,
    claimTypeBytes32,
    claimValueBytes32,
    expiry,
    proofPlaceholder
  );
  
  console.log(`Submitted tx: ${tx.hash}`);
  
  return { txHash: tx.hash, expiry };
}
```

---

## 6. TLSNotary Prover Server Blueprint

### Overview

The prover server is a **Rust application** using TLSNotary to perform MPC-TLS with our mock bank. It:
1. Accepts WebSocket connections from the browser (WASM verifier)
2. Performs MPC-TLS handshake with the target server (mock bank)
3. Creates a proof with selective disclosure
4. Sends proof to browser for verification

### Key Modifications from prover-demo

#### config.rs - Point to Mock Bank
```rust
// apps/prover-server/src/config.rs
use http::Uri;

pub const MAX_SENT_DATA: usize = 256;
pub const MAX_RECV_DATA: usize = 1024;

pub struct Config {
    pub ws_host: String,
    pub ws_port: u16,
    pub server_uri: Uri,
    pub wstcp_proxy_port: u16,
    pub session_timeout_secs: u64,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            ws_host: "0.0.0.0".into(),
            ws_port: 9816,
            // Point to our mock bank
            server_uri: "https://mockbank.local/api/account"
                .parse::<Uri>()
                .unwrap(),
            wstcp_proxy_port: 55688,
            session_timeout_secs: 120,
        }
    }
}
```

#### prover.rs - Extract "eligible" Field
```rust
// apps/prover-server/src/prover.rs (key parts)

fn redact_and_reveal_received_data(recv_transcript: &[u8]) -> RangeSet<usize> {
    let resp = parse_response(recv_transcript).expect("Failed to parse HTTP response");
    let body = resp.body.expect("Response body not found");
    let mut json = json::parse_slice(body.as_bytes()).expect("Failed to parse JSON");

    let body_offset = body.content.span().indices().min().unwrap();
    json.offset(body_offset);

    // Only reveal the "eligible" field for privacy
    let fields = [
        ("eligible", "\"eligible\": "),
    ];

    let ranges: Vec<_> = fields
        .iter()
        .map(|(path, prefix)| {
            let field = json.get(path).expect("eligible field not found");
            let span_indices = field.span().indices();
            let start = span_indices.min().unwrap() - prefix.len();
            let end = span_indices.max().unwrap() + 2;
            start..end
        })
        .collect();

    ranges.into()
}
```

### Dockerfile
```dockerfile
# apps/prover-server/Dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/server /usr/local/bin/prover-server
ENV RUST_LOG=info
EXPOSE 9816
CMD ["prover-server"]
```

---

## 7. Client SDK Blueprint

### Exported Functions

```typescript
// packages/client-sdk/src/index.ts
export { connectToProver, type ProverConnection } from './prover';
export { submitToRelayer, type SubmitResult } from './submitter';
export { MANTLE_SEPOLIA_CONFIG, CLAIM_TYPES } from './constants';
export * from './types';
```

### Types

```typescript
// packages/client-sdk/src/types.ts
export interface VerifiedTranscript {
  serverName: string;
  sent: Uint8Array;
  received: Uint8Array;
}

export interface ProverConnection {
  connect: (proverUrl: string) => Promise<void>;
  verify: () => Promise<VerifiedTranscript>;
  close: () => void;
}

export interface SubmitResult {
  success: boolean;
  txHash?: string;
  error?: string;
}
```

### Submitter

```typescript
// packages/client-sdk/src/submitter.ts
import { VerifiedTranscript, SubmitResult } from './types';

export async function submitToRelayer(
  relayerUrl: string,
  walletAddress: string,
  transcript: VerifiedTranscript,
  claimType: string = 'ELIGIBLE'
): Promise<SubmitResult> {
  try {
    // Extract the eligible value from received transcript
    const receivedText = new TextDecoder().decode(transcript.received);
    const eligibleMatch = receivedText.match(/"eligible":\s*(true|false)/);
    const extractedValue = eligibleMatch ? eligibleMatch[1] : 'true';

    const response = await fetch(`${relayerUrl}/submit-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        transcript: {
          sent: btoa(String.fromCharCode(...transcript.sent)),
          received: btoa(String.fromCharCode(...transcript.received)),
          serverName: transcript.serverName,
        },
        claimType,
        extractedValue,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Submission failed',
    };
  }
}
```

---

## 8. Example Webapp Blueprint

### Structure

```
apps/webapp/
├── src/
│   ├── app.tsx              # Main React component
│   ├── worker.ts            # Web Worker for WASM
│   ├── app.scss             # Styles
│   └── types.d.ts
├── tlsn-wasm-pkg/           # WASM package (from tlsn)
│   ├── tlsn_wasm.js
│   ├── tlsn_wasm.d.ts
│   ├── tlsn_wasm_bg.wasm
│   └── package.json
├── index.ejs                # HTML template
├── webpack.js               # Webpack config
├── Caddyfile                # COOP/COEP headers
├── Dockerfile
└── package.json
```

### Main App Component

```tsx
// apps/webapp/src/app.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import * as Comlink from 'comlink';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { submitToRelayer } from '@zk-rwa-kit/client-sdk';

const worker = Comlink.wrap(new Worker(new URL('./worker.ts', import.meta.url)));
const { init, Verifier, getBufferedLogs }: any = worker;

const PROVER_URL = process.env.PROVER_PROXY_URL || 'wss://localhost/prove';
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:3001';

function App() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<'connect' | 'prove' | 'submit' | 'done'>('connect');
  const [verifiedData, setVerifiedData] = useState<any>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Initialize WASM
  useEffect(() => {
    (async () => {
      await init({ loggingLevel: 'Info', hardwareConcurrency: navigator.hardwareConcurrency });
      setReady(true);
      addLog('WASM initialized');
    })();
  }, []);

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  // Step 1: Connect Wallet
  useEffect(() => {
    if (isConnected && step === 'connect') {
      setStep('prove');
      addLog(`Wallet connected: ${address}`);
    }
  }, [isConnected, address]);

  // Step 2: Generate & Verify Proof
  const handleProve = useCallback(async () => {
    addLog('Connecting to prover server...');
    try {
      const verifier = await new Verifier({ max_sent_data: 256, max_recv_data: 1024 });
      await verifier.connect(PROVER_URL);
      addLog('Connected, starting verification...');
      
      const result = await verifier.verify();
      addLog('Verification complete!');
      
      const transcript = {
        serverName: result.server_name,
        sent: new Uint8Array(result.transcript?.sent || []),
        received: new Uint8Array(result.transcript?.recv || []),
      };
      
      setVerifiedData(transcript);
      setStep('submit');
      addLog(`Verified server: ${result.server_name}`);
    } catch (error) {
      addLog(`Error: ${error}`);
    }
  }, []);

  // Step 3: Submit to Relayer
  const handleSubmit = useCallback(async () => {
    if (!address || !verifiedData) return;
    
    addLog('Submitting to relayer...');
    const result = await submitToRelayer(RELAYER_URL, address, verifiedData, 'ELIGIBLE');
    
    if (result.success) {
      setTxHash(result.txHash!);
      setStep('done');
      addLog(`Transaction submitted: ${result.txHash}`);
    } else {
      addLog(`Submission failed: ${result.error}`);
    }
  }, [address, verifiedData]);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Zk-RWA-Kit Demo</h1>
      
      {/* Wallet Connection */}
      {!isConnected ? (
        <button
          onClick={() => connect({ connector: connectors[0] })}
          className="bg-blue-600 px-6 py-3 rounded-lg"
        >
          Connect Wallet
        </button>
      ) : (
        <div className="mb-4">Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</div>
      )}

      {/* Prove Button */}
      {step === 'prove' && ready && (
        <button onClick={handleProve} className="bg-green-600 px-6 py-3 rounded-lg mt-4">
          Prove Eligibility
        </button>
      )}

      {/* Submit Button */}
      {step === 'submit' && (
        <button onClick={handleSubmit} className="bg-purple-600 px-6 py-3 rounded-lg mt-4">
          Submit to Chain
        </button>
      )}

      {/* Success */}
      {step === 'done' && txHash && (
        <div className="mt-4 p-4 bg-green-800 rounded-lg">
          <p>✅ Eligibility verified on-chain!</p>
          <a 
            href={`https://sepolia.mantlescan.xyz/tx/${txHash}`}
            target="_blank"
            className="text-blue-300 underline"
          >
            View Transaction
          </a>
        </div>
      )}

      {/* Logs */}
      <div className="mt-8 bg-slate-800 p-4 rounded-lg h-48 overflow-y-auto">
        {logs.map((log, i) => <div key={i} className="text-sm text-slate-300">{log}</div>)}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
```

---

## 9. Mock Bank Service Blueprint

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/account` | Returns account with eligibility |
| `GET` | `/health` | Health check |

### Implementation

```typescript
// apps/mock-bank/src/index.ts
import express from 'express';
import https from 'https';
import fs from 'fs';

const app = express();

// Stable account data for consistent proofs
const ACCOUNT_DATA = {
  accountId: "ACC-12345678",
  accountHolder: "Demo User",
  balance: 150000.00,
  currency: "USD",
  accountType: "checking",
  eligible: true,           // ← Key field for proof
  accredited: true,
  kycVerified: true,
  lastUpdated: "2025-01-11T00:00:00Z"
};

app.get('/api/account', (req, res) => {
  res.set({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.json(ACCOUNT_DATA);
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// HTTPS for TLS proofs
const PORT = process.env.MOCK_BANK_PORT || 3002;

if (process.env.HTTPS_ENABLED === 'true') {
  const options = {
    key: fs.readFileSync('/certs/privkey.pem'),
    cert: fs.readFileSync('/certs/fullchain.pem')
  };
  https.createServer(options, app).listen(PORT, () => {
    console.log(`Mock Bank (HTTPS) listening on port ${PORT}`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`Mock Bank (HTTP) listening on port ${PORT}`);
  });
}
```

---

## 10. Docker & Caddy Configuration

### docker-compose.yml

```yaml
version: '3.8'

services:
  # Rust TLSNotary Prover Server
  prover-server:
    build: ./apps/prover-server
    ports:
      - "9816"
    environment:
      - RUST_LOG=info
    restart: unless-stopped
    depends_on:
      - mock-bank

  # Mock Bank (HTTPS for TLS proofs)
  mock-bank:
    build: ./apps/mock-bank
    ports:
      - "3002:3002"
    environment:
      - HTTPS_ENABLED=true
      - MOCK_BANK_PORT=3002
    volumes:
      - ./certs:/certs:ro
    restart: unless-stopped

  # Relayer (chain writes)
  relayer:
    build: ./packages/relayer
    ports:
      - "3001:3001"
    env_file:
      - .env
    environment:
      - RELAYER_PORT=3001
    restart: unless-stopped

  # Webapp (React + WASM)
  webapp:
    build:
      context: ./apps/webapp
      args:
        PROVER_PROXY_URL: wss://localhost/prove
        RELAYER_URL: http://localhost:3001
    ports:
      - "80"
    restart: unless-stopped
    depends_on:
      - prover-server
      - relayer

  # Caddy Reverse Proxy (HTTPS + COOP/COEP)
  caddy:
    image: caddy:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./certs:/certs:ro
    depends_on:
      - webapp
      - prover-server
      - relayer
    restart: unless-stopped
```

### Root Caddyfile

```caddyfile
# Caddyfile
localhost {
    tls /certs/fullchain.pem /certs/privkey.pem

    # WebSocket proxy to prover server
    handle /prove {
        reverse_proxy prover-server:9816
    }

    # API proxy to relayer
    handle /api/* {
        reverse_proxy relayer:3001
    }

    # Everything else to webapp
    reverse_proxy webapp:80

    # Required headers for SharedArrayBuffer
    header /* {
        Cross-Origin-Embedder-Policy "require-corp"
        Cross-Origin-Opener-Policy "same-origin"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
    }
}

# Redirect HTTP to HTTPS
http://localhost {
    redir https://localhost{uri}
}
```

### Generate Self-Signed Certificates

```bash
# Create certs directory
mkdir -p certs

# Generate self-signed cert (for local development)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/privkey.pem \
  -out certs/fullchain.pem \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:mockbank.local"

# Add to hosts file (for mockbank.local)
echo "127.0.0.1 mockbank.local" | sudo tee -a /etc/hosts
```

---

## 11. Scripts & Commands

### Root package.json

```json
{
  "name": "zk-rwa-kit",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "build:contracts": "pnpm --filter @zk-rwa-kit/contracts build",
    "clean": "pnpm -r clean",
    "deploy": "pnpm --filter @zk-rwa-kit/contracts deploy:mantle-sepolia",
    "dev": "docker compose up",
    "dev:build": "docker compose build",
    "generate-certs": "bash scripts/generate-certs.sh",
    "test": "pnpm -r test",
    "test:contracts": "pnpm --filter @zk-rwa-kit/contracts test"
  }
}
```

### .env.example

```bash
# Network
MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz
CHAIN_ID=5003

# Deployer/Relayer Private Key (no 0x prefix)
PRIVATE_KEY=your_private_key_here

# Contract Addresses (after deployment)
ZK_ORACLE_ADDRESS=
IDENTITY_REGISTRY_ADDRESS=
COMPLIANCE_MODULE_ADDRESS=
RWA_TOKEN_ADDRESS=

# Relayer
RELAYER_PORT=3001
RELAYER_ADDRESS=

# Services
PROVER_PROXY_URL=wss://localhost/prove
RELAYER_URL=http://localhost:3001
MOCK_BANK_URL=https://mockbank.local:3002
```

---

## 12. Demo Plan

### 3-Minute Demo Script

```
[0:00-0:15] INTRO
"Zk-RWA-Kit lets you build compliant RWA apps on Mantle 
with privacy-preserving TLS proofs. Watch."

[0:15-0:45] ARCHITECTURE (show diagram)
"The user's browser verifies a TLS proof from our prover.
The proof goes to a relayer which writes to Mantle.
Tokens check compliance before every transfer."

[0:45-1:30] LIVE DEMO - PROOF FLOW
- Show webapp, connect MetaMask (Mantle Sepolia)
- Click "Prove Eligibility"
- Show WebSocket connecting to prover
- Show verification complete with transcript

[1:30-2:00] LIVE DEMO - CHAIN WRITE
- Click "Submit to Chain"
- Show transaction hash
- Open Mantle Sepolia explorer, show tx

[2:00-2:30] LIVE DEMO - COMPLIANT TOKEN
- Show user is now eligible in registry
- Mint RWA tokens
- Try transfer to non-eligible address → fails
- Add second user, transfer succeeds

[2:30-3:00] WRAP UP
"Zk-RWA-Kit: Privacy-preserving compliance infrastructure.
Open source. Works today. Built for Mantle."
```

### Backup Plans

1. **Demo Mode**: Pre-verified address already on-chain
2. **Cached Proof**: Store working proof, replay if prover fails
3. **Pre-recorded Video**: 30-second clip of successful flow
4. **Local Hardhat Fork**: If Mantle Sepolia is slow

---

## 13. Future Upgrades

### ERC-3643 Migration Path

```
Current (MVP):              ERC-3643 (Future):
IdentityRegistry    →→→     ONCHAINID
ComplianceModule    →→→     ModularCompliance  
RWAToken            →→→     ERC-3643 Token
                    +       ClaimTopicsRegistry
                    +       TrustedIssuersRegistry
```

### Decentralized Notaries

- Current: Single prover server
- Future: Multiple notaries with staking
- Proof requires N-of-M signatures

### TLS 1.3 Support

- Currently TLS 1.2 only
- TLSNotary team working on TLS 1.3
- SDK update will enable automatically

### Additional Proof Types

- **ZK-Email**: Verify emails from brokers/regulators
- **ZK-Passport**: NFC passport verification
- **ZK-Credit**: Credit score attestations

---

## Quick Start

```bash
# 1. Clone and setup
git clone https://github.com/your-org/zk-rwa-kit
cd zk-rwa-kit
cp .env.example .env
# Add your private key to .env

# 2. Generate self-signed certs
pnpm generate-certs

# 3. Deploy contracts
pnpm install
pnpm build:contracts
pnpm deploy

# 4. Update .env with deployed addresses

# 5. Start all services
pnpm dev:build
pnpm dev

# 6. Open https://localhost in browser
```

---

*This plan incorporates the TLSNotary prover-demo architecture with Docker Compose orchestration for a complete, demo-ready hackathon submission.*
