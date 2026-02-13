import { Provider } from '@/core/domain/media/entities/media';

/**
 * Result of URL validation.
 */
interface ValidationResult {
  /** Whether the URL is valid for a supported platform */
  valid: boolean;
  /** The detected provider, or null if invalid */
  provider: Provider | null;
}

/**
 * Service for detecting and validating supported streaming platforms.
 *
 * Application layer - Service providing platform detection logic.
 * Validates that URLs are from supported platforms (Bandcamp or YouTube Music)
 * and detects which provider to use for downloading.
 *
 * Supported platforms:
 * - Bandcamp: Track and album URLs (bandcamp.com/track/* or bandcamp.com/album/*)
 * - YouTube Music: Watch and playlist URLs (music.youtube.com/watch or music.youtube.com/playlist)
 */
export class PlatformDetector {
  /** Regex for Bandcamp track/album URLs */
  private bandcampRegex = /bandcamp\.com\/(track|album)\//i;
  /** Regex for YouTube Music watch/playlist URLs */
  private ytmusicRegex = /music\.youtube\.com\/(watch|playlist)/i;

  /**
   * Validates a URL and detects the provider.
   *
   * @param url - URL to validate
   * @returns Validation result with provider detection
   *
   * @example
   * ```typescript
   * const detector = new PlatformDetector();
   *
   * // Valid Bandcamp URL
   * detector.validate('https://artist.bandcamp.com/track/song-name');
   * // Returns: { valid: true, provider: 'bandcamp' }
   *
   * // Valid YouTube Music URL
   * detector.validate('https://music.youtube.com/watch?v=abc123');
   * // Returns: { valid: true, provider: 'youtube' }
   *
   * // Invalid URL
   * detector.validate('https://spotify.com/track/123');
   * // Returns: { valid: false, provider: null }
   * ```
   */
  validate(url: string): ValidationResult {
    if (this.bandcampRegex.test(url)) {
      return { valid: true, provider: 'bandcamp' };
    }

    if (this.ytmusicRegex.test(url)) {
      return { valid: true, provider: 'youtube' };
    }

    return { valid: false, provider: null };
  }

  /**
   * Validates a URL and returns the provider, or throws an error if invalid.
   *
   * Use this method in use cases where you need to ensure the URL is valid
   * before proceeding with download operations.
   *
   * @param url - URL to validate
   * @returns The detected provider
   * @throws Error with HTTP 400 - Invalid URL if platform is not supported
   *
   * @example
   * ```typescript
   * const detector = new PlatformDetector();
   *
   * try {
   *   // Valid URL
   *   const provider = detector.validateOrThrow(
   *     'https://music.youtube.com/playlist?list=abc123'
   *   );
   *   console.log(provider); // 'youtube'
   * } catch (error) {
   *   // Invalid URL
   *   console.error(error.message);
   *   // 'Invalid URL. Only Bandcamp (track/album) and YouTube Music (watch/playlist) URLs are supported.'
   * }
   * ```
   */
  validateOrThrow(url: string): Provider {
    const result = this.validate(url);

    if (!result.valid || !result.provider) {
      throw new Error(
        'Invalid URL. Only Bandcamp (track/album) and YouTube Music (watch/playlist) URLs are supported.'
      );
    }

    return result.provider;
  }
}
