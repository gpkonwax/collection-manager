/**
 * Sanitize a URL to prevent XSS via javascript: or data: protocols.
 * Returns the URL if safe, or empty string if not.
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || /^vbscript:/i.test(trimmed)) {
    return '';
  }
  // Allow http, https, and protocol-relative URLs
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//') || trimmed.startsWith('/')) {
    return trimmed;
  }
  // Bare domain — prepend https
  return `https://${trimmed}`;
}
