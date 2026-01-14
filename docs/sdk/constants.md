# Constants & Types

## Constants

### Default URLs

```typescript
import {
  DEFAULT_PROVER_URL,
  DEFAULT_RELAYER_URL,
} from '@zk-rwa-kit/client-sdk';

// Production prover server
DEFAULT_PROVER_URL = 'wss://zk-rwa-prover-production.up.railway.app/prove';

// Production relayer API
DEFAULT_RELAYER_URL = 'https://zk-rwa-kitrelayer-production.up.railway.app';
```

### Data Limits

```typescript
import { MAX_SENT_DATA, MAX_RECV_DATA } from '@zk-rwa-kit/client-sdk';

MAX_SENT_DATA = 4096; // 4 KB max request size
MAX_RECV_DATA = 16384; // 16 KB max response size
```

### Claim Types

```typescript
import { CLAIM_TYPES } from '@zk-rwa-kit/client-sdk';

CLAIM_TYPES = {
  ELIGIBLE: 'ELIGIBLE',
  // Add custom claim types as needed
};
```

### Chain Configuration

```typescript
import { MANTLE_SEPOLIA_CONFIG } from '@zk-rwa-kit/client-sdk';

MANTLE_SEPOLIA_CONFIG = {
  chainId: 5003,
  name: 'Mantle Sepolia',
  rpcUrl: 'https://rpc.sepolia.mantle.xyz',
  explorerUrl: 'https://sepolia.mantlescan.xyz',
};
```

## Types

### Proof Generation

```typescript
interface ProveOptions {
  proverUrl?: string;
  maxSentData?: number;
  maxRecvData?: number;
  timeout?: number;
  demoMode?: boolean;
}

interface ProveResult {
  success: boolean;
  transcript?: VerifiedTranscript;
  error?: string;
}
```

### Proof Submission

```typescript
interface SubmitOptions {
  relayerUrl?: string;
  claimType?: string;
  extractedValue?: string;
  timeout?: number;
}

interface SubmitResult {
  success: boolean;
  txHash?: string;
  claimType?: string;
  claimValue?: string;
  expiry?: number;
  error?: string;
  code?: string;
}
```

### Transcript

```typescript
interface VerifiedTranscript {
  sent: string;
  received: string;
  serverName: string;
}
```

### Transaction Status

```typescript
type TransactionStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

interface StatusResult {
  status: TransactionStatus;
  blockNumber?: number;
  error?: string;
}
```

## Importing Types

For TypeScript users, import types directly:

```typescript
import type {
  ProveOptions,
  ProveResult,
  SubmitOptions,
  SubmitResult,
  VerifiedTranscript,
} from '@zk-rwa-kit/client-sdk';
```

## Contract Addresses (Mantle Sepolia)

These are the deployed contract addresses for the demo:

| Contract           | Address                                      |
| ------------------ | -------------------------------------------- |
| IdentityRegistry   | `0x58698a19006443eD2e9F1e4284Bd0c341B1a5A12` |
| ZkOracle           | `0x...`                                      |
| mUSDY (Mock Token) | `0x1AFF98321D111A555F56FE977B3cBc01704FECBF` |
| mYieldVault        | `0xc7effA35eFFE2d1EaB90B3107927CaBeE4258170` |

::: info
Check the [deployments file](https://github.com/Ghost-xDD/zk-rwa-kit/blob/main/packages/contracts/deployments/mantle-sepolia.json) for the latest addresses.
:::

## Next Steps

- [Relayer API](/relayer/overview) — Understand the relayer
- [Smart Contracts](/contracts/overview) — On-chain components
