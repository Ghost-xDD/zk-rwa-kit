// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ICompliance
 * @notice Interface for compliance modules that gate token transfers
 * @dev Designed to be compatible with future ERC-3643 ModularCompliance
 */
interface ICompliance {
    /**
     * @notice Check if a transfer is compliant
     * @dev Called before any token transfer to verify compliance rules
     * @param from The sender address (address(0) for minting)
     * @param to The recipient address (address(0) for burning)
     * @param amount The amount being transferred
     * @return True if the transfer is compliant
     */
    function canTransfer(
        address from,
        address to,
        uint256 amount
    ) external view returns (bool);

    /**
     * @notice Hook called after a transfer completes
     * @dev Can be used for audit logging or updating internal state
     * @param from The sender address
     * @param to The recipient address
     * @param amount The amount transferred
     */
    function transferred(
        address from,
        address to,
        uint256 amount
    ) external;
}
