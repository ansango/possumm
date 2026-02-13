import { spawn } from 'bun';
import { Provider } from '@/core/domain/media/entities/media';
import type { PinoLogger } from 'hono-pino';

/**
 * Metadata result from yt-dlp extraction.
 *
 * All fields are nullable to support incomplete metadata from various sources.
 */
interface MetadataResult {
  title: string | null;
  artist: string | null;
  album: string | null;
  album_artist: string | null;
  release_year: string | null;
  upload_date: string | null;
  thumbnail: string | null;
  duration: number | null;
  id: string | null;
  uploader: string | null;
  /** Type marker: 'playlist' for albums, undefined for tracks */
  _type?: string;
  /** Array of tracks for playlists/albums */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entries?: any[];
}

/**
 * Service for extracting media metadata using yt-dlp.
 *
 * Application layer - Service providing metadata extraction logic.
 * Uses yt-dlp with --skip-download --dump-json flags to get metadata
 * without downloading actual content.
 *
 * Handles both single tracks and playlists/albums gracefully, and
 * tolerates incomplete metadata by allowing null fields.
 */
export class MetadataExtractor {
  /**
   * Creates a new MetadataExtractor instance.
   *
   * @param logger - Logger for structured logging
   */
  constructor(private readonly logger: PinoLogger) {}

  /**
   * Extracts metadata from a URL using yt-dlp.
   *
   * Flow:
   * 1. Spawns yt-dlp process with --skip-download and --dump-json flags
   * 2. Parses JSON output (one line per track for playlists)
   * 3. Aggregates entries for playlists/albums
   * 4. Validates and logs warnings for incomplete metadata
   * 5. Returns metadata with null for missing fields
   *
   * For playlists/albums, yt-dlp returns multiple JSON lines (one per track).
   * The first line contains album-level metadata, subsequent lines are tracks.
   *
   * @param url - URL to extract metadata from
   * @param provider - Platform provider (bandcamp or youtube)
   * @returns Metadata with nullable fields for missing data
   * @throws Error if yt-dlp fails or JSON parsing fails
   *
   * @example
   * ```typescript
   * const extractor = new MetadataExtractor(logger);
   *
   * // Extract YouTube Music track
   * const trackMetadata = await extractor.extract(
   *   'https://music.youtube.com/watch?v=abc123',
   *   'youtube'
   * );
   * // Returns: {
   * //   id: 'abc123',
   * //   title: 'Song Name',
   * //   artist: 'Artist Name',
   * //   album: 'Album Name',
   * //   thumbnail: 'https://...',
   * //   duration: 240,
   * //   _type: undefined,
   * //   entries: undefined
   * // }
   *
   * // Extract Bandcamp album (incomplete metadata)
   * const albumMetadata = await extractor.extract(
   *   'https://artist.bandcamp.com/album/album-name',
   *   'bandcamp'
   * );
   * // Returns: {
   * //   id: 'xyz789',
   * //   title: 'Album Name',
   * //   artist: null,  // Missing from Bandcamp
   * //   album_artist: null,
   * //   thumbnail: 'https://...',
   * //   _type: 'playlist',
   * //   entries: [
   * //     { playlist_index: 1, title: 'Track 1', duration: 180 },
   * //     { playlist_index: 2, title: 'Track 2', duration: 200 }
   * //   ]
   * // }
   * ```
   */
  async extract(url: string, provider: Provider): Promise<MetadataResult> {
    this.logger.info(`Extracting metadata from URL: ${url}, provider=${provider}`);

    try {
      const process = spawn({
        cmd: ['yt-dlp', '--js-runtime', 'bun', '--skip-download', '--dump-json', url],
        stdout: 'pipe',
        stderr: 'pipe'
      });

      // Capture both streams before checking exit code
      const [output, errorOutput] = await Promise.all([
        new Response(process.stdout).text(),
        new Response(process.stderr).text()
      ]);

      const exitCode = await process.exited;

      if (exitCode !== 0) {
        this.logger.error(
          `yt-dlp metadata extraction failed: exitCode=${exitCode}, error=${errorOutput}`
        );
        throw new Error(`Failed to extract metadata: ${errorOutput}`);
      }

      // Parse JSON lines
      const lines = output
        .trim()
        .split('\n')
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        throw new Error('No metadata returned from yt-dlp');
      }

      // Parse first line as main metadata
      let metadata: MetadataResult;
      try {
        metadata = JSON.parse(lines[0]);
      } catch (parseError) {
        this.logger.error(`Failed to parse metadata JSON: ${parseError}, line=${lines[0]}`);
        throw new Error('Failed to parse metadata JSON');
      }

      // If there are multiple lines, it's likely a playlist
      if (lines.length > 1) {
        metadata.entries = [];
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            metadata.entries.push(entry);
          } catch {
            this.logger.warn(`Failed to parse playlist entry, skipping: ${line}`);
          }
        }
        metadata._type = 'playlist';
      }

      // Log warnings for incomplete metadata
      if (!metadata.title) {
        this.logger.warn(`Metadata missing title for URL: ${url}`);
      }
      if (!metadata.artist && !metadata.uploader) {
        this.logger.warn(`Metadata missing artist/uploader for URL: ${url}`);
      }

      this.logger.info(
        `Metadata extracted successfully: title=${metadata.title}, artist=${metadata.artist || metadata.uploader}, type=${metadata._type || 'single'}`
      );

      return metadata;
    } catch (error) {
      this.logger.error(`Error extracting metadata from ${url}: ${error}`);
      throw error;
    }
  }
}
