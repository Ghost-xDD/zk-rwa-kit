# Self-Hosting the Relayer

Run your own relayer for production deployments.

## Prerequisites

- Node.js 18+
- A wallet with MNT on Mantle Sepolia (for gas)
- Deployed contracts (IdentityRegistry, ZkOracle)

## Installation

```bash
# Clone the repo
git clone https://github.com/user/zk-rwa-kit.git
cd zk-rwa-kit

# Install dependencies
pnpm install

# Build the relayer
pnpm --filter @zk-rwa-kit/relayer build
```

## Configuration

Create a `.env` file in the project root:

```bash
# Required
MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz
RELAYER_PRIVATE_KEY=0x...  # Must have AGENT_ROLE on ZkOracle
ZK_ORACLE_ADDRESS=0x...
RWA_TOKEN_ADDRESS=0x...

# Optional
RELAYER_PORT=3001
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10
```

## Environment Variables

| Variable                  | Required | Description                           |
| ------------------------- | -------- | ------------------------------------- |
| `MANTLE_SEPOLIA_RPC_URL`  | Yes      | Mantle Sepolia RPC endpoint           |
| `RELAYER_PRIVATE_KEY`     | Yes      | Private key with AGENT_ROLE           |
| `ZK_ORACLE_ADDRESS`       | Yes      | Deployed ZkOracle address             |
| `RWA_TOKEN_ADDRESS`       | Yes      | Token address for minting             |
| `RELAYER_PORT`            | No       | Port to listen on (default: 3001)     |
| `RATE_LIMIT_WINDOW_MS`    | No       | Rate limit window (default: 60000)    |
| `RATE_LIMIT_MAX_REQUESTS` | No       | Max requests per window (default: 10) |

## Running

### Development

```bash
pnpm dev:relayer
```

### Production

```bash
cd packages/relayer
pnpm build
node dist/index.js
```

## Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY packages/relayer ./packages/relayer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN npm install -g pnpm
RUN pnpm install --filter @zk-rwa-kit/relayer
RUN pnpm --filter @zk-rwa-kit/relayer build

EXPOSE 3001
CMD ["node", "packages/relayer/dist/index.js"]
```

```bash
docker build -t zk-rwa-relayer .
docker run -p 3001:3001 --env-file .env zk-rwa-relayer
```

## Granting AGENT_ROLE

The relayer wallet needs `AGENT_ROLE` on the ZkOracle contract:

```typescript
import { ethers } from 'ethers';

const zkOracle = new ethers.Contract(
  ZK_ORACLE_ADDRESS,
  ['function grantRole(bytes32, address)'],
  adminSigner
);

const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes('AGENT_ROLE'));
await zkOracle.grantRole(AGENT_ROLE, relayerWalletAddress);
```

## Health Monitoring

The `/health` endpoint returns configuration status:

```bash
curl http://localhost:3001/health
```

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "chain": {
    "rpc": "configured",
    "oracle": "configured",
    "token": "configured"
  }
}
```

## Deployment Platforms

### Railway

1. Create a new project
2. Add environment variables
3. Deploy from GitHub

### Render

1. Create a Web Service
2. Set build command: `pnpm install && pnpm --filter @zk-rwa-kit/relayer build`
3. Set start command: `node packages/relayer/dist/index.js`

### Fly.io

```bash
fly launch
fly secrets set MANTLE_SEPOLIA_RPC_URL=... RELAYER_PRIVATE_KEY=...
fly deploy
```

## Security Considerations

1. **Protect the private key** — Use secrets management
2. **Rate limit aggressively** — Prevent abuse
3. **Monitor transactions** — Alert on failures
4. **Fund the wallet** — Keep enough MNT for gas
5. **Rotate keys** — If compromised, revoke AGENT_ROLE

## Next Steps

- [Contracts Overview](/contracts/overview) — Understand the on-chain layer
- [ZkOracle](/contracts/zk-oracle) — The oracle contract
