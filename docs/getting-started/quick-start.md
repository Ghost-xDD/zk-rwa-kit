# Quick Start

Get Zk-RWA-Kit running in your dApp in under 5 minutes.

## Prerequisites

- Node.js 18+
- A wallet on Mantle Sepolia
- Your app must serve COOP/COEP headers (see [Browser Requirements](#browser-requirements))

## Installation

::: code-group

```bash [npm]
npm install @zk-rwa-kit/client-sdk
```

```bash [pnpm]
pnpm add @zk-rwa-kit/client-sdk
```

```bash [yarn]
yarn add @zk-rwa-kit/client-sdk
```

:::

## Basic Usage

```typescript
import {
  proveEligibility,
  submitProof,
  waitForConfirmation,
  CLAIM_TYPES,
  DEFAULT_PROVER_URL,
  DEFAULT_RELAYER_URL,
} from '@zk-rwa-kit/client-sdk';

async function getCompliant(walletAddress: string) {
  // 1. Generate TLS proof in browser
  console.log('Generating proof...');
  const prove = await proveEligibility({
    proverUrl: DEFAULT_PROVER_URL,
  });
  
  if (!prove.success || !prove.transcript) {
    throw new Error(prove.error || 'Proof generation failed');
  }

  // 2. Submit proof to relayer
  console.log('Submitting proof...');
  const submit = await submitProof(walletAddress, prove.transcript, {
    relayerUrl: DEFAULT_RELAYER_URL,
    claimType: CLAIM_TYPES.ELIGIBLE,
  });
  
  if (!submit.success) {
    throw new Error(submit.error || 'Submission failed');
  }

  // 3. Wait for on-chain confirmation
  console.log('Waiting for confirmation...');
  const confirmation = await waitForConfirmation(submit.txHash!, {
    relayerUrl: DEFAULT_RELAYER_URL,
  });

  console.log('✅ Session credential active!');
  return confirmation;
}
```

## Browser Requirements

TLSNotary WASM uses `SharedArrayBuffer`, which requires specific HTTP headers:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

### Vercel Configuration

Add to your `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
      ]
    }
  ]
}
```

### Local Development

Use the included Caddyfile or configure your dev server to add the headers.

## Default Endpoints

The SDK is pre-configured with production endpoints:

| Endpoint | URL |
|----------|-----|
| Prover Server | `wss://zk-rwa-prover-production.up.railway.app/prove` |
| Relayer API | `https://zk-rwa-kitrelayer-production.up.railway.app` |

Override these if you're self-hosting:

```typescript
const prove = await proveEligibility({
  proverUrl: 'wss://your-prover.example.com/prove',
});

const submit = await submitProof(wallet, transcript, {
  relayerUrl: 'https://your-relayer.example.com',
});
```

## Checking Credential Status

After submission, you can verify the credential on-chain:

```typescript
import { ethers } from 'ethers';

const IDENTITY_REGISTRY = '0x58698a19006443eD2e9F1e4284Bd0c341B1a5A12';
const ELIGIBLE_CLAIM = ethers.keccak256(ethers.toUtf8Bytes('ELIGIBLE'));

const registry = new ethers.Contract(
  IDENTITY_REGISTRY,
  ['function isVerified(address, bytes32) view returns (bool)'],
  provider
);

const isVerified = await registry.isVerified(walletAddress, ELIGIBLE_CLAIM);
console.log('Verified:', isVerified);
```

## Next Steps

- [Architecture](/getting-started/architecture) — Understand the full flow
- [Proof Generation](/sdk/proof-generation) — Customize proof options
- [Troubleshooting](/guides/troubleshooting) — Common issues and fixes
