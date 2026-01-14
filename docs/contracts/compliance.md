# Compliance Middleware

Patterns for enforcing eligibility checks in your smart contracts.

## Basic Pattern

Check eligibility before sensitive operations:

```solidity
import "./interfaces/IIdentityRegistry.sol";

contract MyContract {
    IIdentityRegistry public immutable registry;
    bytes32 public constant ELIGIBLE = keccak256("ELIGIBLE");

    constructor(address _registry) {
        registry = IIdentityRegistry(_registry);
    }

    modifier onlyEligible(address user) {
        require(registry.isVerified(user, ELIGIBLE), "Not eligible");
        _;
    }

    function sensitiveAction() external onlyEligible(msg.sender) {
        // Only eligible users can call this
    }
}
```

## Compliant ERC-20 Token

Check both sender and receiver on transfers:

```solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IIdentityRegistry.sol";

contract RWAToken is ERC20 {
    IIdentityRegistry public immutable identityRegistry;
    bytes32 public constant ELIGIBLE = keccak256("ELIGIBLE");

    constructor(address _registry) ERC20("RWA Token", "RWA") {
        identityRegistry = IIdentityRegistry(_registry);
    }

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // Skip checks for mint/burn
        if (from != address(0) && to != address(0)) {
            require(
                identityRegistry.isVerified(from, ELIGIBLE),
                "Sender not eligible"
            );
            require(
                identityRegistry.isVerified(to, ELIGIBLE),
                "Receiver not eligible"
            );
        }

        super._update(from, to, amount);
    }
}
```

## Compliant ERC-4626 Vault

Check eligibility on deposit and withdraw:

```solidity
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "./interfaces/IIdentityRegistry.sol";

contract CompliantVault is ERC4626 {
    IIdentityRegistry public immutable registry;
    bytes32 public constant ELIGIBLE = keccak256("ELIGIBLE");

    constructor(
        IERC20 _asset,
        address _registry
    ) ERC4626(_asset) ERC20("Vault Shares", "vRWA") {
        registry = IIdentityRegistry(_registry);
    }

    function isEligible(address user) public view returns (bool) {
        return registry.isVerified(user, ELIGIBLE);
    }

    function deposit(
        uint256 assets,
        address receiver
    ) public virtual override returns (uint256) {
        require(isEligible(msg.sender), "Sender not eligible");
        require(isEligible(receiver), "Receiver not eligible");
        return super.deposit(assets, receiver);
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual override returns (uint256) {
        require(isEligible(msg.sender), "Sender not eligible");
        require(isEligible(receiver), "Receiver not eligible");
        return super.withdraw(assets, receiver, owner);
    }
}
```

## Whitelisted Contracts

Allow specific protocols to interact without individual checks:

```solidity
contract CompliantToken is ERC20 {
    IIdentityRegistry public registry;
    bytes32 public constant ELIGIBLE = keccak256("ELIGIBLE");

    // Approved protocols (AMMs, lending pools, etc.)
    mapping(address => bool) public approvedProtocols;

    function setApprovedProtocol(address protocol, bool approved) external onlyAdmin {
        approvedProtocols[protocol] = approved;
    }

    function _isCompliant(address addr) internal view returns (bool) {
        // Approved protocols bypass individual checks
        if (approvedProtocols[addr]) return true;
        // Regular users need credentials
        return registry.isVerified(addr, ELIGIBLE);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0)) {
            require(_isCompliant(from) && _isCompliant(to), "Not compliant");
        }
        super._update(from, to, amount);
    }
}
```

## Multiple Claim Types

Support different eligibility levels:

```solidity
contract TieredAccess {
    IIdentityRegistry public registry;

    bytes32 public constant BASIC = keccak256("ELIGIBLE");
    bytes32 public constant ACCREDITED = keccak256("ACCREDITED");
    bytes32 public constant INSTITUTIONAL = keccak256("INSTITUTIONAL");

    modifier requiresClaim(bytes32 claimType) {
        require(registry.isVerified(msg.sender, claimType), "Missing claim");
        _;
    }

    function basicAction() external requiresClaim(BASIC) {
        // Any eligible user
    }

    function accreditedAction() external requiresClaim(ACCREDITED) {
        // Accredited investors only
    }

    function institutionalAction() external requiresClaim(INSTITUTIONAL) {
        // Institutions only
    }
}
```

## Gas Optimization

Cache registry calls when checking multiple addresses:

```solidity
function batchTransfer(
    address[] calldata recipients,
    uint256[] calldata amounts
) external {
    require(registry.isVerified(msg.sender, ELIGIBLE), "Sender not eligible");

    for (uint i = 0; i < recipients.length; i++) {
        require(registry.isVerified(recipients[i], ELIGIBLE), "Recipient not eligible");
        _transfer(msg.sender, recipients[i], amounts[i]);
    }
}
```

## Events for Compliance

Emit events for compliance tracking:

```solidity
event ComplianceChecked(address indexed user, bytes32 indexed claimType, bool result);

function checkCompliance(address user) external view returns (bool) {
    bool result = registry.isVerified(user, ELIGIBLE);
    emit ComplianceChecked(user, ELIGIBLE, result);
    return result;
}
```

## Next Steps

- [Deployment](/contracts/deployment) — Deploy your contracts
- [IdentityRegistry](/contracts/identity-registry) — Claim storage details
- [Building a Compliant dApp](/guides/compliant-dapp) — End-to-end guide
