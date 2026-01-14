# Smart Contracts Overview

Zk-RWA-Kit includes Solidity contracts for on-chain credential storage and compliance enforcement.

## Contract Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  ZkOracle       │────▶│ IdentityRegistry│◀────│  RWAToken       │
│  (Relayer writes│     │ (Stores claims) │     │  (Checks claims)│
│   claims)       │     └─────────────────┘     └─────────────────┘
└─────────────────┘              ▲
                                 │
                        ┌─────────────────┐
                        │  mYieldVault    │
                        │  (ERC-4626)     │
                        └─────────────────┘
```

## Contracts

| Contract | Purpose |
|----------|---------|
| **IdentityRegistry** | Stores wallet claims with expiry times |
| **ZkOracle** | Receives claims from relayer, writes to registry |
| **RWAToken** | Example compliant ERC-20 token |
| **mYieldVault** | Example compliant ERC-4626 vault |
| **ComplianceModule** | Reusable compliance checking logic |

## Key Concepts

### Claims

A claim is a statement about a wallet:

```solidity
struct Claim {
    bytes32 value;   // e.g., keccak256("true")
    uint256 expiry;  // Unix timestamp
}
```

Claims are stored per wallet, per claim type:

```solidity
mapping(address => mapping(bytes32 => Claim)) public claims;
```

### Claim Types

Claim types are `bytes32` identifiers:

```solidity
bytes32 constant ELIGIBLE = keccak256("ELIGIBLE");
bytes32 constant ACCREDITED = keccak256("ACCREDITED");
bytes32 constant NON_SANCTIONED = keccak256("NON_SANCTIONED");
```

### Session Credentials

Unlike permanent allowlists, claims expire:

```solidity
function isVerified(address wallet, bytes32 claimType) external view returns (bool) {
    Claim memory claim = claims[wallet][claimType];
    return claim.value != bytes32(0) && claim.expiry > block.timestamp;
}
```

## Access Control

Contracts use OpenZeppelin's AccessControl:

| Role | Contract | Purpose |
|------|----------|---------|
| `DEFAULT_ADMIN_ROLE` | All | Manage other roles |
| `ORACLE_ROLE` | IdentityRegistry | Add/revoke claims |
| `AGENT_ROLE` | ZkOracle | Submit verified claims |
| `MINTER_ROLE` | RWAToken | Mint tokens |

## Deployment

Contracts are deployed to Mantle Sepolia. See [Deployment](/contracts/deployment) for addresses and scripts.

## Integration

To make your contract compliant:

```solidity
import "./interfaces/IIdentityRegistry.sol";

contract MyCompliantContract {
    IIdentityRegistry public registry;
    bytes32 public constant ELIGIBLE = keccak256("ELIGIBLE");
    
    modifier onlyEligible(address user) {
        require(registry.isVerified(user, ELIGIBLE), "Not eligible");
        _;
    }
    
    function doSomething() external onlyEligible(msg.sender) {
        // Only eligible users can call this
    }
}
```

## Next Steps

- [IdentityRegistry](/contracts/identity-registry) — Claim storage
- [ZkOracle](/contracts/zk-oracle) — Relayer integration
- [Compliance Middleware](/contracts/compliance) — Reusable checks
- [Deployment](/contracts/deployment) — Deploy your own
