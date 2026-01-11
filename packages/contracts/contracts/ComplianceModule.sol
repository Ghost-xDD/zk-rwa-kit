// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/ICompliance.sol";
import "./interfaces/IIdentityRegistry.sol";

/**
 * @title ComplianceModule
 * @notice Implements compliance checks for RWA token transfers
 * @dev Checks that both sender and recipient have valid ELIGIBLE claims
 */
contract ComplianceModule is ICompliance {
    /// @notice The claim type required for eligibility
    bytes32 public constant ELIGIBLE_CLAIM = keccak256("ELIGIBLE");

    /// @notice The identity registry to check claims against
    IIdentityRegistry public immutable identityRegistry;

    /// @notice Emitted when a transfer compliance check is performed
    event ComplianceChecked(
        address indexed from,
        address indexed to,
        uint256 amount,
        bool compliant
    );

    /**
     * @notice Constructor sets the identity registry
     * @param _identityRegistry The identity registry contract
     */
    constructor(address _identityRegistry) {
        require(_identityRegistry != address(0), "Invalid registry");
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    /**
     * @inheritdoc ICompliance
     */
    function canTransfer(
        address from,
        address to,
        uint256 amount
    ) external view returns (bool) {
        // Minting (from = zero address): only check recipient
        if (from == address(0)) {
            return identityRegistry.isVerified(to, ELIGIBLE_CLAIM);
        }

        // Burning (to = zero address): only check sender
        if (to == address(0)) {
            return identityRegistry.isVerified(from, ELIGIBLE_CLAIM);
        }

        // Regular transfer: both must be eligible
        return
            identityRegistry.isVerified(from, ELIGIBLE_CLAIM) &&
            identityRegistry.isVerified(to, ELIGIBLE_CLAIM);
    }

    /**
     * @inheritdoc ICompliance
     */
    function transferred(
        address from,
        address to,
        uint256 amount
    ) external {
        // Hook for post-transfer logic (audit logs, etc.)
        // No-op for MVP - can be extended for ERC-3643 compatibility
        emit ComplianceChecked(from, to, amount, true);
    }

    /**
     * @notice Get the claim type used for eligibility checks
     * @return The ELIGIBLE claim type hash
     */
    function getEligibleClaimType() external pure returns (bytes32) {
        return ELIGIBLE_CLAIM;
    }
}
