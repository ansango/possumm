/**
 * Supported streaming platform providers.
 */
export type Provider = "youtube" | "bandcamp";

/**
 * Track information for albums/playlists.
 */
interface Track {
  /** Track number in the album/playlist (null if not available) */
  track: number | null;
  /** Track title (null if not available) */
  title: string | null;
  /** Track duration in seconds (null if not available) */
  duration: number | null;
}

/**
 * Media entity representing downloadable content (track or album).
 * 
 * Domain layer - No external dependencies. This entity represents the actual
 * media content being downloaded, separate from the download process itself.
 * 
 * All metadata fields except `id` and `provider` are nullable to handle incomplete
 * metadata from various sources. This is a business rule that allows the system
 * to work with imperfect data and supports manual editing later.
 * 
 * @example
 * ```typescript
 * // Creating from yt-dlp metadata (YouTube Music track)
 * const metadata = {
 *   id: 'abc123',
 *   title: 'Song Name',
 *   artist: 'Artist Name',
 *   album: 'Album Name',
 *   thumbnail: 'https://...',
 *   duration: 240
 * };
 * const media = MediaItem.fromYtDlpMetadata(metadata, 'youtube');
 * 
 * // Creating from incomplete metadata (Bandcamp album)
 * const incompleteMetadata = {
 *   id: 'xyz789',
 *   title: 'Album Name',
 *   // Missing artist, album_artist, etc.
 *   entries: [
 *     { title: 'Track 1', duration: 180 },
 *     { title: 'Track 2', duration: 200 }
 *   ]
 * };
 * const album = MediaItem.fromYtDlpMetadata(incompleteMetadata, 'bandcamp');
 * // Null fields are allowed and can be edited later
 * ```
 */
export class MediaItem {
  /**
   * Creates a new MediaItem instance.
   * 
   * @param id - Unique identifier (null for new media)
   * @param title - Media title (null if unknown)
   * @param artist - Artist name (null if unknown)
   * @param album - Album name (null if track or unknown)
   * @param albumArtist - Album artist (null if unknown)
   * @param year - Release year as string (null if unknown)
   * @param coverUrl - Cover/thumbnail URL (null if not available)
   * @param duration - Duration in seconds (null if not available)
   * @param provider - Platform provider (required)
   * @param providerId - Provider's ID for this media (null if unknown)
   * @param kind - Media type: 'track' or 'album' (null if unknown)
   * @param tracks - Array of tracks for albums (null for single tracks)
   * @param createdAt - Creation timestamp (null for new media)
   * @param updatedAt - Last update timestamp (null for new media)
   */
  constructor(
    public readonly id: number | null,
    public readonly title: string | null,
    public readonly artist: string | null,
    public readonly album: string | null,
    public readonly albumArtist: string | null,
    public readonly year: string | null,
    public readonly coverUrl: string | null,
    public readonly duration: number | null,
    public readonly provider: Provider,
    public readonly providerId: string | null,
    public readonly kind: "track" | "album" | null,
    public readonly tracks: Track[] | null,
    public readonly createdAt: Date | null,
    public readonly updatedAt: Date | null,
  ) {}

