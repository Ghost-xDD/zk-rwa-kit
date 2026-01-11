/**
 * Utilities for extracting data from TLS transcripts
 */

/**
 * Extract a field value from a text response
 * Handles JSON-like patterns: "field": value or "field": "value"
 */
export function extractField(text: string, fieldName: string): string | null {
  // Try to match JSON pattern: "fieldName": value or "fieldName": "value"
  const patterns = [
    // Boolean/number: "field": true or "field": 123
    new RegExp(`"${fieldName}"\\s*:\\s*(true|false|\\d+)`, 'i'),
    // String: "field": "value"
    new RegExp(`"${fieldName}"\\s*:\\s*"([^"]*)"`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Parse JSON from an HTTP response transcript
 * Handles the HTTP header portion and extracts just the JSON body
 */
export function parseJsonFromTranscript(text: string): Record<string, unknown> | null {
  try {
    // Find the start of JSON body (after headers)
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
      return null;
    }

    const jsonString = text.slice(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonString);

  } catch (error) {
    console.warn('Failed to parse JSON from transcript:', error);
    return null;
  }
}

/**
 * Extract multiple fields from a transcript
 */
export function extractFields(
  text: string, 
  fieldNames: string[]
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  
  for (const fieldName of fieldNames) {
    result[fieldName] = extractField(text, fieldName);
  }
  
  return result;
}

/**
 * Check if a transcript contains a specific field with expected value
 */
export function hasFieldValue(
  text: string, 
  fieldName: string, 
  expectedValue: string
): boolean {
  const actualValue = extractField(text, fieldName);
  return actualValue?.toLowerCase() === expectedValue.toLowerCase();
}

/**
 * Verify eligibility from transcript
 */
export function isEligibleFromTranscript(text: string): boolean {
  return hasFieldValue(text, 'eligible', 'true');
}

/**
 * Extract all RWA-related claims from transcript
 */
export function extractClaims(text: string): {
  eligible: boolean;
  accredited: boolean;
  kycVerified: boolean;
} {
  return {
    eligible: hasFieldValue(text, 'eligible', 'true'),
    accredited: hasFieldValue(text, 'accredited', 'true'),
    kycVerified: hasFieldValue(text, 'kycVerified', 'true'),
  };
}
