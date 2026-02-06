/**
 * Status of a download in the system.
 * - pending: Queued and waiting to be processed
 * - in_progress: Currently being downloaded
 * - completed: Successfully finished
 * - failed: Download failed with error
 * - cancelled: User cancelled the download
 */
export type DownloadStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

/**
 * Download entity representing a media download request.
 * 
 * Domain layer - No external dependencies. This entity encapsulates all the data
 * and behavior related to a download, following Domain-Driven Design principles.
 * 
 * All properties are readonly to ensure immutability. State changes happen through
 * repository methods that create new instances.
 * 
 * @example
 * ```typescript
 * // Creating from database row
 * const download = DownloadItem.fromDatabase({
 *   id: 1,
 *   url: 'https://music.youtube.com/watch?v=abc123',
 *   normalized_url: 'https://music.youtube.com/watch?v=abc123',
 *   media_id: 42,
 *   status: 'completed',
 *   progress: 100,
 *   error_message: null,
 *   file_path: '/tmp/downloads/Artist/Album/01 Song.mp3',
 *   process_id: 12345,
 *   created_at: '2026-02-06T10:00:00Z',
 *   started_at: '2026-02-06T10:01:00Z',
 *   finished_at: '2026-02-06T10:05:00Z'
 * });
 * ```
 */
export class DownloadItem {
  /**
   * Creates a new DownloadItem instance.
   * 
   * @param id - Unique identifier for the download
   * @param url - Original URL provided by the user
   * @param normalizedUrl - Normalized version of URL for duplicate detection
   * @param mediaId - Reference to associated Media entity (null if not linked yet)
   * @param status - Current status of the download
   * @param progress - Download progress percentage (0-100)
   * @param errorMessage - Error description if status is 'failed' (null otherwise)
   * @param filePath - Path to downloaded file (null until completed)
   * @param processId - OS process ID of yt-dlp (null if not started)
   * @param createdAt - When the download was enqueued
   * @param startedAt - When the download started processing (null if pending)
   * @param finishedAt - When the download completed/failed/cancelled (null if in progress)
   */
  constructor(
    public readonly id: number,
    public readonly url: string,
    public readonly normalizedUrl: string,
    public readonly mediaId: number | null,
    public readonly status: DownloadStatus,
    public readonly progress: number,
    public readonly errorMessage: string | null,
    public readonly filePath: string | null,
    public readonly processId: number | null,
    public readonly createdAt: Date,
    public readonly startedAt: Date | null,
    public readonly finishedAt: Date | null,
  ) {}

  /**
   * Factory method to create a DownloadItem from a database row.
   * 
   * Handles conversion of snake_case database columns to camelCase properties,
   * and converts string dates to Date objects.
   * 
   * @param row - Raw database row object with snake_case columns
   * @returns A new DownloadItem instance
   * 
   * @example
   * ```typescript
   * const dbRow = {
   *   id: 1,
   *   url: 'https://bandcamp.com/track/example',
   *   normalized_url: 'https://bandcamp.com/track/example',
   *   media_id: null,
   *   status: 'pending',
   *   progress: 0,
   *   error_message: null,
   *   file_path: null,
   *   process_id: null,
   *   created_at: '2026-02-06T10:00:00Z',
   *   started_at: null,
   *   finished_at: null
   * };
   * const download = DownloadItem.fromDatabase(dbRow);
   * ```
   */
  static fromDatabase(row: any): DownloadItem {
    return new DownloadItem(
      row.id,
      row.url,
      row.normalized_url,
      row.media_id,
      row.status as DownloadStatus,
      row.progress ?? 0,
      row.error_message,
      row.file_path,
      row.process_id,
      new Date(row.created_at),
      row.started_at ? new Date(row.started_at) : null,
      row.finished_at ? new Date(row.finished_at) : null,
    );
  }

  /**
   * Serializes the download to a JSON-friendly format for API responses.
   * 
   * Converts Date objects to ISO 8601 strings and uses camelCase for property names.
   * 
   * @returns Plain object suitable for JSON serialization
   * 
   * @example
   * ```typescript
   * const json = download.toJSON();
   * // Returns:
   * // {
   * //   id: 1,
   * //   url: 'https://music.youtube.com/watch?v=abc123',
   * //   mediaId: 42,
   * //   status: 'completed',
   * //   progress: 100,
   * //   errorMessage: null,
   * //   filePath: '/tmp/downloads/Artist/Album/01 Song.mp3',
   * //   processId: 12345,
   * //   createdAt: '2026-02-06T10:00:00.000Z',
   * //   startedAt: '2026-02-06T10:01:00.000Z',
   * //   finishedAt: '2026-02-06T10:05:00.000Z'
   * // }
   * ```
   */
  toJSON() {
    return {
      id: this.id,
      url: this.url,
      mediaId: this.mediaId,
      status: this.status,
      progress: this.progress,
      errorMessage: this.errorMessage,
      filePath: this.filePath,
      processId: this.processId,
      createdAt: this.createdAt.toISOString(),
      startedAt: this.startedAt?.toISOString() ?? null,
      finishedAt: this.finishedAt?.toISOString() ?? null,
    };
  }
}
