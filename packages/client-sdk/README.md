# @zk-rwa-kit/client-sdk

Client SDK for Zk-RWA-Kit. Generate TLSNotary proofs in the browser, extract
selective disclosure claims, and submit proofs to a relayer for on-chain
SessionCredentials.

## Installation

```bash
npm install @zk-rwa-kit/client-sdk
# or
pnpm add @zk-rwa-kit/client-sdk
```

## Quick Start

```ts
import {
  CLAIM_TYPES,
  DEFAULT_PROVER_URL,
  DEFAULT_RELAYER_URL,
  proveEligibility,
  submitProof,
  waitForConfirmation,
} from '@zk-rwa-kit/client-sdk';

// 1) Generate TLS proof (browser-only)
const prove = await proveEligibility({
  proverUrl: DEFAULT_PROVER_URL,
});
if (!prove.success || !prove.transcript) throw new Error(prove.error);

// 2) Submit proof to relayer
const submit = await submitProof(
  '0x1234567890123456789012345678901234567890',
  prove.transcript,
  { relayerUrl: DEFAULT_RELAYER_URL, claimType: CLAIM_TYPES.ELIGIBLE }
);
if (!submit.success) throw new Error(submit.error);

// 3) Wait for tx confirmation
const confirmation = await waitForConfirmation(submit.txHash!, {
  relayerUrl: DEFAULT_RELAYER_URL,
});
console.log('status:', confirmation.status);
```

## Browser Requirements (Important)

TLSNotary WASM uses `SharedArrayBuffer`. Your app must be served with COOP/COEP:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

If you deploy on Vercel, add these headers (see `examples/*/vercel.json`).

## Default Endpoints

Defaults are configured for Railway deployments:

- `DEFAULT_PROVER_URL`: `wss://zk-rwa-prover-production.up.railway.app/prove`
- `DEFAULT_RELAYER_URL`: `https://zk-rwa-kitrelayer-production.up.railway.app`

Override them via options if you use local services.

## API Reference

### `proveEligibility(options)`

Generates a TLS proof of eligibility in the browser.

**Options:**

- `proverUrl` - WebSocket URL (default: `DEFAULT_PROVER_URL`)
- `maxSentData` - Max bytes sent to server (default: `MAX_SENT_DATA`)
- `maxRecvData` - Max bytes received from server (default: `MAX_RECV_DATA`)
- `timeout` - Milliseconds (default: 120000)
- `demoMode` - Use cached proof (default: false)

**Returns:** `ProveResult`

### `submitProof(walletAddress, transcript, options)`

Submits the proof to the relayer for verification and on-chain credential.

**Options:**

- `relayerUrl` - Relayer base URL (default: `DEFAULT_RELAYER_URL`)
- `claimType` - Claim type (default: `CLAIM_TYPES.ELIGIBLE`)
- `extractedValue` - Optional override for extracted value
- `timeout` - Request timeout in ms

**Returns:** `SubmitResult`

### `checkTransactionStatus(txHash, relayerUrl?)`

Returns `PENDING | CONFIRMED | FAILED` and any error info.

### `waitForConfirmation(txHash, options?)`

Polls the relayer until confirmation or timeout.

### Transcript Utilities

```ts
import {
  transcriptToString,
  extractClaims,
  extractField,
  parseJsonFromTranscript,
} from '@zk-rwa-kit/client-sdk';

const { received } = transcriptToString(transcript);
const claims = extractClaims(received);
const bankName = extractField(received, 'bank_name');
const json = parseJsonFromTranscript(received);
```

## Constants

```ts
import {
  MANTLE_SEPOLIA_CONFIG,
  CLAIM_TYPES,
  DEFAULT_PROVER_URL,
  DEFAULT_RELAYER_URL,
  MAX_SENT_DATA,
  MAX_RECV_DATA,
} from '@zk-rwa-kit/client-sdk';
```

## Types

```ts
import type {
  ProveOptions,
  ProveResult,
  SubmitOptions,
  SubmitResult,
  VerifiedTranscript,
} from '@zk-rwa-kit/client-sdk';
```

## Troubleshooting

### WebSocket fails to connect

- Ensure the prover URL is `wss://` in production.
- Make sure COOP/COEP headers are set.
- Check that the prover exposes `/prove` and your host allows WebSocket.

### Relayer says "token missing"

- Set `RWA_TOKEN_ADDRESS` (mUSDY) in the relayer environment.

### "Transfer not compliant"

- Make sure the recipient has an on-chain SessionCredential.

## License

MIT
