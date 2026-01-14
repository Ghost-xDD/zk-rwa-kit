# Custom Claim Types

Extend Zk-RWA-Kit with your own claim types for different eligibility levels.

## Overview

The default claim type is `ELIGIBLE`, but you can add:
- `ACCREDITED` — Accredited investor status
- `NON_SANCTIONED` — OFAC/sanctions check
- `KYC_VERIFIED` — Full KYC completion
- Any custom claim you need

## Defining Claim Types

### In Contracts

```solidity
// Define as keccak256 hash
bytes32 public constant ELIGIBLE = keccak256("ELIGIBLE");
bytes32 public constant ACCREDITED = keccak256("ACCREDITED");
bytes32 public constant INSTITUTIONAL = keccak256("INSTITUTIONAL");
```

### In TypeScript

```typescript
import { ethers } from 'ethers';

const CLAIM_TYPES = {
  ELIGIBLE: 'ELIGIBLE',
  ACCREDITED: 'ACCREDITED',
  INSTITUTIONAL: 'INSTITUTIONAL',
};

// Convert to bytes32 for contract calls
const claimTypeHash = ethers.keccak256(ethers.toUtf8Bytes('ACCREDITED'));
```

## Submitting Custom Claims

### Via SDK

```typescript
import { submitProof } from '@zk-rwa-kit/client-sdk';

const result = await submitProof(walletAddress, transcript, {
  claimType: 'ACCREDITED',
  extractedValue: 'true',
});
```

### Custom Relayer Logic

Modify the relayer to validate different claim types:

```typescript
// relayer/services/verifier.ts
export function validateTranscript(
  transcript: any,
  claimType: string,
  extractedValue?: string
) {
  const { received } = transcriptToString(transcript);
  
  switch (claimType) {
    case 'ELIGIBLE':
      return extractField(received, 'eligible') === 'true';
      
    case 'ACCREDITED':
      return extractField(received, 'accredited_investor') === 'true';
      
    case 'INSTITUTIONAL':
      return extractField(received, 'account_type') === 'institutional';
      
    default:
      return false;
  }
}
```

## Checking Multiple Claims

### In Contracts

```solidity
function requiresMultipleClaims(address user) internal view {
    require(
        registry.isVerified(user, ELIGIBLE) &&
        registry.isVerified(user, ACCREDITED),
        "Missing required claims"
    );
}
```

### In TypeScript

```typescript
async function checkAllClaims(address: string) {
  const claims = ['ELIGIBLE', 'ACCREDITED', 'NON_SANCTIONED'];
  
  const results = await Promise.all(
    claims.map(claim => 
      registry.isVerified(
        address,
        ethers.keccak256(ethers.toUtf8Bytes(claim))
      )
    )
  );
  
  return claims.reduce((acc, claim, i) => {
    acc[claim] = results[i];
    return acc;
  }, {} as Record<string, boolean>);
}
```

## Tiered Access Control

```solidity
contract TieredVault {
    uint256 public constant BASIC_LIMIT = 10000 * 1e18;
    uint256 public constant ACCREDITED_LIMIT = 1000000 * 1e18;
    
    function getDepositLimit(address user) public view returns (uint256) {
        if (registry.isVerified(user, INSTITUTIONAL)) {
            return type(uint256).max; // Unlimited
        }
        if (registry.isVerified(user, ACCREDITED)) {
            return ACCREDITED_LIMIT;
        }
        if (registry.isVerified(user, ELIGIBLE)) {
            return BASIC_LIMIT;
        }
        return 0;
    }
}
```

## Custom Eligibility Source

If you need claims from a different source:

1. **Set up a new endpoint** that returns JSON with your claim data
2. **Configure the prover** to target that endpoint
3. **Update the relayer** to validate the new claims
4. **Add the claim type** to your contracts

Example eligibility response:

```json
{
  "eligible": true,
  "accredited_investor": true,
  "account_type": "individual",
  "country": "US",
  "verified_at": "2024-01-15T00:00:00Z"
}
```

## Next Steps

- [Troubleshooting](/guides/troubleshooting) — Common issues
- [Compliance Middleware](/contracts/compliance) — Contract patterns