  /**
   * Factory method to create MediaItem from yt-dlp metadata.
   * 
   * Handles incomplete metadata gracefully by assigning null to missing fields.
   * Detects whether content is a track or album based on presence of entries.
   * 
   * Metadata mapping:
   * - title: data.title
   * - artist: data.artist || data.uploader (YouTube often uses 'uploader')
   * - album: data.album
   * - albumArtist: data.album_artist
   * - year: data.release_year || extracted from data.upload_date
   * - coverUrl: data.thumbnail
   * - duration: data.duration
   * - providerId: data.id
   * - kind: 'album' if data.entries exists, otherwise 'track'
   * - tracks: Mapped from data.entries if present
   * 
   * @param data - Raw metadata from yt-dlp (JSON output)
   * @param provider - Platform provider (bandcamp or youtube)
   * @returns New MediaItem with nullable fields for missing data
   * 
   * @example
   * ```typescript
   * // Complete YouTube Music track metadata
   * const ytMetadata = {
   *   id: 'abc123',
   *   title: 'Song Title',
   *   artist: 'Artist Name',
   *   album: 'Album Name',
   *   album_artist: 'Album Artist',
   *   release_year: 2024,
   *   thumbnail: 'https://i.ytimg.com/...',
   *   duration: 240
   * };
   * const track = MediaItem.fromYtDlpMetadata(ytMetadata, 'youtube');
   * // kind: 'track', all fields populated
   * 
   * // Incomplete Bandcamp album metadata
   * const bandcampMetadata = {
   *   id: 'xyz789',
   *   title: 'Album Name',
   *   // No artist, album_artist, or year
   *   thumbnail: 'https://f4.bcbits.com/...',
   *   entries: [
   *     { playlist_index: 1, title: 'Track 1', duration: 180 },
   *     { title: 'Track 2', duration: 200 } // No playlist_index
   *   ]
   * };
   * const album = MediaItem.fromYtDlpMetadata(bandcampMetadata, 'bandcamp');
   * // kind: 'album', artist: null, albumArtist: null, year: null
   * // tracks: [{ track: 1, title: 'Track 1', ... }, { track: 2, title: 'Track 2', ... }]
   * ```
   */
  static fromYtDlpMetadata(data: any, provider: Provider): MediaItem {
    const tracks = data.entries
      ? data.entries.map((entry: any, index: number) => ({
          track: entry.playlist_index ?? index + 1,
          title: entry.title ?? null,
          duration: entry.duration ?? null,
        }))
      : null;

    return new MediaItem(
      null,
      data.title ?? null,
      (data.artist || data.uploader) ?? null,
      data.album ?? null,
      data.album_artist ?? null,
      data.release_year?.toString() ?? data.upload_date?.substring(0, 4) ?? null,
      data.thumbnail ?? null,
      data.duration ?? null,
      provider,
      data.id ?? null,
      data._type === "playlist" || data.entries ? "album" : "track",
      tracks,
      null,
      null,
    );
  }

  /**
   * Factory method to create MediaItem from a database row.
   * 
   * Handles conversion of snake_case columns to camelCase properties,
   * string dates to Date objects, and JSON strings to Track arrays.
   * 
   * @param row - Raw database row with snake_case columns
   * @returns New MediaItem instance
   * 
   * @example
   * ```typescript
   * const dbRow = {
   *   id: 42,
   *   title: 'Album Name',
   *   artist: 'Artist Name',
   *   album: null,
   *   album_artist: 'Album Artist',
   *   year: '2024',
   *   cover_url: 'https://...',
   *   duration: 2400,
   *   provider: 'bandcamp',
   *   provider_id: 'xyz789',
   *   kind: 'album',
   *   tracks: '[{"track":1,"title":"Track 1","duration":180}]',
   *   created_at: '2026-02-06T10:00:00Z',
   *   updated_at: '2026-02-06T10:00:00Z'
   * };
   * const media = MediaItem.fromDatabase(dbRow);
   * ```
   */
  static fromDatabase(row: any): MediaItem {
    return new MediaItem(
      row.id,
      row.title,
      row.artist,
      row.album,
      row.album_artist,
      row.year,
      row.cover_url,
      row.duration,
      row.provider as Provider,
      row.provider_id,
      row.kind as "track" | "album" | null,
      row.tracks ? JSON.parse(row.tracks) : null,
      row.created_at ? new Date(row.created_at) : null,
      row.updated_at ? new Date(row.updated_at) : null,
    );
  }

  /**
   * Serializes the media to a JSON-friendly format for API responses.
   * 
   * Converts Date objects to ISO 8601 strings and uses camelCase.
   * 
   * @returns Plain object suitable for JSON serialization
   * 
   * @example
   * ```typescript
   * const json = media.toJSON();
   * // Returns:
   * // {
   * //   id: 42,
   * //   title: 'Album Name',
   * //   artist: 'Artist Name',
   * //   album: null,
   * //   albumArtist: 'Album Artist',
   * //   year: '2024',
   * //   coverUrl: 'https://...',
   * //   duration: 2400,
   * //   provider: 'bandcamp',
   * //   providerId: 'xyz789',
   * //   kind: 'album',
   * //   tracks: [{ track: 1, title: 'Track 1', duration: 180 }],
   * //   createdAt: '2026-02-06T10:00:00.000Z',
   * //   updatedAt: '2026-02-06T10:00:00.000Z'
   * // }
   * ```
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      artist: this.artist,
      album: this.album,
      albumArtist: this.albumArtist,
      year: this.year,
      coverUrl: this.coverUrl,
      duration: this.duration,
      provider: this.provider,
      providerId: this.providerId,
      kind: this.kind,
      tracks: this.tracks,
      createdAt: this.createdAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }
}
