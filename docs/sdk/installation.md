# Installation

## Package Installation

::: code-group

```bash [npm]
npm install @zk-rwa-kit/client-sdk
```

```bash [pnpm]
pnpm add @zk-rwa-kit/client-sdk
```

```bash [yarn]
yarn add @zk-rwa-kit/client-sdk
```

:::

## Peer Dependencies

The SDK has minimal dependencies. If you need transaction tracking, you'll also want `ethers`:

```bash
npm install ethers
```

## Framework Setup

### React / Next.js

```tsx
import { proveEligibility, submitProof } from '@zk-rwa-kit/client-sdk';

function ComplianceButton({ walletAddress }: { walletAddress: string }) {
  const [loading, setLoading] = useState(false);

  const handleProve = async () => {
    setLoading(true);
    try {
      const { transcript } = await proveEligibility();
      const { txHash } = await submitProof(walletAddress, transcript);
      console.log('Submitted:', txHash);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleProve} disabled={loading}>
      {loading ? 'Proving...' : 'Prove Eligibility'}
    </button>
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { proveEligibility, submitProof } from '@zk-rwa-kit/client-sdk';

const props = defineProps<{ walletAddress: string }>();
const loading = ref(false);

async function handleProve() {
  loading.value = true;
  try {
    const { transcript } = await proveEligibility();
    const { txHash } = await submitProof(props.walletAddress, transcript);
    console.log('Submitted:', txHash);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <button @click="handleProve" :disabled="loading">
    {{ loading ? 'Proving...' : 'Prove Eligibility' }}
  </button>
</template>
```

### Vanilla JavaScript

```html
<script type="module">
  import {
    proveEligibility,
    submitProof,
  } from 'https://esm.sh/@zk-rwa-kit/client-sdk';

  document.getElementById('prove-btn').addEventListener('click', async () => {
    const walletAddress = document.getElementById('wallet').value;

    const { transcript } = await proveEligibility();
    const { txHash } = await submitProof(walletAddress, transcript);

    alert('Transaction: ' + txHash);
  });
</script>
```

## Bundler Configuration

### Webpack

The SDK uses WASM, so ensure your webpack config handles `.wasm` files:

```js
// webpack.config.js
module.exports = {
  experiments: {
    asyncWebAssembly: true,
  },
};
```

### Vite

Vite handles WASM out of the box. No extra config needed.

### Next.js

Add to `next.config.js`:

```js
module.exports = {
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};
```

## HTTP Headers

**Critical:** TLSNotary WASM requires `SharedArrayBuffer`, which needs COOP/COEP headers.

### Vercel

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

### Netlify

```toml
# netlify.toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Embedder-Policy = "require-corp"
    Cross-Origin-Opener-Policy = "same-origin"
```

### Express

```js
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});
```

### Caddy

```
header {
  Cross-Origin-Embedder-Policy "require-corp"
  Cross-Origin-Opener-Policy "same-origin"
}
```

## Verifying Installation

```typescript
import {
  DEFAULT_PROVER_URL,
  DEFAULT_RELAYER_URL,
} from '@zk-rwa-kit/client-sdk';

console.log('Prover:', DEFAULT_PROVER_URL);
console.log('Relayer:', DEFAULT_RELAYER_URL);
// Should log the production endpoints
```

## Next Steps

- [Proof Generation](/sdk/proof-generation) — Configure the prover
- [Proof Submission](/sdk/proof-submission) — Submit to the relayer
