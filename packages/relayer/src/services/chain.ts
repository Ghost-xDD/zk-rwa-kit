import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const RPC_URL =
  process.env.MANTLE_SEPOLIA_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.warn('⚠️  PRIVATE_KEY not set - chain operations will fail');
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;

const ZK_ORACLE_ABI = [
  'function submitClaim(address subject, bytes32 claimType, bytes32 claimValue, uint256 expiry, bytes calldata proof) external',
  'function getClaim(address subject, bytes32 claimType) external view returns (bytes32 value, uint256 expiry)',
  'event ClaimSubmitted(address indexed subject, bytes32 indexed claimType, bytes32 claimValue, uint256 expiry)',
];

const MUSDY_ABI = [
  'function mint(address to, uint256 amount) external',
  'function balanceOf(address account) view returns (uint256)',
  'function symbol() view returns (string)',
  'event TokensMinted(address indexed to, uint256 amount)',
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
    throw new Error(
      'Wallet not configured - set PRIVATE_KEY environment variable'
    );
  }

  const zkOracleAddress = process.env.ZK_ORACLE_ADDRESS;
  if (!zkOracleAddress) {
    throw new Error('ZK_ORACLE_ADDRESS not configured');
  }

  const zkOracle = new ethers.Contract(zkOracleAddress, ZK_ORACLE_ABI, wallet);

  const claimTypeBytes32 = ethers.keccak256(ethers.toUtf8Bytes(claimType));

  const claimValueBytes32 = ethers.encodeBytes32String(claimValue.slice(0, 31));

  const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  const proofPlaceholder = ethers.toUtf8Bytes('verified-by-relayer');

  console.log(`Submitting claim to ZkOracle at ${zkOracleAddress}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Claim Type: ${claimType} (${claimTypeBytes32})`);
  console.log(`  Claim Value: ${claimValue}`);
  console.log(`  Expiry: ${new Date(expiry * 1000).toISOString()}`);

  const tx = await zkOracle.submitClaim(
    subject,
    claimTypeBytes32,
    claimValueBytes32,
    expiry,
    proofPlaceholder
  );

  console.log(`Transaction submitted: ${tx.hash}`);

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
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  confirmations?: number;
}> {
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    return {
      txHash,
      status: 'pending',
    };
  }

  if (receipt.status === 0) {
    return {
      txHash,
      status: 'failed',
      blockNumber: receipt.blockNumber,
    };
  }

  const currentBlock = await provider.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber + 1;

  return {
    txHash,
    status: 'confirmed',
    blockNumber: receipt.blockNumber,
    confirmations,
  };
}

/**
 * Check if an address is verified for a claim type
 */
export async function isAddressVerified(
  address: string,
  claimType: string = 'ELIGIBLE'
): Promise<boolean> {
  const zkOracleAddress = process.env.ZK_ORACLE_ADDRESS;
  if (!zkOracleAddress) {
    throw new Error('ZK_ORACLE_ADDRESS not configured');
  }

  const zkOracle = new ethers.Contract(
    zkOracleAddress,
    ZK_ORACLE_ABI,
    provider
  );
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
    throw new Error('Wallet not configured');
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

/**
 * Mint mUSDY tokens to a verified address
 */
export async function mintTokens(
  recipient: string,
  amount: string
): Promise<{ txHash: string; symbol: string }> {
  if (!wallet) {
    throw new Error(
      'Wallet not configured - set PRIVATE_KEY environment variable'
    );
  }

  const mUSDYAddress = process.env.MUSDY_ADDRESS;
  if (!mUSDYAddress) {
    throw new Error('MUSDY_ADDRESS not configured');
  }

  const verified = await isAddressVerified(recipient);
  if (!verified) {
    throw new Error('Recipient is not verified - cannot mint tokens');
  }

  const mUSDY = new ethers.Contract(mUSDYAddress, MUSDY_ABI, wallet);

  let symbol = 'mUSDY';
  try {
    symbol = await mUSDY.symbol();
  } catch {
    // Use default if symbol() fails
  }

  const amountWei = ethers.parseUnits(amount, 18);

  console.log(`Minting ${amount} ${symbol} to ${recipient}`);
  console.log(`  Token contract: ${mUSDYAddress}`);
  console.log(`  Amount (wei): ${amountWei.toString()}`);

  const tx = await mUSDY.mint(recipient, amountWei);

  console.log(`Mint transaction submitted: ${tx.hash}`);

  return {
    txHash: tx.hash,
    symbol,
  };
}
