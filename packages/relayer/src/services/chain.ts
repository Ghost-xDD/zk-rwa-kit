import { ethers } from "ethers";

// Initialize provider and wallet
const RPC_URL = process.env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.warn("⚠️  PRIVATE_KEY not set - chain operations will fail");
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;

// ZkOracle ABI (minimal - just what we need)
const ZK_ORACLE_ABI = [
  "function submitClaim(address subject, bytes32 claimType, bytes32 claimValue, uint256 expiry, bytes calldata proof) external",
  "function getClaim(address subject, bytes32 claimType) external view returns (bytes32 value, uint256 expiry)",
  "event ClaimSubmitted(address indexed subject, bytes32 indexed claimType, bytes32 claimValue, uint256 expiry)",
];

/**
 * Submit a claim to the ZkOracle contract
 */
export async function submitClaimOnChain(
  subject: string,
  claimType: string,
  claimValue: string
): Promise<{ txHash: string; expiry: number }> {
  if (!wallet) {
    throw new Error("Wallet not configured - set PRIVATE_KEY environment variable");
  }

  const zkOracleAddress = process.env.ZK_ORACLE_ADDRESS;
  if (!zkOracleAddress) {
    throw new Error("ZK_ORACLE_ADDRESS not configured");
  }

  const zkOracle = new ethers.Contract(zkOracleAddress, ZK_ORACLE_ABI, wallet);

  // Convert claim type to bytes32 hash
  const claimTypeBytes32 = ethers.keccak256(ethers.toUtf8Bytes(claimType));

  // Convert claim value to bytes32 (pad if needed)
  const claimValueBytes32 = ethers.encodeBytes32String(
    claimValue.slice(0, 31) // Max 31 chars for bytes32 string
  );

  // Set expiry to 30 days from now
  const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  // Create proof placeholder (the relayer has verified the proof off-chain)
  const proofPlaceholder = ethers.toUtf8Bytes("verified-by-relayer");

  console.log(`Submitting claim to ZkOracle at ${zkOracleAddress}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Claim Type: ${claimType} (${claimTypeBytes32})`);
  console.log(`  Claim Value: ${claimValue}`);
  console.log(`  Expiry: ${new Date(expiry * 1000).toISOString()}`);

  // Submit transaction
  const tx = await zkOracle.submitClaim(
    subject,
    claimTypeBytes32,
    claimValueBytes32,
    expiry,
    proofPlaceholder
  );

  console.log(`Transaction submitted: ${tx.hash}`);

  // Don't wait for confirmation - return immediately
  return {
    txHash: tx.hash,
    expiry,
  };
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(txHash: string): Promise<{
  txHash: string;
  status: "pending" | "confirmed" | "failed";
  blockNumber?: number;
  confirmations?: number;
}> {
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    return {
      txHash,
      status: "pending",
    };
  }

  if (receipt.status === 0) {
    return {
      txHash,
      status: "failed",
      blockNumber: receipt.blockNumber,
    };
  }

  const currentBlock = await provider.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber + 1;

  return {
    txHash,
    status: "confirmed",
    blockNumber: receipt.blockNumber,
    confirmations,
  };
}

/**
 * Check if an address is verified for a claim type
 */
export async function isAddressVerified(
  address: string,
  claimType: string = "ELIGIBLE"
): Promise<boolean> {
  const zkOracleAddress = process.env.ZK_ORACLE_ADDRESS;
  if (!zkOracleAddress) {
    throw new Error("ZK_ORACLE_ADDRESS not configured");
  }

  const zkOracle = new ethers.Contract(zkOracleAddress, ZK_ORACLE_ABI, provider);
  const claimTypeBytes32 = ethers.keccak256(ethers.toUtf8Bytes(claimType));

  const [value, expiry] = await zkOracle.getClaim(address, claimTypeBytes32);

  return value !== ethers.ZeroHash && expiry > Math.floor(Date.now() / 1000);
}

/**
 * Get relayer wallet info
 */
export async function getRelayerInfo(): Promise<{
  address: string;
  balance: string;
  nonce: number;
}> {
  if (!wallet) {
    throw new Error("Wallet not configured");
  }

  const [balance, nonce] = await Promise.all([
    provider.getBalance(wallet.address),
    provider.getTransactionCount(wallet.address),
  ]);

  return {
    address: wallet.address,
    balance: ethers.formatEther(balance),
    nonce,
  };
}
