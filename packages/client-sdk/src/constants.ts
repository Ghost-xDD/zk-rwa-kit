import type { ChainConfig, ClaimType } from './types';

/**
 * Mantle Sepolia network configuration
 */
export const MANTLE_SEPOLIA_CONFIG: ChainConfig = {
  chainId: 5003,
  name: 'Mantle Sepolia',
  rpcUrl: 'https://rpc.sepolia.mantle.xyz',
  explorerUrl: 'https://sepolia.mantlescan.xyz',
};

/**
 * Default prover WebSocket URL
 */
export const DEFAULT_PROVER_URL =
  'wss://zk-rwa-prover-production.up.railway.app/prove';

/**
 * Default relayer API URL
 */
export const DEFAULT_RELAYER_URL =
  'https://zk-rwa-kitrelayer-production.up.railway.app';

/**
 * Claim type constants
 */
export const CLAIM_TYPES: Record<string, ClaimType> = {
  ELIGIBLE: 'ELIGIBLE',
  ACCREDITED: 'ACCREDITED',
  KYC_VERIFIED: 'KYC_VERIFIED',
} as const;

/**
 * Maximum data sizes for TLS proof (must match prover-server config)
 */
export const MAX_SENT_DATA = 512;
export const MAX_RECV_DATA = 2048;

/**
 * Default claim expiry duration (30 days in seconds)
 */
export const DEFAULT_CLAIM_EXPIRY_SECONDS = 30 * 24 * 60 * 60;
