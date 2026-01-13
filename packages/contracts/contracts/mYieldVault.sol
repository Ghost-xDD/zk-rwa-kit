// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IIdentityRegistry.sol";

/**
 * @title mYieldVault
 * @notice A minimal ERC-4626-like yield vault with compliance-gated deposits
 * @dev Users must be verified in the IdentityRegistry to deposit mUSDY
 * 
 * This demonstrates the core problem: DeFi composability is broken when
 * assets require compliance. Zk-RWA-Kit solves this by allowing users to
 * prove eligibility via TLSNotary and receive a SessionCredential.
 */
contract mYieldVault is ERC20, AccessControl {
    using SafeERC20 for IERC20;

    /// @notice The underlying asset (mUSDY)
    IERC20 public immutable asset;

    /// @notice Identity registry for eligibility checks
    IIdentityRegistry public identityRegistry;

    /// @notice Claim type required for deposits
    bytes32 public constant ELIGIBLE_CLAIM = keccak256("ELIGIBLE");

    /// @notice Simulated APY for demo (in basis points, e.g., 500 = 5%)
    uint256 public constant SIMULATED_APY_BPS = 500;

    /// @notice Emitted when a deposit is made
    event Deposit(
        address indexed caller,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    /// @notice Emitted when a withdrawal is made
    event Withdraw(
        address indexed caller,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    /// @notice Emitted when deposit is rejected due to missing verification
    event DepositRejected(address indexed user, string reason);

    /**
     * @notice Constructor
     * @param _asset The underlying mUSDY token address
     * @param _identityRegistry The identity registry for eligibility checks
     * @param _admin The admin address
     */
    constructor(
        address _asset,
        address _identityRegistry,
        address _admin
    ) ERC20("mYield Vault Shares", "mYV") {
        require(_asset != address(0), "Invalid asset address");
        require(_identityRegistry != address(0), "Invalid registry address");
        require(_admin != address(0), "Invalid admin address");

        asset = IERC20(_asset);
        identityRegistry = IIdentityRegistry(_identityRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    /**
     * @notice Check if a user is eligible to deposit
     * @param user The user address to check
     * @return True if the user has a valid SessionCredential
     */
    function isEligible(address user) public view returns (bool) {
        return identityRegistry.isVerified(user, ELIGIBLE_CLAIM);
    }

    /**
     * @notice Deposit mUSDY and receive vault shares
     * @dev Caller must be verified in the IdentityRegistry
     * @param assets Amount of mUSDY to deposit
     * @param receiver Address to receive the vault shares
     * @return shares Amount of vault shares minted
     */
    function deposit(
        uint256 assets,
        address receiver
    ) external returns (uint256 shares) {
        require(assets > 0, "Cannot deposit zero");
        
        // THE KEY CHECK: User must have SessionCredential
        if (!isEligible(msg.sender)) {
            emit DepositRejected(msg.sender, "No valid SessionCredential");
            revert("Deposit requires SessionCredential - prove eligibility first");
        }

        // Calculate shares (1:1 for simplicity in demo)
        shares = convertToShares(assets);

        // Transfer assets from caller
        asset.safeTransferFrom(msg.sender, address(this), assets);

        // Mint shares to receiver
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /**
     * @notice Withdraw mUSDY by burning vault shares
     * @param assets Amount of mUSDY to withdraw
     * @param receiver Address to receive the mUSDY
     * @param owner Address whose shares to burn
     * @return shares Amount of shares burned
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256 shares) {
        require(assets > 0, "Cannot withdraw zero");

        shares = convertToShares(assets);

        if (msg.sender != owner) {
            // Check allowance
            uint256 allowed = allowance(owner, msg.sender);
            require(allowed >= shares, "Insufficient allowance");
            _approve(owner, msg.sender, allowed - shares);
        }

        require(balanceOf(owner) >= shares, "Insufficient balance");

        // Burn shares
        _burn(owner, shares);

        // Transfer assets
        asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    /**
     * @notice Redeem shares for mUSDY
     * @param shares Amount of shares to redeem
     * @param receiver Address to receive the mUSDY
     * @param owner Address whose shares to burn
     * @return assets Amount of mUSDY withdrawn
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external returns (uint256 assets) {
        require(shares > 0, "Cannot redeem zero");

        if (msg.sender != owner) {
            uint256 allowed = allowance(owner, msg.sender);
            require(allowed >= shares, "Insufficient allowance");
            _approve(owner, msg.sender, allowed - shares);
        }

        require(balanceOf(owner) >= shares, "Insufficient balance");

        assets = convertToAssets(shares);

        _burn(owner, shares);
        asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    /**
     * @notice Convert assets to shares (1:1 for demo)
     */
    function convertToShares(uint256 assets) public pure returns (uint256) {
        return assets;
    }

    /**
     * @notice Convert shares to assets (1:1 for demo)
     */
    function convertToAssets(uint256 shares) public pure returns (uint256) {
        return shares;
    }

    /**
     * @notice Get total assets in the vault
     */
    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    /**
     * @notice Preview deposit (returns shares for given assets)
     */
    function previewDeposit(uint256 assets) public pure returns (uint256) {
        return convertToShares(assets);
    }

    /**
     * @notice Preview withdraw (returns shares needed for given assets)
     */
    function previewWithdraw(uint256 assets) public pure returns (uint256) {
        return convertToShares(assets);
    }

    /**
     * @notice Preview redeem (returns assets for given shares)
     */
    function previewRedeem(uint256 shares) public pure returns (uint256) {
        return convertToAssets(shares);
    }

    /**
     * @notice Update identity registry (admin only)
     */
    function setIdentityRegistry(
        address _identityRegistry
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_identityRegistry != address(0), "Invalid address");
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }
}
