# IdentityRegistry

The IdentityRegistry stores verified claims for wallet addresses with expiry times.

## Overview

```solidity
contract IdentityRegistry is IIdentityRegistry, AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    mapping(address => uint256) public identities;
    mapping(address => mapping(bytes32 => Claim)) public claims;
}
```

## Interface

```solidity
interface IIdentityRegistry {
    struct Claim {
        bytes32 value;
        uint256 expiry;
    }

    function registerIdentity(address wallet) external returns (uint256);
    function addClaim(address wallet, bytes32 claimType, bytes32 value, uint256 expiry) external;
    function isVerified(address wallet, bytes32 claimType) external view returns (bool);
    function getClaim(address wallet, bytes32 claimType) external view returns (bytes32, uint256);
    function hasIdentity(address wallet) external view returns (bool);
    function revokeClaim(address wallet, bytes32 claimType) external;

    event IdentityRegistered(address indexed wallet, uint256 indexed identityId);
    event ClaimAdded(address indexed wallet, bytes32 indexed claimType, bytes32 value);
    event ClaimRevoked(address indexed wallet, bytes32 indexed claimType);
}
```

## Functions

### `registerIdentity(address wallet)`

Register a new identity for a wallet.

```solidity
function registerIdentity(address wallet) external onlyRole(ORACLE_ROLE) returns (uint256)
```

- **Access:** ORACLE_ROLE only
- **Returns:** New identity ID
- **Reverts:** If wallet already registered

### `addClaim(address wallet, bytes32 claimType, bytes32 value, uint256 expiry)`

Add or update a claim for a wallet.

```solidity
function addClaim(
    address wallet,
    bytes32 claimType,
    bytes32 value,
    uint256 expiry
) external onlyRole(ORACLE_ROLE)
```

- **Access:** ORACLE_ROLE only
- **Requirements:**
  - Wallet must have an identity
  - Expiry must be in the future
- **Emits:** `ClaimAdded(wallet, claimType, value)`

### `isVerified(address wallet, bytes32 claimType)`

Check if a wallet has a valid, non-expired claim.

```solidity
function isVerified(address wallet, bytes32 claimType) external view returns (bool)
```

- **Returns:** `true` if claim exists and hasn't expired

### `getClaim(address wallet, bytes32 claimType)`

Get the full claim data.

```solidity
function getClaim(address wallet, bytes32 claimType) external view returns (bytes32 value, uint256 expiry)
```

### `revokeClaim(address wallet, bytes32 claimType)`

Remove a claim immediately.

```solidity
function revokeClaim(address wallet, bytes32 claimType) external onlyRole(ORACLE_ROLE)
```

- **Access:** ORACLE_ROLE only
- **Emits:** `ClaimRevoked(wallet, claimType)`

## Usage Examples

### Check Eligibility (Read)

```typescript
import { ethers } from 'ethers';

const registry = new ethers.Contract(
  REGISTRY_ADDRESS,
  ['function isVerified(address, bytes32) view returns (bool)'],
  provider
);

const ELIGIBLE = ethers.keccak256(ethers.toUtf8Bytes('ELIGIBLE'));
const isEligible = await registry.isVerified(userAddress, ELIGIBLE);
```

### Get Claim Details

```typescript
const registry = new ethers.Contract(
  REGISTRY_ADDRESS,
  ['function getClaim(address, bytes32) view returns (bytes32, uint256)'],
  provider
);

const [value, expiry] = await registry.getClaim(userAddress, ELIGIBLE);
console.log('Expires:', new Date(expiry * 1000));
```

### Grant ORACLE_ROLE (Admin)

```typescript
const registry = new ethers.Contract(
  REGISTRY_ADDRESS,
  ['function grantRole(bytes32, address)'],
  adminSigner
);

const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ORACLE_ROLE'));
await registry.grantRole(ORACLE_ROLE, zkOracleAddress);
```

## Security Considerations

1. **ORACLE_ROLE is critical** — Only grant to trusted contracts (ZkOracle)
2. **Expiry is enforced** — Claims auto-expire, no action needed
3. **One claim per type** — New claims overwrite old ones
4. **Revocation is immediate** — Use for emergency situations

## Next Steps

- [ZkOracle](/contracts/zk-oracle) — The contract that writes claims
- [Compliance Middleware](/contracts/compliance) — Using claims in your contracts
