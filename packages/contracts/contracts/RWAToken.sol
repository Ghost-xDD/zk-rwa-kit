// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/ICompliance.sol";

/**
 * @title RWAToken
 * @notice ERC-20 token with compliance-gated transfers
 * @dev All transfers are checked against the compliance module
 */
contract RWAToken is ERC20, AccessControl {
    /// @notice Role for minting tokens
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice The compliance module that gates transfers
    ICompliance public compliance;

    /// @notice Emitted when compliance module is updated
    event ComplianceUpdated(
        address indexed oldCompliance,
        address indexed newCompliance
    );

    /// @notice Emitted when tokens are minted
    event TokensMinted(address indexed to, uint256 amount);

    /**
     * @notice Constructor sets up the token with compliance
     * @param name Token name
     * @param symbol Token symbol
     * @param _compliance The compliance module address
     * @param admin The admin address
     */
    constructor(
        string memory name,
        string memory symbol,
        address _compliance,
        address admin
    ) ERC20(name, symbol) {
        require(_compliance != address(0), "Invalid compliance address");
        require(admin != address(0), "Invalid admin address");

        compliance = ICompliance(_compliance);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    /**
     * @notice Mint new tokens to an eligible address
     * @dev Only callable by MINTER_ROLE, recipient must be eligible
     * @param to The recipient address
     * @param amount The amount to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(
            compliance.canTransfer(address(0), to, amount),
            "Recipient not eligible"
        );
        _mint(to, amount);
        compliance.transferred(address(0), to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @notice Update the compliance module
     * @dev Only callable by DEFAULT_ADMIN_ROLE
     * @param _compliance The new compliance module address
     */
    function setCompliance(
        address _compliance
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_compliance != address(0), "Invalid compliance address");
        address oldCompliance = address(compliance);
        compliance = ICompliance(_compliance);
        emit ComplianceUpdated(oldCompliance, _compliance);
    }

    /**
     * @notice Override _update to add compliance checks on transfers
     * @dev Compliance is checked for all non-mint transfers
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        // Skip compliance check for minting (handled in mint function)
        if (from != address(0) && to != address(0)) {
            require(
                compliance.canTransfer(from, to, value),
                "Transfer not compliant"
            );
        }

        super._update(from, to, value);

        // Call transferred hook for non-mint transfers
        if (from != address(0) && to != address(0)) {
            compliance.transferred(from, to, value);
        }
    }

    /**
     * @notice Burn tokens from the caller's balance
     * @dev Caller must be eligible
     * @param amount The amount to burn
     */
    function burn(uint256 amount) external {
        require(
            compliance.canTransfer(msg.sender, address(0), amount),
            "Sender not eligible to burn"
        );
        _burn(msg.sender, amount);
        compliance.transferred(msg.sender, address(0), amount);
    }
}
