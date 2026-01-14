# Building a Compliant dApp

End-to-end guide for building a dApp with privacy-preserving compliance on Mantle.

## Overview

You'll build:
1. A frontend that generates proofs and gets credentials
2. Integration with compliant contracts
3. User experience for the full flow

## Prerequisites

- React/Next.js project
- Wallet integration (wagmi, ethers, etc.)
- COOP/COEP headers configured

## Step 1: Install the SDK

```bash
npm install @zk-rwa-kit/client-sdk ethers
```

## Step 2: Create the Compliance Hook

```typescript
// hooks/useCompliance.ts
import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  proveEligibility,
  submitProof,
  waitForConfirmation,
  CLAIM_TYPES,
} from '@zk-rwa-kit/client-sdk';

const REGISTRY_ADDRESS = '0x58698a19006443eD2e9F1e4284Bd0c341B1a5A12';
const REGISTRY_ABI = ['function isVerified(address, bytes32) view returns (bool)'];
const ELIGIBLE_CLAIM = ethers.keccak256(ethers.toUtf8Bytes('ELIGIBLE'));

export function useCompliance(walletAddress: string | undefined) {
  const [status, setStatus] = useState<'idle' | 'proving' | 'submitting' | 'confirming' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const checkVerification = useCallback(async (provider: ethers.Provider) => {
    if (!walletAddress) return false;
    
    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
    const verified = await registry.isVerified(walletAddress, ELIGIBLE_CLAIM);
    setIsVerified(verified);
    return verified;
  }, [walletAddress]);

  const prove = useCallback(async () => {
    if (!walletAddress) {
      setError('Wallet not connected');
      return;
    }

    try {
      setError(null);
      
      // 1. Generate proof
      setStatus('proving');
      const proveResult = await proveEligibility();
      
      if (!proveResult.success || !proveResult.transcript) {
        throw new Error(proveResult.error || 'Proof generation failed');
      }

      // 2. Submit to relayer
      setStatus('submitting');
      const submitResult = await submitProof(walletAddress, proveResult.transcript, {
        claimType: CLAIM_TYPES.ELIGIBLE,
      });
      
      if (!submitResult.success || !submitResult.txHash) {
        throw new Error(submitResult.error || 'Submission failed');
      }

      // 3. Wait for confirmation
      setStatus('confirming');
      await waitForConfirmation(submitResult.txHash);
      
      setStatus('done');
      setIsVerified(true);
      
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [walletAddress]);

  return {
    status,
    error,
    isVerified,
    prove,
    checkVerification,
  };
}
```

## Step 3: Create the UI Component

```tsx
// components/ComplianceGate.tsx
import { useCompliance } from '../hooks/useCompliance';
import { useEffect } from 'react';
import { useProvider } from 'wagmi'; // or your wallet lib

interface Props {
  walletAddress: string;
  children: React.ReactNode;
}

export function ComplianceGate({ walletAddress, children }: Props) {
  const provider = useProvider();
  const { status, error, isVerified, prove, checkVerification } = useCompliance(walletAddress);

  useEffect(() => {
    if (walletAddress && provider) {
      checkVerification(provider);
    }
  }, [walletAddress, provider, checkVerification]);

  // Already verified - show protected content
  if (isVerified) {
    return <>{children}</>;
  }

  // Proving in progress
  if (status !== 'idle' && status !== 'error' && status !== 'done') {
    return (
      <div className="compliance-gate">
        <div className="spinner" />
        <p>
          {status === 'proving' && 'Generating proof...'}
          {status === 'submitting' && 'Submitting proof...'}
          {status === 'confirming' && 'Confirming on-chain...'}
        </p>
        <p className="hint">This may take 30-60 seconds</p>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="compliance-gate error">
        <p>Error: {error}</p>
        <button onClick={prove}>Try Again</button>
      </div>
    );
  }

  // Not verified - show prove button
  return (
    <div className="compliance-gate">
      <h2>Verification Required</h2>
      <p>Prove your eligibility to access this feature.</p>
      <button onClick={prove}>Prove Eligibility</button>
    </div>
  );
}
```

## Step 4: Use in Your App

```tsx
// pages/vault.tsx
import { ComplianceGate } from '../components/ComplianceGate';
import { VaultInterface } from '../components/VaultInterface';
import { useAccount } from 'wagmi';

export default function VaultPage() {
  const { address } = useAccount();

  if (!address) {
    return <p>Please connect your wallet</p>;
  }

  return (
    <ComplianceGate walletAddress={address}>
      <VaultInterface />
    </ComplianceGate>
  );
}
```

## Step 5: Interact with Compliant Contracts

```typescript
// After verification, users can interact with compliant contracts
const vault = new ethers.Contract(
  VAULT_ADDRESS,
  ['function deposit(uint256, address) returns (uint256)'],
  signer
);

// This will succeed because user has a valid SessionCredential
await vault.deposit(amount, userAddress);
```

## Complete Flow

1. **User connects wallet** → Check `isVerified()` on IdentityRegistry
2. **If not verified** → Show "Prove Eligibility" button
3. **User clicks prove** → Generate TLSNotary proof (30-60s)
4. **Submit to relayer** → Writes SessionCredential on-chain
5. **Credential active** → User can interact with compliant contracts
6. **After 24 hours** → Credential expires, user must re-prove

## Tips

### Show Progress

```tsx
const statusMessages = {
  proving: 'Generating cryptographic proof...',
  submitting: 'Verifying with relayer...',
  confirming: 'Writing credential on-chain...',
};
```

### Handle Timeouts

```typescript
const proveResult = await proveEligibility({
  timeout: 180000, // 3 minutes
});
```

### Prefetch Verification

```typescript
useEffect(() => {
  // Check verification status on page load
  checkVerification(provider);
}, []);
```

### Cache Status

```typescript
// Don't re-check every render
const [lastCheck, setLastCheck] = useState(0);

useEffect(() => {
  if (Date.now() - lastCheck > 60000) { // 1 minute
    checkVerification(provider);
    setLastCheck(Date.now());
  }
}, []);
```

## Next Steps

- [Custom Claim Types](/guides/custom-claims) — Add your own claim types
- [Troubleshooting](/guides/troubleshooting) — Common issues
