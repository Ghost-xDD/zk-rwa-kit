# Zk-RWA-Kit

> **Privacy-preserving, compliance-gated RWA toolkit for Mantle**

Built for Mantle Global Hackathon 2025

[![Mantle Sepolia](https://img.shields.io/badge/Mantle-Sepolia-blue)](https://sepolia.mantlescan.xyz)
[![TLSNotary](https://img.shields.io/badge/TLSNotary-v0.1.0--alpha.13-green)](https://tlsnotary.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Zk-RWA-Kit enables developers to build **privacy-preserving, compliance-gated Real World Asset (RWA)** workflows on Mantle. Users can prove their eligibility for RWA tokens using TLSNotary MPC-TLS proofs without exposing sensitive credentials.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Webapp     │───▶│ WASM Verifier│───▶│ Submit Proof │          │
│  │   (React)    │    │  (tlsn-wasm) │    │  to Relayer  │          │
│  └──────────────┘    └──────┬───────┘    └──────┬───────┘          │
└─────────────────────────────┼───────────────────┼──────────────────┘
                              │ WebSocket         │ HTTP POST
                              ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DOCKER COMPOSE                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │   Prover    │─▶│  Mock Bank  │  │   Relayer   │  │   Caddy   │  │
│  │   (Rust)    │  │  (Express)  │  │  (Express)  │  │  (Proxy)  │  │
│  └─────────────┘  └─────────────┘  └──────┬──────┘  └───────────┘  │
└───────────────────────────────────────────┼─────────────────────────┘
                                            │ ethers.js
                                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MANTLE SEPOLIA (Chain ID: 5003)                   │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────────┐        │
│  │ ZkOracle │───▶│IdentityRegistry │◀───│ ComplianceModule │        │
│  └──────────┘    └─────────────────┘    └────────┬─────────┘        │
│                                                   │                  │
│                                         ┌────────▼─────────┐        │
│                                         │     RWAToken     │        │
│                                         │ (compliance-gated)│        │
│                                         └──────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose
- Rust (for prover-server)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/zk-rwa-kit
cd zk-rwa-kit

# 2. Copy environment file
cp env.example .env
# Edit .env and add your PRIVATE_KEY

# 3. Install dependencies
pnpm install

# 4. Build and deploy contracts
pnpm build:contracts
pnpm deploy
# Copy the output addresses to .env

# 5. Generate SSL certificates (for local HTTPS)
pnpm generate-certs

# 6. Start all services with Docker
pnpm docker:build
pnpm docker:up

# 7. Open https://localhost in your browser
```

### Development (without Docker)

```bash
# Terminal 1: Start local Hardhat node
pnpm dev:contracts

# Terminal 2: Start relayer
pnpm dev:relayer

# Terminal 3: Start mock bank
pnpm dev:mock-bank

# Terminal 4: Build and run prover server
cd apps/prover-server && cargo run

# Terminal 5: Start webapp (needs COOP/COEP headers)
cd apps/webapp && pnpm dev
```

## Project Structure

```
zk-rwa-kit/
├── packages/
│   ├── contracts/           # Solidity contracts (@zk-rwa-kit/contracts)
│   │   ├── contracts/       # ZkOracle, IdentityRegistry, ComplianceModule, RWAToken
│   │   ├── scripts/         # Deployment scripts
│   │   └── test/            # Contract tests
│   │
│   └── relayer/             # Relayer service (@zk-rwa-kit/relayer)
│       └── src/             # Express server, chain writes
│
├── apps/
│   ├── webapp/              # React webapp with WASM verifier
│   │   ├── src/             # React components
│   │   └── tlsn-wasm-pkg/   # TLSNotary WASM binaries
│   │
│   ├── prover-server/       # Rust TLSNotary prover
│   │   └── src/             # MPC-TLS implementation
│   │
│   └── mock-bank/           # Mock bank API for demos
│
├── docker-compose.yml       # Orchestration for all services
├── Caddyfile               # Reverse proxy with COOP/COEP headers
└── IMPLEMENTATION_PLAN.md   # Detailed technical documentation
```

## Packages

| Package | Description | 
|---------|-------------|
| `@zk-rwa-kit/contracts` | Solidity contracts: ZkOracle, IdentityRegistry, ComplianceModule, RWAToken |
| `@zk-rwa-kit/relayer` | Express service for proof verification and gas-sponsored chain writes |

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `ZkOracle` | Receives verified claims from relayer, writes to IdentityRegistry |
| `IdentityRegistry` | Stores identity claims (eligible, accredited, etc.) by address |
| `ComplianceModule` | Implements `canTransfer()` check for token operations |
| `RWAToken` | ERC-20 with compliance-gated mint and transfer |

## User Flow

1. **Connect Wallet** - User connects MetaMask to Mantle Sepolia
2. **Generate Proof** - Browser connects to prover server via WebSocket
3. **MPC-TLS Verification** - Prover fetches data from mock bank using TLSNotary
4. **Proof Verification** - WASM verifier in browser validates the proof
5. **Submit to Chain** - Relayer receives proof and writes claim to ZkOracle
6. **Token Operations** - User can now mint/transfer RWA tokens

## Network Configuration

- **Network**: Mantle Sepolia Testnet
- **Chain ID**: 5003
- **RPC**: https://rpc.sepolia.mantle.xyz
- **Explorer**: https://sepolia.mantlescan.xyz

## Scripts

```bash
pnpm build:contracts   # Compile Solidity contracts
pnpm test:contracts    # Run contract tests
pnpm deploy            # Deploy to Mantle Sepolia
pnpm docker:build      # Build all Docker images
pnpm docker:up         # Start all services
pnpm docker:down       # Stop all services
pnpm generate-certs    # Generate self-signed SSL certs
```

## Documentation

- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Detailed technical blueprint
- [Contracts](./packages/contracts/README.md) - Smart contract documentation

## Security Notes

⚠️ **This is hackathon code - not production ready**

- Private keys should never be committed
- The mock bank is for demo purposes only
- TLS proofs are verified by a single prover server
- Rate limiting is basic

## Future Roadmap

- [ ] Full ERC-3643 compatibility
- [ ] Decentralized notary network
- [ ] TLS 1.3 support
- [ ] ZK-Email integration
- [ ] Multi-chain deployment

## License

MIT

---

Built with ❤️ for Mantle Global Hackathon 2025
