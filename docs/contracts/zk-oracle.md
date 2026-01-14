# ZkOracle

The ZkOracle receives verified claims from the relayer and writes them to the IdentityRegistry.

## Overview

```solidity
contract ZkOracle is IZkOracle, AccessControl {
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    IIdentityRegistry public immutable identityRegistry;
    mapping(bytes32 => bool) public usedProofHashes;
}
```

## Interface

```solidity
interface IZkOracle {
    function submitClaim(
        address subject,
        bytes32 claimType,
        bytes32 claimValue,
        uint256 expiry,
        bytes calldata proof
    ) external;

    function getClaim(address subject, bytes32 claimType) external view returns (bytes32, uint256);
    function isVerified(address subject, bytes32 claimType) external view returns (bool);

    event ClaimSubmitted(address indexed subject, bytes32 indexed claimType, bytes32 value, uint256 expiry);
    event ClaimRejected(address indexed subject, string reason);
}
```

## Functions

### `submitClaim(...)`

Submit a verified claim for a wallet.

```solidity
function submitClaim(
    address subject,
    bytes32 claimType,
    bytes32 claimValue,
    uint256 expiry,
    bytes calldata proof
) external onlyRole(AGENT_ROLE)
```

**Parameters:**

- `subject` — Wallet address to receive the claim
- `claimType` — Type of claim (e.g., `keccak256("ELIGIBLE")`)
- `claimValue` — Claim value (e.g., `keccak256("true")`)
- `expiry` — Unix timestamp when claim expires
- `proof` — Proof data (prevents replay attacks)

**Behavior:**

1. Validates inputs
2. Hashes the submission to prevent replays
3. Registers identity if needed
4. Adds the claim to IdentityRegistry

**Access:** AGENT_ROLE only (the relayer)

### `getClaim(address subject, bytes32 claimType)`

Get claim data via the registry.

```solidity
function getClaim(address subject, bytes32 claimType) external view returns (bytes32 value, uint256 expiry)
```

### `isVerified(address subject, bytes32 claimType)`

Check if a subject has a valid claim.

```solidity
function isVerified(address subject, bytes32 claimType) external view returns (bool)
```

## Replay Protection

Each proof submission creates a unique hash:

```solidity
bytes32 proofHash = keccak256(
    abi.encodePacked(subject, claimType, claimValue, expiry, proof)
);
require(!usedProofHashes[proofHash], "Proof already used");
usedProofHashes[proofHash] = true;
```

This prevents the same proof from being submitted twice.

## Relayer Integration

The relayer calls `submitClaim` after verifying a TLS proof:

```typescript
// In relayer/services/chain.ts
async function submitClaimOnChain(
  walletAddress: string,
  claimType: string,
  claimValue: string
) {
  const claimTypeHash = ethers.keccak256(ethers.toUtf8Bytes(claimType));
  const claimValueHash = ethers.keccak256(ethers.toUtf8Bytes(claimValue));
  const expiry = Math.floor(Date.now() / 1000) + 86400; // 24 hours
  const proof = ethers.randomBytes(32); // Unique nonce

  const tx = await zkOracle.submitClaim(
    walletAddress,
    claimTypeHash,
    claimValueHash,
    expiry,
    proof
  );

  return { txHash: tx.hash, expiry };
}
```

## Granting AGENT_ROLE

Only the admin can grant AGENT_ROLE:

```typescript
const zkOracle = new ethers.Contract(
  ZK_ORACLE_ADDRESS,
  ['function grantRole(bytes32, address)'],
  adminSigner
);

const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes('AGENT_ROLE'));
await zkOracle.grantRole(AGENT_ROLE, relayerWalletAddress);
```

## Security Considerations

1. **AGENT_ROLE is highly privileged** — Can write any claim for any wallet
2. **Protect the relayer key** — Compromise = unauthorized claims
3. **Replay protection** — Same proof can't be used twice
4. **Expiry is mandatory** — No permanent claims allowed

## Future: On-Chain Verification

The MVP trusts the relayer. Future versions could:

1. Accept ZK proofs directly on-chain
2. Verify TLSNotary attestations in Solidity
3. Use multiple independent relayers with consensus

## Next Steps

- [IdentityRegistry](/contracts/identity-registry) — Where claims are stored
- [Compliance Middleware](/contracts/compliance) — Using claims in transfers
- [Deployment](/contracts/deployment) — Deploy your own oracle
