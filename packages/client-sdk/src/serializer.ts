import type { VerifiedTranscript, SerializedTranscript } from './types';

/**
 * Serialize a transcript for transport (e.g., to send to relayer)
 */
export function serializeTranscript(transcript: VerifiedTranscript): SerializedTranscript {
  return {
    serverName: transcript.serverName,
    sent: uint8ArrayToBase64(transcript.sent),
    received: uint8ArrayToBase64(transcript.received),
    timestamp: transcript.timestamp,
  };
}

/**
 * Deserialize a transcript received from transport
 */
export function deserializeTranscript(serialized: SerializedTranscript): VerifiedTranscript {
  return {
    serverName: serialized.serverName,
    sent: base64ToUint8Array(serialized.sent),
    received: base64ToUint8Array(serialized.received),
    timestamp: serialized.timestamp,
  };
}

/**
 * Convert Uint8Array to Base64 string
 */
export function uint8ArrayToBase64(array: Uint8Array): string {
  // Browser environment
  if (typeof btoa !== 'undefined') {
    const binary = Array.from(array)
      .map(byte => String.fromCharCode(byte))
      .join('');
    return btoa(binary);
  }
  
  // Node.js environment
  return Buffer.from(array).toString('base64');
}

/**
 * Convert Base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  // Browser environment
  if (typeof atob !== 'undefined') {
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return array;
  }
  
  // Node.js environment
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Convert transcript to a displayable string (for debugging)
 */
export function transcriptToString(transcript: VerifiedTranscript): {
  sent: string;
  received: string;
} {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  
  return {
    sent: decoder.decode(transcript.sent).replace(/\0/g, '█'),
    received: decoder.decode(transcript.received).replace(/\0/g, '█'),
  };
}
