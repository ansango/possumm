import { spawn } from 'bun';
import { Provider } from '@/core/domain/media/entities/media';
import type { PinoLogger } from 'hono-pino';
import { writeFile } from 'fs';

/**
 * Metadata result from yt-dlp extraction.
 *
 * All fields are nullable to support incomplete metadata from various sources.
 */
type MetadataResult = any; // Replace with actual type definition based on yt-dlp output structure

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
  async extract(url: string, provider: Provider): Promise<MetadataResult | null> {
    this.logger.info(`Extracting metadata from URL: ${url}, provider=${provider}`);

    const youtubeExtractor = new MetadataExtractorYoutube(this.logger);
    const bandcampExtractor = new MetadataExtractorBandcamp(this.logger);

    const extractors = {
      youtube: youtubeExtractor,
      bandcamp: bandcampExtractor
    };

    const extractor = extractors[provider];
    const type = extractor.getMediaType(url);

    if (!type) {
      this.logger.error(
        `Unable to determine media type from URL: ${url} for provider: ${provider}`
      );
      throw new Error(`Unable to determine media type from URL: ${url} for provider: ${provider}`);
    }

    try {
      const cmd = extractor.getArgs(url, type);
      const [result, error] = await this.spawnProcess(cmd);
      const data = extractor.getMappedOutput(type, result);

      // this.logger.info(
      //   `Streams captured - stdout length: ${output.length}, stderr length: ${errorOutput.length}`
      // );
      // if (errorOutput.length > 0) {
      //   this.logger.warn(
      //     `stderr output: ${errorOutput.substring(0, 500)}${errorOutput.length > 500 ? '...' : ''}`
      //   );
      // }

      //const exitCode = await process.exited;
      //this.logger.info(`Process exited with code: ${exitCode}`);

      // if (exitCode !== 0) {
      //   this.logger.error(
      //     `yt-dlp metadata extraction failed: exitCode=${exitCode}, error=${errorOutput}`
      //   );
      //   throw new Error(`Failed to extract metadata: ${errorOutput}`);
      // }

      // Parse JSON lines
      // const lines = output
      //   .trim()
      //   .split('\n')
      //   .filter((line) => line.length > 0);

      // if (lines.length === 0) {
      //   throw new Error('No metadata returned from yt-dlp');
      // }

      // Parse first line as main metadata
      // let metadata: MetadataResult;

      // this.logger.info(`output result: ${output}`);
      //this.logger.info(`Parsing metadata JSON from first line: ${lines[0].substring(0, 500)}...`);

      // try {
      //   metadata = JSON.parse(lines[0]);
      // } catch (parseError) {
      //   this.logger.error(`Failed to parse metadata JSON: ${parseError}, line=${lines[0]}`);
      //   throw new Error('Failed to parse metadata JSON');
      // }

      // // If there are multiple lines, it's likely a playlist
      // if (lines.length > 1) {
      //   metadata.entries = [];
      //   for (const line of lines) {
      //     try {
      //       const entry = JSON.parse(line);
      //       metadata.entries.push(entry);
      //     } catch {
      //       this.logger.warn(`Failed to parse playlist entry, skipping: ${line}`);
      //     }
      //   }
      //   metadata._type = 'playlist';
      // }

      // // Log warnings for incomplete metadata
      // if (!metadata.title) {
      //   this.logger.warn(`Metadata missing title for URL: ${url}`);
      // }
      // if (!metadata.artist && !metadata.uploader) {
      //   this.logger.warn(`Metadata missing artist/uploader for URL: ${url}`);
      // }

      // this.logger.info(
      //   `Metadata extracted successfully: title=${metadata.title}, artist=${metadata.artist || metadata.uploader}, type=${metadata._type || 'single'}`
      // );

      // return metadata;
      return null;
    } catch (error) {
      this.logger.error(`Error extracting metadata from ${url}: ${error}`);
      throw error;
    }
  }

  async spawnProcess(cmd: string[]) {
    const process = spawn({
      cmd,
      stdout: 'pipe',
      stderr: 'pipe'
    });

    this.logger.info(`Spawning process: ${cmd.join(' ')}`);
    this.logger.info(`Process spawned with PID: ${process.pid}`);

    const [result, error] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text()
    ]);

    this.logger.info(
      `Streams captured - stdout length: ${result.length}, stderr length: ${error.length}`
    );
    if (error.length > 0) {
      this.logger.warn(
        `stderr output: ${error.substring(0, 500)}${error.length > 500 ? '...' : ''}`
      );
    }

    const exitCode = await process.exited;
    this.logger.info(`Process exited with code: ${exitCode}`);

    if (exitCode !== 0) {
      this.logger.error(`Process failed: exitCode=${exitCode}, error=${error}`);
      throw new Error(`Process failed: ${error}`);
    }

    return [result, error];
  }
}

