# Contract Deployment

Deploy the Zk-RWA-Kit contracts to Mantle Sepolia.

## Prerequisites

- Node.js 18+
- Private key with MNT on Mantle Sepolia
- pnpm installed

## Quick Deploy

```bash
# Clone and install
git clone https://github.com/user/zk-rwa-kit.git
cd zk-rwa-kit
pnpm install

# Configure environment
cp env.example .env
# Edit .env with your private key

# Deploy
pnpm deploy
```

## Environment Variables

```bash
# .env
DEPLOYER_PRIVATE_KEY=0x...  # Private key for deployment
MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz
```

## Manual Deployment

### 1. Compile Contracts

```bash
cd packages/contracts
pnpm build
```

### 2. Deploy Script

```typescript
// scripts/deploy.ts
import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with:', deployer.address);
  
  // 1. Deploy IdentityRegistry
  const IdentityRegistry = await ethers.getContractFactory('IdentityRegistry');
  const registry = await IdentityRegistry.deploy(deployer.address);
  await registry.waitForDeployment();
  console.log('IdentityRegistry:', await registry.getAddress());
  
  // 2. Deploy ZkOracle
  const ZkOracle = await ethers.getContractFactory('ZkOracle');
  const oracle = await ZkOracle.deploy(
    await registry.getAddress(),
    deployer.address
  );
  await oracle.waitForDeployment();
  console.log('ZkOracle:', await oracle.getAddress());
  
  // 3. Grant ORACLE_ROLE to ZkOracle
  const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ORACLE_ROLE'));
  await registry.grantRole(ORACLE_ROLE, await oracle.getAddress());
  
  // 4. Deploy RWAToken (optional)
  const RWAToken = await ethers.getContractFactory('RWAToken');
  const token = await RWAToken.deploy(
    await registry.getAddress(),
    deployer.address
  );
  await token.waitForDeployment();
  console.log('RWAToken:', await token.getAddress());
  
  // 5. Deploy Vault (optional)
  const MYieldVault = await ethers.getContractFactory('MYieldVault');
  const vault = await MYieldVault.deploy(
    await token.getAddress(),
    await registry.getAddress()
  );
  await vault.waitForDeployment();
  console.log('MYieldVault:', await vault.getAddress());
}

main().catch(console.error);
```

### 3. Run Deployment

```bash
npx hardhat run scripts/deploy.ts --network mantle-sepolia
```

## Hardhat Configuration

```typescript
// hardhat.config.ts
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'dotenv/config';

const config: HardhatUserConfig = {
  solidity: '0.8.24',
  networks: {
    'mantle-sepolia': {
      url: process.env.MANTLE_SEPOLIA_RPC_URL || 'https://rpc.sepolia.mantle.xyz',
      chainId: 5003,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
};

export default config;
```

## Post-Deployment Setup

### Grant AGENT_ROLE to Relayer

```typescript
const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes('AGENT_ROLE'));
await zkOracle.grantRole(AGENT_ROLE, RELAYER_WALLET_ADDRESS);
```

### Mint Initial Tokens (Demo)

```typescript
const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
await token.grantRole(MINTER_ROLE, deployer.address);
await token.mint(deployer.address, ethers.parseEther('1000000'));
```

## Deployed Addresses (Demo)

Current Mantle Sepolia deployment:

| Contract | Address |
|----------|---------|
| IdentityRegistry | `0x58698a19006443eD2e9F1e4284Bd0c341B1a5A12` |
| ZkOracle | See deployments file |
| mUSDY (RWAToken) | `0x1AFF98321D111A555F56FE977B3cBc01704FECBF` |
| mYieldVault | `0xc7effA35eFFE2d1EaB90B3107927CaBeE4258170` |

Check `packages/contracts/deployments/mantle-sepolia.json` for the latest addresses.

## Verification

Verify contracts on Mantlescan:

```bash
npx hardhat verify --network mantle-sepolia DEPLOYED_ADDRESS "constructor_arg_1" "constructor_arg_2"
```

## Next Steps

- [Self-Hosting Relayer](/relayer/self-hosting) — Run the relayer
- [Building a Compliant dApp](/guides/compliant-dapp) — Integrate everything
