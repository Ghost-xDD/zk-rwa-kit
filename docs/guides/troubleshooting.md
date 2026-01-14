# Troubleshooting

Common issues and how to fix them.

## Proof Generation

### "SharedArrayBuffer is not defined"

**Cause:** Missing COOP/COEP headers

**Fix:** Add these headers to your server:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

For Vercel, add to `vercel.json`:

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

### WebSocket connection failed

**Cause:** Can't connect to prover server

**Fixes:**
1. Check prover URL is correct (`wss://` not `ws://` in production)
2. Verify the prover server is running
3. Check for network/firewall issues
4. Try increasing timeout: `proveEligibility({ timeout: 180000 })`

### Proof generation timeout

**Cause:** Slow network or overloaded prover

**Fixes:**
1. Increase timeout to 3 minutes
2. Check network connection
3. Try again later if prover is overloaded
4. Self-host the prover for reliability

## Proof Submission

### "Missing walletAddress"

**Cause:** Empty or undefined wallet address

**Fix:** Ensure wallet is connected before calling `submitProof`:

```typescript
if (!walletAddress) {
  throw new Error('Please connect your wallet first');
}
await submitProof(walletAddress, transcript);
```

### "Invalid wallet address format"

**Cause:** Malformed Ethereum address

**Fix:** Validate address format:

```typescript
if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
  throw new Error('Invalid wallet address');
}
```

### "Missing transcript"

**Cause:** Transcript is null or incomplete

**Fix:** Check proof generation succeeded:

```typescript
const result = await proveEligibility();
if (!result.success || !result.transcript) {
  throw new Error(result.error || 'Proof failed');
}
```

### "Invalid transcript"

**Cause:** Transcript validation failed

**Possible reasons:**
- Eligibility source returned `eligible: false`
- Transcript from wrong domain
- Corrupted data

**Fix:** Check the eligibility source is returning the expected data.

### "Rate limited"

**Cause:** Too many requests from your IP

**Fix:** Wait 60 seconds and try again.

## On-Chain Issues

### "Transfer not compliant"

**Cause:** User's SessionCredential expired or missing

**Fixes:**
1. Check if credential exists: `registry.isVerified(address, claimType)`
2. Generate a new proof if expired
3. Wait for transaction confirmation before transferring

### "Sender/Receiver not eligible"

**Cause:** One party in the transfer doesn't have a valid credential

**Fix:** Both sender AND receiver need valid credentials for compliant token transfers.

### "Transaction failed"

**Cause:** Various on-chain errors

**Common fixes:**
1. Check wallet has enough gas (MNT)
2. Verify contract addresses are correct
3. Check the relayer wallet has AGENT_ROLE
4. Look at transaction on Mantlescan for details

## Relayer Issues

### "Relayer has insufficient funds"

**Cause:** Relayer wallet is out of gas

**Fix:** Fund the relayer wallet with more MNT.

### Health check shows "missing"

**Cause:** Environment variables not configured

**Fix:** Set all required env vars:

```bash
MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz
ZK_ORACLE_ADDRESS=0x...
RWA_TOKEN_ADDRESS=0x...
RELAYER_PRIVATE_KEY=0x...
```

### "AGENT_ROLE" error

**Cause:** Relayer wallet doesn't have permission

**Fix:** Grant AGENT_ROLE to the relayer:

```typescript
const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes('AGENT_ROLE'));
await zkOracle.grantRole(AGENT_ROLE, relayerAddress);
```

## Development Tips

### Debug Mode

Enable verbose logging:

```typescript
const result = await proveEligibility({
  demoMode: true, // Uses cached proof for testing
});
```

### Check Contract State

```typescript
// Is user verified?
const isVerified = await registry.isVerified(address, ELIGIBLE_CLAIM);
console.log('Verified:', isVerified);

// Get claim details
const [value, expiry] = await registry.getClaim(address, ELIGIBLE_CLAIM);
console.log('Expires:', new Date(expiry * 1000));
```

### Inspect Transcript

```typescript
import { transcriptToString, extractClaims } from '@zk-rwa-kit/client-sdk';

const { sent, received } = transcriptToString(transcript);
console.log('Request:', sent);
console.log('Response:', received);
console.log('Claims:', extractClaims(received));
```

## Getting Help

1. Check the [GitHub Issues](https://github.com/Ghost-xDD/zk-rwa-kit/issues)
2. Review the [Architecture](/getting-started/architecture) docs
3. Look at the [example apps](https://zk-rwa-kit-yield.vercel.app) source code

## Next Steps

- [Building a Compliant dApp](/guides/compliant-dapp) — Full integration guide
- [SDK Reference](/sdk/overview) — API documentation