interface Extractor {
  getMediaType(url: string): 'track' | 'album' | null;
  getArgs(url: string, media: 'track' | 'album'): string[];
  getMappedOutput(type: 'track' | 'album', result: string): MetadataResult;
}

const cmdCommandArgs = ['yt-dlp', '--js-runtime', 'bun', '--skip-download'];

/**
 * Extractor implementation for YouTube Music using yt-dlp.
 *
 * Handles both single tracks and playlists (albums) by analyzing the URL.
 * Provides appropriate command arguments for yt-dlp based on media type.
 */

class MetadataExtractorYoutube implements Extractor {
  albumArgs = [...cmdCommandArgs, '--dump-single-json', '--no-warnings'];
  trackArgs = [...cmdCommandArgs, '--dump-single-json', '--no-warnings'];

  constructor(private readonly logger: PinoLogger) {}

  getMediaType(url: string) {
    if (url.includes('playlist')) {
      return 'album';
    }

    if (url.includes('watch')) {
      return 'track';
    }
    this.logger.warn(`Unable to determine media type from URL: ${url}'`);
    return null;
  }

  getArgs(url: string, media: 'track' | 'album'): string[] {
    return {
      track: [...this.trackArgs, url],
      album: [...this.albumArgs, url]
    }[media];
  }

  getMappedOutput(type: 'track' | 'album', result: string): MetadataResult {
    return {
      track: this.getMappedTrackOutput(result),
      album: this.getMappedAlbumOutput(result)
    }[type];
  }

  getMappedAlbumOutput(result: string): MetadataResult {
    
    writeFile('yt-album-metadata.json', result, (err) => {
      if (err) {
        this.logger.error(`Failed to write album metadata to file: ${err}`);
      } else {
        this.logger.info('Album metadata written to yt-album-metadata.json');
      }
    });

    try {
      const {
        id,
        title: album,
        entries
      } = JSON.parse(result) as {
        id: string;
        title: string;
        entries: {
          title: string;
          duration: number;
          url: string;
          uploader: string;
          thumbnails: { url: string; width: number; height: number }[];
        }[];
      };

      const tracks = entries.map((entry, index) => ({
        title: entry.title,
        duration: entry.duration,
        url: entry.url,
        artist: entry.uploader,
        thumbnail: entry.thumbnails?.[0]?.url || null,
        playlist_index: index + 1
      }));

      const artist =
        tracks[0]?.artist.replaceAll('-', '').replaceAll('Official', '').trim() ?? null;

      const data = {
        id,
        album: album.replaceAll('-', '').replaceAll('Album', '').trim(),
        artist,
        type: 'album',
        tracks
      };
      console.log('Parsed YT album metadata:', data);
      // replace '-' and 'Album'
      return data;
    } catch (parseError) {
      this.logger.error(`Failed to parse album metadata JSON: ${parseError}, result=${result}`);
      throw new Error('Failed to parse album metadata JSON');
    }
  }

  getMappedTrackOutput(result: string): MetadataResult {
    try {
      const metadata = JSON.parse(result);
      return metadata;
    } catch (parseError) {
      this.logger.error(`Failed to parse track metadata JSON: ${parseError}, result=${result}`);
      throw new Error('Failed to parse track metadata JSON');
    }
  }
}
class MetadataExtractorBandcamp implements Extractor {
  albumArgs = [...cmdCommandArgs, '--dump-single-json', '--no-warnings', '--flat-playlist'];
  trackArgs = [...cmdCommandArgs, '--dump-single-json', '--no-warnings'];
  constructor(private readonly logger: PinoLogger) {}
  getMediaType(url: string) {
    if (url.includes('/album/')) {
      return 'album';
    }
    if (url.includes('/track/')) {
      return 'track';
    }

    // Default to track if we can't determine
    this.logger.warn(`Unable to determine media type from URL: ${url}`);
    return null;
  }

  getArgs(url: string, media: 'track' | 'album'): string[] {
    return {
      track: [...this.trackArgs, url],
      album: [...this.albumArgs, url]
    }[media];
  }

  getMappedOutput(type: 'track' | 'album', result: string): MetadataResult {
    return {
      track: this.getMappedTrackOutput(result),
      album: this.getMappedAlbumOutput(result)
    }[type];
  }

  getMappedAlbumOutput(result: string): MetadataResult {
    try {
      const metadata = JSON.parse(result);
      return metadata;
    } catch (parseError) {
      this.logger.error(`Failed to parse album metadata JSON: ${parseError}, result=${result}`);
      throw new Error('Failed to parse album metadata JSON');
    }
  }

  getMappedTrackOutput(result: string): MetadataResult {
    try {
      const metadata = JSON.parse(result);
      return metadata;
    } catch (parseError) {
      this.logger.error(`Failed to parse track metadata JSON: ${parseError}, result=${result}`);
      throw new Error('Failed to parse track metadata JSON');
    }
  }
}
