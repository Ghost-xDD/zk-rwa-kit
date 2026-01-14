# Proof Generation

The `proveEligibility()` function generates a TLSNotary proof in the browser.

## Basic Usage

```typescript
import { proveEligibility } from '@zk-rwa-kit/client-sdk';

const result = await proveEligibility();

if (result.success && result.transcript) {
  console.log('Proof generated!');
  console.log('Server:', result.transcript.serverName);
} else {
  console.error('Failed:', result.error);
}
```

## Options

```typescript
interface ProveOptions {
  /** WebSocket URL of the prover server */
  proverUrl?: string;

  /** Maximum bytes to send (default: 4096) */
  maxSentData?: number;

  /** Maximum bytes to receive (default: 16384) */
  maxRecvData?: number;

  /** Timeout in milliseconds (default: 120000) */
  timeout?: number;

  /** Use demo mode with cached proof (default: false) */
  demoMode?: boolean;
}
```

## Full Example

```typescript
import {
  proveEligibility,
  DEFAULT_PROVER_URL,
  MAX_SENT_DATA,
  MAX_RECV_DATA,
} from '@zk-rwa-kit/client-sdk';

const result = await proveEligibility({
  proverUrl: DEFAULT_PROVER_URL,
  maxSentData: MAX_SENT_DATA,
  maxRecvData: MAX_RECV_DATA,
  timeout: 120000,
  demoMode: false,
});
```

## Return Value

```typescript
interface ProveResult {
  /** Whether proof generation succeeded */
  success: boolean;

  /** The verified transcript (if successful) */
  transcript?: VerifiedTranscript;

  /** Error message (if failed) */
  error?: string;
}

interface VerifiedTranscript {
  /** Raw bytes sent to server (base64) */
  sent: string;

  /** Raw bytes received from server (base64) */
  received: string;

  /** The server's hostname */
  serverName: string;
}
```

## Demo Mode

For testing and demos, use `demoMode: true` to skip the actual TLS proof:

```typescript
const result = await proveEligibility({
  demoMode: true,
});
// Returns a cached/mock transcript instantly
```

::: warning
Demo mode is for development only. The transcript won't pass real verification.
:::

## Error Handling

```typescript
const result = await proveEligibility();

if (!result.success) {
  switch (true) {
    case result.error?.includes('WebSocket'):
      console.error('Failed to connect to prover server');
      break;
    case result.error?.includes('timeout'):
      console.error('Proof generation timed out');
      break;
    case result.error?.includes('SharedArrayBuffer'):
      console.error('Missing COOP/COEP headers');
      break;
    default:
      console.error('Unknown error:', result.error);
  }
}
```

## Custom Prover Server

If you're self-hosting the prover server:

```typescript
const result = await proveEligibility({
  proverUrl: 'wss://your-prover.example.com/prove',
});
```

The prover server must:

- Accept WebSocket connections at `/prove`
- Run the TLSNotary notary protocol
- Be reachable from the user's browser

## Performance Tips

1. **Preconnect** to the prover URL for faster initial connection:

   ```html
   <link
     rel="preconnect"
     href="https://zk-rwa-prover-production.up.railway.app"
   />
   ```

2. **Show progress** — proof generation takes 30-60 seconds:

   ```typescript
   setStatus('Connecting to prover...');
   const result = await proveEligibility();
   setStatus('Done!');
   ```

3. **Handle timeouts** gracefully — network issues are common:
   ```typescript
   const result = await proveEligibility({ timeout: 180000 }); // 3 min
   ```

## Next Steps

- [Proof Submission](/sdk/proof-submission) — Submit the transcript
- [Utilities](/sdk/utilities) — Parse and inspect transcripts
