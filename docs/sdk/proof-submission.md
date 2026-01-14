# Proof Submission

The `submitProof()` function sends a verified transcript to the relayer for on-chain credential issuance.

## Basic Usage

```typescript
import { submitProof, CLAIM_TYPES } from '@zk-rwa-kit/client-sdk';

const result = await submitProof(walletAddress, transcript, {
  claimType: CLAIM_TYPES.ELIGIBLE,
});

if (result.success) {
  console.log('Transaction:', result.txHash);
} else {
  console.error('Failed:', result.error);
}
```

## Function Signature

```typescript
function submitProof(
  walletAddress: string,
  transcript: VerifiedTranscript,
  options?: SubmitOptions
): Promise<SubmitResult>;
```

## Options

```typescript
interface SubmitOptions {
  /** Base URL of the relayer (default: DEFAULT_RELAYER_URL) */
  relayerUrl?: string;
  
  /** Claim type to register (default: CLAIM_TYPES.ELIGIBLE) */
  claimType?: string;
  
  /** Override extracted value from transcript */
  extractedValue?: string;
  
  /** Request timeout in milliseconds */
  timeout?: number;
}
```

## Return Value

```typescript
interface SubmitResult {
  /** Whether submission succeeded */
  success: boolean;
  
  /** Transaction hash (if successful) */
  txHash?: string;
  
  /** The claim type that was registered */
  claimType?: string;
  
  /** The claim value */
  claimValue?: string;
  
  /** Credential expiry timestamp */
  expiry?: number;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Error code (if failed) */
  code?: string;
}
```

## Full Example

```typescript
import {
  submitProof,
  CLAIM_TYPES,
  DEFAULT_RELAYER_URL,
} from '@zk-rwa-kit/client-sdk';

const result = await submitProof(
  '0x1234567890123456789012345678901234567890',
  transcript,
  {
    relayerUrl: DEFAULT_RELAYER_URL,
    claimType: CLAIM_TYPES.ELIGIBLE,
    timeout: 30000,
  }
);

if (result.success) {
  console.log('TX Hash:', result.txHash);
  console.log('Expires:', new Date(result.expiry! * 1000));
}
```

## Tracking Transaction Status

After submission, track the transaction:

```typescript
import {
  checkTransactionStatus,
  waitForConfirmation,
} from '@zk-rwa-kit/client-sdk';

// Quick check
const status = await checkTransactionStatus(txHash);
console.log(status.status); // 'PENDING' | 'CONFIRMED' | 'FAILED'

// Wait for confirmation
const confirmed = await waitForConfirmation(txHash, {
  timeout: 60000,
  pollInterval: 2000,
});

if (confirmed.status === 'CONFIRMED') {
  console.log('Credential is now active!');
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `MISSING_FIELD` | Required field missing from request |
| `INVALID_TRANSCRIPT` | Transcript validation failed |
| `RATE_LIMITED` | Too many requests |
| `CHAIN_ERROR` | On-chain transaction failed |
| `INTERNAL_ERROR` | Server error |

## Error Handling

```typescript
const result = await submitProof(wallet, transcript);

if (!result.success) {
  switch (result.code) {
    case 'MISSING_FIELD':
      console.error('Invalid request');
      break;
    case 'INVALID_TRANSCRIPT':
      console.error('Proof verification failed');
      break;
    case 'RATE_LIMITED':
      console.error('Please wait before retrying');
      break;
    case 'CHAIN_ERROR':
      console.error('Transaction failed:', result.error);
      break;
    default:
      console.error('Error:', result.error);
  }
}
```

## Custom Relayer

If you're self-hosting the relayer:

```typescript
const result = await submitProof(wallet, transcript, {
  relayerUrl: 'https://your-relayer.example.com',
});
```

The relayer must implement:
- `POST /submit-proof` — Receive and verify proofs
- `GET /status/:txHash` — Return transaction status

## Next Steps

- [Utilities](/sdk/utilities) — Parse and inspect transcripts
- [Relayer API](/relayer/overview) — Self-host the relayer
