/**
 * Service for normalizing URLs to enable duplicate detection.
 *
 * Application layer - Service providing URL normalization logic.
 * Normalizes URLs by converting protocol and hostname to lowercase
 * while preserving path and query parameters needed by yt-dlp.
 *
 * This prevents duplicate downloads of the same content with URLs that
 * differ only in casing (e.g., 'HTTPS://Bandcamp.com' vs 'https://bandcamp.com').
 */
export class UrlNormalizer {
  /**
   * Normalizes a URL for consistent comparison.
   *
   * Normalization steps:
   * 1. Trims whitespace
   * 2. Converts protocol to lowercase (HTTPS → https)
   * 3. Converts hostname to lowercase (Bandcamp.com → bandcamp.com)
   * 4. Preserves path, query params, and hash exactly as provided
   *
   * If URL parsing fails, returns trimmed lowercase version as fallback.
   *
   * @param url - URL to normalize
   * @returns Normalized URL string
   *
   * @example
   * ```typescript
   * const normalizer = new UrlNormalizer();
   *
   * // Bandcamp example
   * normalizer.normalize('  HTTPS://BandCamp.com/track/example  ');
   * // Returns: 'https://bandcamp.com/track/example'
   *
   * // YouTube Music example
   * normalizer.normalize('https://Music.YouTube.com/watch?v=abc123');
   * // Returns: 'https://music.youtube.com/watch?v=abc123'
   *
   * // Preserves path and query params
   * normalizer.normalize('https://bandcamp.com/Album/Track?id=123');
   * // Returns: 'https://bandcamp.com/Album/Track?id=123'
   * ```
   */
  normalize(url: string): string {
    try {
      const trimmed = url.trim();
      const parsed = new URL(trimmed);

      // Normalize protocol and domain to lowercase
      const protocol = parsed.protocol.toLowerCase();
      const hostname = parsed.hostname.toLowerCase();

      // Preserve path and query params as-is (yt-dlp needs them)
      const pathname = parsed.pathname;
      const search = parsed.search;
      const hash = parsed.hash;

      return `${protocol}//${hostname}${pathname}${search}${hash}`;
    } catch {
      // If URL parsing fails, just return trimmed lowercase
      return url.trim().toLowerCase();
    }
  }
}
