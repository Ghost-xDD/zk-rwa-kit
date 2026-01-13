/**
 * Proof verification service
 * This service is used to validate the transcript and extract the claim data.
 */

export interface Transcript {
  sent: string;
  received: string;
  serverName: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  extractedFields?: Record<string, string>;
}

/**
 * Validate transcript structure and extract claim data
 */
export function validateTranscript(
  transcript: Transcript,
  expectedValue?: string
): ValidationResult {
  try {
    if (!transcript.received) {
      return { valid: false, error: 'Missing received data in transcript' };
    }

    if (!transcript.serverName) {
      return { valid: false, error: 'Missing server name in transcript' };
    }

    // Decode received data (base64)
    let receivedText: string;
    try {
      receivedText = Buffer.from(transcript.received, 'base64').toString(
        'utf8'
      );
    } catch {
      return { valid: false, error: 'Invalid base64 encoding in transcript' };
    }

    if (
      !receivedText.includes('eligible') &&
      !receivedText.includes('ELIGIBLE')
    ) {
      console.warn('Transcript may not contain eligibility data');
    }

    if (expectedValue) {
      const eligibleMatch = receivedText.match(
        /"eligible"\s*:\s*(true|false)/i
      );
      if (eligibleMatch) {
        const actualValue = eligibleMatch[1].toLowerCase();
        if (actualValue !== expectedValue.toLowerCase()) {
          return {
            valid: false,
            error: `Extracted value (${actualValue}) does not match expected (${expectedValue})`,
          };
        }
      }
    }

    const extractedFields: Record<string, string> = {};

    const eligibleMatch = receivedText.match(/"eligible"\s*:\s*(true|false)/i);
    if (eligibleMatch) {
      extractedFields.eligible = eligibleMatch[1].toLowerCase();
    }

    const accreditedMatch = receivedText.match(
      /"accredited"\s*:\s*(true|false)/i
    );
    if (accreditedMatch) {
      extractedFields.accredited = accreditedMatch[1].toLowerCase();
    }

    return {
      valid: true,
      extractedFields,
    };
  } catch (error) {
    console.error('Transcript validation error:', error);
    return {
      valid: false,
      error: 'Failed to validate transcript structure',
    };
  }
}

/**
 * Check if this is a demo/cached proof
 */
export function isDemoProof(transcript: Transcript): boolean {
  try {
    const receivedText = Buffer.from(transcript.received, 'base64').toString(
      'utf8'
    );
    return receivedText.includes('demo') || receivedText.includes('mockbank');
  } catch {
    return false;
  }
}
