# @zk-rwa-kit/client-sdk

Client SDK for Zk-RWA-Kit - privacy-preserving RWA compliance verification.

## Installation

```bash
npm install @zk-rwa-kit/client-sdk
# or
pnpm add @zk-rwa-kit/client-sdk
```

## Usage

### Basic Flow

```typescript
import { 
  proveEligibility, 
  submitProof,
  waitForConfirmation 
} from '@zk-rwa-kit/client-sdk';

// 1. Generate TLS proof
const proveResult = await proveEligibility({
  proverUrl: 'wss://localhost/prove',
});

if (!proveResult.success) {
  throw new Error(proveResult.error);
}

// 2. Submit to relayer
const submitResult = await submitProof(
  '0x1234567890123456789012345678901234567890',
  proveResult.transcript!,
  { claimType: 'ELIGIBLE' }
);

if (!submitResult.success) {
  throw new Error(submitResult.error);
}

console.log('Transaction:', submitResult.txHash);

// 3. Wait for confirmation
const confirmation = await waitForConfirmation(submitResult.txHash!);
console.log('Status:', confirmation.status);
```

### Demo Mode

For reliable demonstrations, use demo mode:

```typescript
const result = await proveEligibility({
  demoMode: true, // Uses cached proof
});
```

### Extract Claims from Transcript

```typescript
import { extractClaims, transcriptToString } from '@zk-rwa-kit/client-sdk';

// Convert transcript to readable string
const { received } = transcriptToString(transcript);

// Extract all claims
const claims = extractClaims(received);
console.log('Eligible:', claims.eligible);
console.log('Accredited:', claims.accredited);
console.log('KYC Verified:', claims.kycVerified);
```

## API Reference

### `proveEligibility(options)`

Generate a TLS proof of eligibility.

**Options:**
- `proverUrl` - WebSocket URL of prover server (default: `wss://localhost/prove`)
- `maxSentData` - Max bytes to send (default: 512)
- `maxRecvData` - Max bytes to receive (default: 2048)
- `timeout` - Timeout in ms (default: 120000)
- `demoMode` - Use cached proof (default: false)

**Returns:** `ProveResult`

### `submitProof(walletAddress, transcript, options)`

Submit proof to relayer for on-chain registration.

**Options:**
- `relayerUrl` - Relayer API URL (default: `http://localhost:3001`)
- `claimType` - Claim type (default: `ELIGIBLE`)
- `extractedValue` - Override extracted value
- `timeout` - Request timeout in ms

**Returns:** `SubmitResult`

### `checkTransactionStatus(txHash, relayerUrl)`

Check status of a submitted transaction.

### `waitForConfirmation(txHash, options)`

Wait for transaction confirmation.

## Constants

```typescript
import { 
  MANTLE_SEPOLIA_CONFIG,
  CLAIM_TYPES,
  DEFAULT_PROVER_URL,
  DEFAULT_RELAYER_URL 
} from '@zk-rwa-kit/client-sdk';
```

## Requirements

- Browser with SharedArrayBuffer support (requires COOP/COEP headers)
- For server-side: Node.js 18+

## License

MIT
