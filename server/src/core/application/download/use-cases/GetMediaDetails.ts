import { MediaRepository } from '@/core/domain/media/repositories/media-repository';
import type { PinoLogger } from 'hono-pino';

/**
 * Result structure for media details query.
 *
 * Includes all media metadata fields plus timestamps.
 */
interface MediaDetailsResult {
  id: number;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  year: string | null;
  coverUrl: string | null;
  duration: number | null;
  provider: string;
  providerId: string | null;
  kind: 'track' | 'album' | null;
  tracks: Array<{
    track: number | null;
    title: string | null;
    duration: number | null;
  }> | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * Use case for retrieving detailed media information.
 *
 * Application layer - Query use case for single media retrieval.
 * Returns complete media metadata including tracks array for albums.
 *
 * Used by API handlers for media detail views.
 */
export class GetMediaDetails {
  /**
   * Creates a new GetMediaDetails use case.
   *
   * @param mediaRepo - Media repository for retrieval
   * @param logger - Logger for structured logging
   */
  constructor(
    private readonly mediaRepo: MediaRepository,
    private readonly logger: PinoLogger
  ) {}

  /**
   * Retrieves detailed media information.
   *
   * Simple passthrough to repository with type mapping.
   * All fields may be null depending on provider data quality.
   *
   * @param mediaId - Media ID to retrieve
   * @returns Complete media details
   * @throws Error if media not found (HTTP 404)
   *
   * @example
   * ```typescript
   * const getMediaDetails = new GetMediaDetails(mediaRepo, logger);
   *
   * // Get YouTube Music track details
   * const track = await getMediaDetails.execute(100);
   * // Returns: {
   * //   id: 100,
   * //   title: 'Song Title',
   * //   artist: 'Artist Name',
   * //   album: 'Album Name',
   * //   albumArtist: null,
   * //   year: '2024',
   * //   coverUrl: 'https://...',
   * //   duration: 240,
   * //   provider: 'youtube',
   * //   providerId: 'abc123',
   * //   kind: 'track',
   * //   tracks: null,
   * //   createdAt: 2024-01-15T10:30:00Z,
   * //   updatedAt: 2024-01-15T10:30:00Z
   * // }
   *
   * // Get Bandcamp album details
   * const album = await getMediaDetails.execute(101);
   * // Returns: {
   * //   ...,
   * //   kind: 'album',
   * //   tracks: [
   * //     { track: 1, title: 'Track 1', duration: 180 },
   * //     { track: 2, title: 'Track 2', duration: 200 }
   * //   ]
   * // }
   *
   * // Error: media not found
   * try {
   *   await getMediaDetails.execute(999);
   * } catch (error) {
   *   // Error: Media 999 not found
   * }
   * ```
   */
  async execute(mediaId: number): Promise<MediaDetailsResult> {
    const media = await this.mediaRepo.findById(mediaId);
    if (!media) {
      throw new Error(`Media ${mediaId} not found`);
    }

    return {
      id: media.id!,
      title: media.title,
      artist: media.artist,
      album: media.album,
      albumArtist: media.albumArtist,
      year: media.year,
      coverUrl: media.coverUrl,
      duration: media.duration,
      provider: media.provider,
      providerId: media.providerId,
      kind: media.kind,
      tracks: media.tracks,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt
    };
  }
}
