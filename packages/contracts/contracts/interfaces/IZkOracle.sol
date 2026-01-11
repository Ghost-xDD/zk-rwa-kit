// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IZkOracle
 * @notice Interface for the ZK Oracle that receives verified claims from the relayer
 * @dev The oracle acts as a trusted bridge between off-chain TLS proofs and on-chain identity claims
 */
interface IZkOracle {
    /**
     * @notice Emitted when a new claim is submitted and verified
     * @param subject The address the claim is about
     * @param claimType The type of claim (e.g., keccak256("ELIGIBLE"))
     * @param claimValue The value of the claim
     * @param expiry Unix timestamp when the claim expires
     */
    event ClaimSubmitted(
        address indexed subject,
        bytes32 indexed claimType,
        bytes32 claimValue,
        uint256 expiry
    );

    /**
     * @notice Submit a verified claim for a subject address
     * @dev Only callable by addresses with AGENT_ROLE (relayer)
     * @param subject The address the claim is about
     * @param claimType The type of claim (bytes32 hash)
     * @param claimValue The value of the claim
     * @param expiry Unix timestamp when the claim expires
     * @param proof The proof data (verified off-chain by relayer)
     */
    function submitClaim(
        address subject,
        bytes32 claimType,
        bytes32 claimValue,
        uint256 expiry,
        bytes calldata proof
    ) external;

    /**
     * @notice Get a claim for a subject
     * @param subject The address to query
     * @param claimType The type of claim to retrieve
     * @return value The claim value
     * @return expiry The claim expiry timestamp
     */
    function getClaim(
        address subject,
        bytes32 claimType
    ) external view returns (bytes32 value, uint256 expiry);
}
