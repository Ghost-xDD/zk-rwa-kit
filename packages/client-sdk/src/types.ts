/**
 * Core types for Zk-RWA-Kit Client SDK
 */

/**
 * Verified TLS transcript from the prover
 */
export interface VerifiedTranscript {
  /** Server domain name verified via TLS */
  serverName: string;
  /** Data sent to the server (may be partially redacted) */
  sent: Uint8Array;
  /** Data received from the server (may be partially redacted) */
  received: Uint8Array;
  /** Timestamp when proof was generated */
  timestamp: number;
}

/**
 * Serialized transcript for transport
 */
export interface SerializedTranscript {
  serverName: string;
  sent: string; // Base64 encoded
  received: string; // Base64 encoded
  timestamp: number;
}

/**
 * Claim types supported by the system
 */
export type ClaimType = 'ELIGIBLE' | 'ACCREDITED' | 'KYC_VERIFIED' | string;

/**
 * Proof submission request
 */
export interface ProofSubmission {
  walletAddress: string;
  transcript: SerializedTranscript;
  claimType: ClaimType;
  extractedValue: string;
}

/**
 * Chain configuration
 */
export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  contracts?: {
    zkOracle?: string;
    identityRegistry?: string;
    complianceModule?: string;
    rwaToken?: string;
  };
}

/**
 * Eligibility status from on-chain query
 */
export interface EligibilityStatus {
  isEligible: boolean;
  claimType: string;
  claimValue: string;
  expiry: number;
  hasIdentity: boolean;
}

/**
 * Transaction result
 */
export interface TransactionResult {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  confirmations?: number;
}
