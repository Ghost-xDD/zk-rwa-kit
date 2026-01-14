---
layout: home

hero:
  name: Zk-RWA-Kit
  text: Privacy-Preserving RWA Compliance
  tagline: Just-in-time, temporary credentials for DeFi-composable Real World Assets on Mantle
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/user/zk-rwa-kit
    - theme: alt
      text: Try Demo
      link: https://zk-rwa-kit-yield.vercel.app

features:
  - icon: 🔐
    title: Privacy-First Proofs
    details: Generate TLSNotary MPC-TLS proofs in the browser. Prove eligibility without revealing your full identity.
  - icon: ⏱️
    title: Session Credentials
    details: Get 24-hour on-chain credentials instead of permanent KYC flags. Privacy, UX, and control in one.
  - icon: 🔗
    title: DeFi Composable
    details: Compliant tokens work with vaults, AMMs, and lending pools. Build inside a verified perimeter.
  - icon: 🛠️
    title: Plug-and-Play SDK
    details: One npm package. Two function calls. No custom allowlist logic required.
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: linear-gradient(135deg, #65b3ae 0%, #4ecdc4 100%);
  --vp-home-hero-image-background-image: linear-gradient(135deg, rgba(101, 179, 174, 0.2) 0%, rgba(78, 205, 196, 0.1) 100%);
  --vp-home-hero-image-filter: blur(44px);
}

.VPHero .clip {
  background: linear-gradient(135deg, #65b3ae 0%, #4ecdc4 100%);
  -webkit-background-clip: text;
  background-clip: text;
}
</style>

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Generate Proof │ ──▶ │  Verify + Issue │ ──▶ │  Compliant DeFi │
│  (Browser SDK)  │     │  (Relayer)      │     │  (On-Chain)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
   TLSNotary              Off-chain              Session Credential
   MPC-TLS                verification            valid 24h
```

## Quick Example

```typescript
import {
  proveEligibility,
  submitProof,
  CLAIM_TYPES,
} from '@zk-rwa-kit/client-sdk';

// 1. Generate proof in browser
const { transcript } = await proveEligibility();

// 2. Submit to relayer → on-chain credential
const { txHash } = await submitProof(walletAddress, transcript, {
  claimType: CLAIM_TYPES.ELIGIBLE,
});

// ✅ User now has a 24-hour SessionCredential on Mantle
```

## Live Demos

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 24px;">
  <a href="https://zk-rwa-kit-token.vercel.app" target="_blank" style="display: block; padding: 20px; background: var(--vp-c-bg-soft); border-radius: 12px; border: 1px solid var(--vp-c-divider); text-decoration: none;">
    <strong style="color: var(--vp-c-brand-1);">Token Transfer Demo</strong>
    <p style="margin: 8px 0 0; color: var(--vp-c-text-2); font-size: 14px;">Prove eligibility and transfer permissioned RWA tokens.</p>
  </a>
  <a href="https://zk-rwa-kit-yield.vercel.app" target="_blank" style="display: block; padding: 20px; background: var(--vp-c-bg-soft); border-radius: 12px; border: 1px solid var(--vp-c-divider); text-decoration: none;">
    <strong style="color: var(--vp-c-brand-1);">Yield Vault Demo</strong>
    <p style="margin: 8px 0 0; color: var(--vp-c-text-2); font-size: 14px;">Deposit into a compliant ERC-4626 vault on Mantle.</p>
  </a>
</div>
