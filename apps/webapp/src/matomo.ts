// Matomo Analytics utility functions

// Extend Window interface to include _paq
declare global {
  interface Window {
    _paq: any[];
  }
}

/**
 * Track a custom event in Matomo
 * @param category - The event category (e.g., 'Verification', 'Navigation')
 * @param action - The event action (e.g., 'Started', 'Completed')
 * @param name - Optional event name
 * @param value - Optional numeric value
 */
export function trackEvent(
  category: string,
  action: string,
  name?: string,
  value?: number
): void {
  if (typeof window !== 'undefined' && window._paq) {
    window._paq.push(['trackEvent', category, action, name, value]);
  }
}