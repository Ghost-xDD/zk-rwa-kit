# SDK Overview

The `@zk-rwa-kit/client-sdk` is the main developer entrypoint for integrating privacy-preserving compliance into your dApp.

## What It Does

1. **Generates TLS proofs** in the browser using TLSNotary WASM
2. **Extracts claims** from HTTPS responses with selective disclosure
3. **Submits proofs** to a relayer for on-chain credential issuance
4. **Tracks transactions** until confirmation

## Installation

::: code-group

```bash [npm]
npm install @zk-rwa-kit/client-sdk
```

```bash [pnpm]
pnpm add @zk-rwa-kit/client-sdk
```

:::

## Core Functions

### Proof Generation

```typescript
import { proveEligibility } from '@zk-rwa-kit/client-sdk';

const result = await proveEligibility({
  proverUrl: 'wss://...',
  timeout: 120000,
});
// result.transcript contains the verified TLS transcript
```

### Proof Submission

```typescript
import { submitProof, CLAIM_TYPES } from '@zk-rwa-kit/client-sdk';

const result = await submitProof(walletAddress, transcript, {
  claimType: CLAIM_TYPES.ELIGIBLE,
});
// result.txHash is the on-chain transaction
```

### Transaction Tracking

```typescript
import { waitForConfirmation } from '@zk-rwa-kit/client-sdk';

const status = await waitForConfirmation(txHash, {
  timeout: 60000,
  pollInterval: 2000,
});
// status.status is 'CONFIRMED' | 'PENDING' | 'FAILED'
```

## Utilities

### Transcript Parsing

```typescript
import {
  transcriptToString,
  extractClaims,
  extractField,
  parseJsonFromTranscript,
} from '@zk-rwa-kit/client-sdk';

const { sent, received } = transcriptToString(transcript);
const claims = extractClaims(received);
const bankName = extractField(received, 'bank_name');
const json = parseJsonFromTranscript(received);
```

### Serialization

```typescript
import {
  serializeTranscript,
  deserializeTranscript,
} from '@zk-rwa-kit/client-sdk';

// For storage or transport
const serialized = serializeTranscript(transcript);
const restored = deserializeTranscript(serialized);
```

## Constants

```typescript
import {
  DEFAULT_PROVER_URL,    // Production prover WebSocket
  DEFAULT_RELAYER_URL,   // Production relayer API
  MANTLE_SEPOLIA_CONFIG, // Chain config (RPC, explorer, etc.)
  CLAIM_TYPES,           // { ELIGIBLE: 'ELIGIBLE', ... }
  MAX_SENT_DATA,         // Default max bytes sent
  MAX_RECV_DATA,         // Default max bytes received
} from '@zk-rwa-kit/client-sdk';
```

## TypeScript Types

```typescript
import type {
  ProveOptions,
  ProveResult,
  SubmitOptions,
  SubmitResult,
  VerifiedTranscript,
} from '@zk-rwa-kit/client-sdk';
```

## Browser Requirements

The SDK uses TLSNotary WASM which requires `SharedArrayBuffer`. Your app must be served with:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

See [Quick Start](/getting-started/quick-start#browser-requirements) for configuration examples.

## Next Steps

- [Installation](/sdk/installation) — Detailed setup instructions
- [Proof Generation](/sdk/proof-generation) — All prover options
- [Proof Submission](/sdk/proof-submission) — Relayer submission details
