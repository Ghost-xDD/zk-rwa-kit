// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IIdentityRegistry
 * @notice Interface for the Identity Registry that stores verified identity claims
 * @dev Designed to be compatible with future ERC-3643 migration
 */
interface IIdentityRegistry {
    /**
     * @notice Emitted when a new identity is registered
     * @param wallet The wallet address
     * @param identityId The unique identity ID assigned
     */
    event IdentityRegistered(address indexed wallet, uint256 indexed identityId);

    /**
     * @notice Emitted when a claim is added to an identity
     * @param wallet The wallet address
     * @param claimType The type of claim
     * @param value The claim value
     */
    event ClaimAdded(
        address indexed wallet,
        bytes32 indexed claimType,
        bytes32 value
    );

    /**
     * @notice Emitted when a claim is revoked
     * @param wallet The wallet address
     * @param claimType The type of claim revoked
     */
    event ClaimRevoked(address indexed wallet, bytes32 indexed claimType);

    /**
     * @notice Register a new identity for a wallet
     * @dev Only callable by addresses with ORACLE_ROLE
     * @param wallet The wallet address to register
     * @return identityId The newly assigned identity ID
     */
    function registerIdentity(address wallet) external returns (uint256 identityId);

    /**
     * @notice Add or update a claim for a wallet
     * @dev Only callable by addresses with ORACLE_ROLE
     * @param wallet The wallet address
     * @param claimType The type of claim (bytes32 hash)
     * @param value The claim value
     * @param expiry Unix timestamp when the claim expires
     */
    function addClaim(
        address wallet,
        bytes32 claimType,
        bytes32 value,
        uint256 expiry
    ) external;

    /**
     * @notice Check if a wallet has a valid (non-expired) claim of a given type
     * @param wallet The wallet address to check
     * @param claimType The type of claim to verify
     * @return True if the wallet has a valid claim
     */
    function isVerified(
        address wallet,
        bytes32 claimType
    ) external view returns (bool);

    /**
     * @notice Get the claim details for a wallet
     * @param wallet The wallet address
     * @param claimType The type of claim
     * @return value The claim value
     * @return expiry The claim expiry timestamp
     */
    function getClaim(
        address wallet,
        bytes32 claimType
    ) external view returns (bytes32 value, uint256 expiry);

    /**
     * @notice Check if a wallet has a registered identity
     * @param wallet The wallet address to check
     * @return True if the wallet has an identity
     */
    function hasIdentity(address wallet) external view returns (bool);

    /**
     * @notice Get the identity ID for a wallet
     * @param wallet The wallet address
     * @return The identity ID (0 if none)
     */
    function getIdentityId(address wallet) external view returns (uint256);
}
