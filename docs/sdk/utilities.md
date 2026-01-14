# Utilities

The SDK includes utilities for parsing and inspecting TLS transcripts.

## Transcript Conversion

### `transcriptToString()`

Convert binary transcript data to readable strings:

```typescript
import { transcriptToString } from '@zk-rwa-kit/client-sdk';

const { sent, received } = transcriptToString(transcript);

console.log('Request:', sent);
// GET /api/user HTTP/1.1
// Host: bank.example.com
// ...

console.log('Response:', received);
// HTTP/1.1 200 OK
// Content-Type: application/json
// {"eligible": true, "country": "US", ...}
```

## Claim Extraction

### `extractClaims()`

Extract all claims from a transcript response:

```typescript
import { extractClaims } from '@zk-rwa-kit/client-sdk';

const claims = extractClaims(receivedString);
// { eligible: true, country: 'US', verified_at: '2024-01-15' }
```

### `extractField()`

Extract a single field:

```typescript
import { extractField } from '@zk-rwa-kit/client-sdk';

const eligible = extractField(receivedString, 'eligible');
// 'true'

const country = extractField(receivedString, 'country');
// 'US'
```

### `extractFields()`

Extract multiple fields at once:

```typescript
import { extractFields } from '@zk-rwa-kit/client-sdk';

const fields = extractFields(receivedString, ['eligible', 'country']);
// { eligible: 'true', country: 'US' }
```

## JSON Parsing

### `parseJsonFromTranscript()`

Parse the JSON body from an HTTP response:

```typescript
import { parseJsonFromTranscript } from '@zk-rwa-kit/client-sdk';

const json = parseJsonFromTranscript(receivedString);
// { eligible: true, country: 'US', bank_name: 'Demo Bank', ... }
```

## Validation

### `hasFieldValue()`

Check if a field has a specific value:

```typescript
import { hasFieldValue } from '@zk-rwa-kit/client-sdk';

const isEligible = hasFieldValue(receivedString, 'eligible', 'true');
// true or false
```

### `isEligibleFromTranscript()`

Quick check for eligibility claim:

```typescript
import { isEligibleFromTranscript } from '@zk-rwa-kit/client-sdk';

const eligible = isEligibleFromTranscript(receivedString);
// true or false
```

## Serialization

### `serializeTranscript()` / `deserializeTranscript()`

For storage or transport:

```typescript
import {
  serializeTranscript,
  deserializeTranscript,
} from '@zk-rwa-kit/client-sdk';

// Serialize to JSON string
const serialized = serializeTranscript(transcript);
localStorage.setItem('proof', serialized);

// Deserialize back
const stored = localStorage.getItem('proof');
const restored = deserializeTranscript(stored);
```

## Complete Example

```typescript
import {
  proveEligibility,
  transcriptToString,
  extractClaims,
  parseJsonFromTranscript,
  isEligibleFromTranscript,
} from '@zk-rwa-kit/client-sdk';

async function analyzeProof() {
  const { transcript } = await proveEligibility();

  // Convert to strings
  const { sent, received } = transcriptToString(transcript);

  // Parse the response
  const json = parseJsonFromTranscript(received);
  console.log('Full response:', json);

  // Extract specific claims
  const claims = extractClaims(received);
  console.log('Claims:', claims);

  // Check eligibility
  if (isEligibleFromTranscript(received)) {
    console.log('User is eligible!');
  }

  return { transcript, claims };
}
```

## Type Reference

```typescript
interface VerifiedTranscript {
  sent: string; // Base64 encoded request bytes
  received: string; // Base64 encoded response bytes
  serverName: string; // Server hostname
}
```

## Next Steps

- [Constants & Types](/sdk/constants) — All exported constants and types
- [Proof Submission](/sdk/proof-submission) — Submit to the relayer
