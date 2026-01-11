import type { VerifiedTranscript } from './types';
import { DEFAULT_PROVER_URL, MAX_SENT_DATA, MAX_RECV_DATA } from './constants';

/**
 * Options for proof generation
 */
export interface ProveOptions {
  /** WebSocket URL of the prover server */
  proverUrl?: string;
  /** Maximum bytes to send (default: 512) */
  maxSentData?: number;
  /** Maximum bytes to receive (default: 2048) */
  maxRecvData?: number;
  /** Timeout in milliseconds (default: 120000) */
  timeout?: number;
  /** Enable demo mode with cached proof */
  demoMode?: boolean;
}

/**
 * Result of proof generation
 */
export interface ProveResult {
  success: boolean;
  transcript?: VerifiedTranscript;
  error?: string;
  demoMode?: boolean;
}

/**
 * Cached demo proof for reliable demonstrations
 */
const DEMO_TRANSCRIPT: VerifiedTranscript = {
  serverName: 'mock-bank.local',
  sent: new TextEncoder().encode('GET /api/account HTTP/1.1\r\nHost: mock-bank.local\r\n\r\n'),
  received: new TextEncoder().encode(
    'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n' +
    '{"accountId":"ACC-12345678","eligible":true,"accredited":true,"kycVerified":true}'
  ),
  timestamp: Date.now(),
};

/**
 * Generate a TLS proof of eligibility using the prover server.
 * 
 * This function connects to the prover server via WebSocket and receives
 * a verified transcript after the MPC-TLS protocol completes.
 * 
 * @example
 * ```typescript
 * import { proveEligibility } from '@zk-rwa-kit/client-sdk';
 * 
 * const result = await proveEligibility({
 *   proverUrl: 'wss://localhost/prove',
 * });
 * 
 * if (result.success) {
 *   console.log('Verified server:', result.transcript.serverName);
 * }
 * ```
 */
export async function proveEligibility(options: ProveOptions = {}): Promise<ProveResult> {
  const {
    proverUrl = DEFAULT_PROVER_URL,
    maxSentData = MAX_SENT_DATA,
    maxRecvData = MAX_RECV_DATA,
    timeout = 120000,
    demoMode = false,
  } = options;

  // Demo mode: return cached proof immediately
  if (demoMode) {
    console.log('[SDK] Demo mode: returning cached proof');
    return {
      success: true,
      transcript: { ...DEMO_TRANSCRIPT, timestamp: Date.now() },
      demoMode: true,
    };
  }

  // Check for SharedArrayBuffer support (required for WASM threading)
  if (typeof SharedArrayBuffer === 'undefined') {
    return {
      success: false,
      error: 'SharedArrayBuffer not available. Ensure COOP/COEP headers are set.',
    };
  }

  try {
    // Dynamic import of tlsn-wasm (peer dependency)
    const tlsnWasm = await import('tlsn-wasm');
    
    // Initialize WASM if not already done
    await tlsnWasm.default?.();

    // Create verifier instance
    const verifier = new tlsnWasm.Verifier({
      max_sent_data: maxSentData,
      max_recv_data: maxRecvData,
    });

    // Connect to prover server with timeout
    const connectPromise = verifier.connect(proverUrl);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), timeout / 2);
    });

    await Promise.race([connectPromise, timeoutPromise]);
    console.log('[SDK] Connected to prover server');

    // Perform verification with timeout
    const verifyPromise = verifier.verify();
    const result = await Promise.race([
      verifyPromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Verification timeout')), timeout);
      }),
    ]);

    console.log('[SDK] Verification complete');

    // Extract transcript data
    const transcript: VerifiedTranscript = {
      serverName: result.server_name || 'unknown',
      sent: new Uint8Array(result.transcript?.sent || []),
      received: new Uint8Array(result.transcript?.recv || []),
      timestamp: Date.now(),
    };

    return {
      success: true,
      transcript,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SDK] Proof generation failed:', errorMessage);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if the browser supports TLS proof generation
 */
export function isProverSupported(): boolean {
  return typeof SharedArrayBuffer !== 'undefined' && typeof Worker !== 'undefined';
}
