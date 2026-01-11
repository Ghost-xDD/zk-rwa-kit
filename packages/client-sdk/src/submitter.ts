import type { VerifiedTranscript, TransactionResult } from './types';
import { serializeTranscript } from './serializer';
import { extractField } from './extractor';
import { DEFAULT_RELAYER_URL, CLAIM_TYPES } from './constants';

/**
 * Options for proof submission
 */
export interface SubmitOptions {
  /** Relayer API URL */
  relayerUrl?: string;
  /** Claim type to submit (default: ELIGIBLE) */
  claimType?: string;
  /** Override extracted value */
  extractedValue?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Result of proof submission
 */
export interface SubmitResult {
  success: boolean;
  txHash?: string;
  claimType?: string;
  claimValue?: string;
  expiry?: number;
  error?: string;
  code?: string;
}

/**
 * Submit a verified proof to the relayer for on-chain registration.
 * 
 * The relayer will verify the proof structure and submit a transaction
 * to the ZkOracle contract, paying the gas fees.
 * 
 * @example
 * ```typescript
 * import { proveEligibility, submitProof } from '@zk-rwa-kit/client-sdk';
 * 
 * const proveResult = await proveEligibility();
 * if (!proveResult.success) throw new Error(proveResult.error);
 * 
 * const submitResult = await submitProof(
 *   '0x1234...5678',  // wallet address
 *   proveResult.transcript!,
 *   { claimType: 'ELIGIBLE' }
 * );
 * 
 * if (submitResult.success) {
 *   console.log('Transaction:', submitResult.txHash);
 * }
 * ```
 */
export async function submitProof(
  walletAddress: string,
  transcript: VerifiedTranscript,
  options: SubmitOptions = {}
): Promise<SubmitResult> {
  const {
    relayerUrl = DEFAULT_RELAYER_URL,
    claimType = CLAIM_TYPES.ELIGIBLE,
    timeout = 30000,
  } = options;

  // Validate wallet address
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return {
      success: false,
      error: 'Invalid wallet address format',
      code: 'INVALID_ADDRESS',
    };
  }

  // Serialize transcript for transport
  const serialized = serializeTranscript(transcript);

  // Extract eligible value from transcript if not provided
  let extractedValue = options.extractedValue;
  if (!extractedValue) {
    const receivedText = new TextDecoder().decode(transcript.received);
    const extracted = extractField(receivedText, 'eligible');
    extractedValue = extracted || 'true';
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${relayerUrl}/submit-proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        transcript: serialized,
        claimType,
        extractedValue,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        txHash: data.txHash,
        claimType: data.claimType,
        claimValue: data.claimValue,
        expiry: data.expiry,
      };
    } else {
      return {
        success: false,
        error: data.error || 'Submission failed',
        code: data.code,
      };
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timeout',
        code: 'TIMEOUT',
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Network error: ${errorMessage}`,
      code: 'NETWORK_ERROR',
    };
  }
}

/**
 * Check the status of a submitted transaction
 */
export async function checkTransactionStatus(
  txHash: string,
  relayerUrl: string = DEFAULT_RELAYER_URL
): Promise<TransactionResult> {
  try {
    const response = await fetch(`${relayerUrl}/status/${txHash}`);
    const data = await response.json();

    return {
      txHash,
      status: data.status || 'pending',
      blockNumber: data.blockNumber,
      confirmations: data.confirmations,
    };

  } catch (error) {
    return {
      txHash,
      status: 'pending',
    };
  }
}

/**
 * Wait for a transaction to be confirmed
 */
export async function waitForConfirmation(
  txHash: string,
  options: {
    relayerUrl?: string;
    pollInterval?: number;
    maxAttempts?: number;
  } = {}
): Promise<TransactionResult> {
  const {
    relayerUrl = DEFAULT_RELAYER_URL,
    pollInterval = 3000,
    maxAttempts = 20,
  } = options;

  for (let i = 0; i < maxAttempts; i++) {
    const status = await checkTransactionStatus(txHash, relayerUrl);
    
    if (status.status === 'confirmed' || status.status === 'failed') {
      return status;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return {
    txHash,
    status: 'pending',
  };
}
