/**
 * @zk-rwa-kit/client-sdk
 * 
 * Client SDK for privacy-preserving RWA compliance verification.
 * Provides utilities for TLS proof generation and submission to the relayer.
 */

// Core functions
export { proveEligibility, type ProveOptions, type ProveResult } from './prover';
export { submitProof, type SubmitOptions, type SubmitResult } from './submitter';

// Utilities
export { serializeTranscript, deserializeTranscript } from './serializer';
export { extractField, parseJsonFromTranscript } from './extractor';

// Types
export * from './types';

// Constants
export { 
  MANTLE_SEPOLIA_CONFIG,
  CLAIM_TYPES,
  DEFAULT_PROVER_URL,
  DEFAULT_RELAYER_URL,
} from './constants';
