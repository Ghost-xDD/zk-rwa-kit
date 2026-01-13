/**
 * @zk-rwa-kit/client-sdk
 *
 * Client SDK for privacy-preserving RWA compliance verification.
 * Provides utilities for TLS proof generation and submission to the relayer.
 */

// Core functions
export {
  proveEligibility,
  type ProveOptions,
  type ProveResult,
} from './prover';
export {
  submitProof,
  checkTransactionStatus,
  waitForConfirmation,
  type SubmitOptions,
  type SubmitResult,
} from './submitter';

// Utilities
export { serializeTranscript, deserializeTranscript } from './serializer';
export { transcriptToString } from './serializer';
export {
  extractField,
  parseJsonFromTranscript,
  extractClaims,
  extractFields,
  hasFieldValue,
  isEligibleFromTranscript,
} from './extractor';

// Types
export * from './types';

// Constants
export {
  MANTLE_SEPOLIA_CONFIG,
  CLAIM_TYPES,
  DEFAULT_PROVER_URL,
  DEFAULT_RELAYER_URL,
  MAX_SENT_DATA,
  MAX_RECV_DATA,
} from './constants';
