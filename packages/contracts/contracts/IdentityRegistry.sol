// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IIdentityRegistry.sol";

/**
 * @title IdentityRegistry
 * @notice Stores verified identity claims for wallet addresses
 * @dev Claims are added by the ZkOracle after verifying TLS proofs
 */
contract IdentityRegistry is IIdentityRegistry, AccessControl {
    /// @notice Role that can add/modify claims (granted to ZkOracle)
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    /// @notice Struct to store claim data
    struct Claim {
        bytes32 value;
        uint256 expiry;
    }

    /// @notice Counter for identity IDs
    uint256 private _nextIdentityId = 1;

    /// @notice Mapping from wallet address to identity ID
    mapping(address => uint256) public identities;

    /// @notice Mapping from wallet address to claim type to claim data
    mapping(address => mapping(bytes32 => Claim)) public claims;

    /**
     * @notice Constructor sets up the admin role
     * @param admin The address that will have DEFAULT_ADMIN_ROLE
     */
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @inheritdoc IIdentityRegistry
     */
    function registerIdentity(
        address wallet
    ) external onlyRole(ORACLE_ROLE) returns (uint256 identityId) {
        require(wallet != address(0), "Invalid wallet address");
        require(identities[wallet] == 0, "Identity already exists");

        identityId = _nextIdentityId++;
        identities[wallet] = identityId;

        emit IdentityRegistered(wallet, identityId);
    }

    /**
     * @inheritdoc IIdentityRegistry
     */
    function addClaim(
        address wallet,
        bytes32 claimType,
        bytes32 value,
        uint256 expiry
    ) external onlyRole(ORACLE_ROLE) {
        require(wallet != address(0), "Invalid wallet address");
        require(identities[wallet] != 0, "No identity registered");
        require(expiry > block.timestamp, "Expiry must be in future");

        claims[wallet][claimType] = Claim(value, expiry);

        emit ClaimAdded(wallet, claimType, value);
    }

    /**
     * @inheritdoc IIdentityRegistry
     */
    function isVerified(
        address wallet,
        bytes32 claimType
    ) external view returns (bool) {
        Claim memory claim = claims[wallet][claimType];
        return claim.value != bytes32(0) && claim.expiry > block.timestamp;
    }

    /**
     * @inheritdoc IIdentityRegistry
     */
    function getClaim(
        address wallet,
        bytes32 claimType
    ) external view returns (bytes32 value, uint256 expiry) {
        Claim memory claim = claims[wallet][claimType];
        return (claim.value, claim.expiry);
    }

    /**
     * @inheritdoc IIdentityRegistry
     */
    function hasIdentity(address wallet) external view returns (bool) {
        return identities[wallet] != 0;
    }

    /**
     * @inheritdoc IIdentityRegistry
     */
    function getIdentityId(address wallet) external view returns (uint256) {
        return identities[wallet];
    }

    /**
     * @notice Revoke a claim for a wallet
     * @dev Only callable by ORACLE_ROLE
     * @param wallet The wallet address
     * @param claimType The type of claim to revoke
     */
    function revokeClaim(
        address wallet,
        bytes32 claimType
    ) external onlyRole(ORACLE_ROLE) {
        delete claims[wallet][claimType];
        emit ClaimRevoked(wallet, claimType);
    }
}
