// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IZkOracle.sol";
import "./interfaces/IIdentityRegistry.sol";

/**
 * @title ZkOracle
 * @notice Receives verified TLS proofs from the relayer and writes claims to the IdentityRegistry
 * @dev The relayer (with AGENT_ROLE) is trusted to have verified the proof off-chain
 */
contract ZkOracle is IZkOracle, AccessControl {
    /// @notice Role for agents that can submit claims (the relayer)
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    /// @notice The identity registry where claims are stored
    IIdentityRegistry public immutable identityRegistry;

    /// @notice Nonce to prevent replay attacks
    mapping(bytes32 => bool) public usedProofHashes;

    /**
     * @notice Emitted when a proof is rejected
     * @param subject The subject address
     * @param reason The rejection reason
     */
    event ClaimRejected(address indexed subject, string reason);

    /**
     * @notice Constructor sets up the oracle with registry and admin
     * @param _identityRegistry The identity registry contract
     * @param admin The admin address
     */
    constructor(address _identityRegistry, address admin) {
        require(_identityRegistry != address(0), "Invalid registry address");
        identityRegistry = IIdentityRegistry(_identityRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @inheritdoc IZkOracle
     */
    function submitClaim(
        address subject,
        bytes32 claimType,
        bytes32 claimValue,
        uint256 expiry,
        bytes calldata proof
    ) external onlyRole(AGENT_ROLE) {
        require(subject != address(0), "Invalid subject address");
        require(proof.length > 0, "Empty proof");
        require(expiry > block.timestamp, "Expiry must be in future");

        // Create a unique hash of this proof submission to prevent replays
        bytes32 proofHash = keccak256(
            abi.encodePacked(subject, claimType, claimValue, expiry, proof)
        );
        require(!usedProofHashes[proofHash], "Proof already used");
        usedProofHashes[proofHash] = true;

        // Register identity if not exists
        if (!identityRegistry.hasIdentity(subject)) {
            identityRegistry.registerIdentity(subject);
        }

        // Add the claim
        identityRegistry.addClaim(subject, claimType, claimValue, expiry);

        emit ClaimSubmitted(subject, claimType, claimValue, expiry);
    }

    /**
     * @inheritdoc IZkOracle
     */
    function getClaim(
        address subject,
        bytes32 claimType
    ) external view returns (bytes32 value, uint256 expiry) {
        return identityRegistry.getClaim(subject, claimType);
    }

    /**
     * @notice Check if a subject is verified for a claim type
     * @param subject The address to check
     * @param claimType The claim type
     * @return True if verified and not expired
     */
    function isVerified(
        address subject,
        bytes32 claimType
    ) external view returns (bool) {
        return identityRegistry.isVerified(subject, claimType);
    }
}
