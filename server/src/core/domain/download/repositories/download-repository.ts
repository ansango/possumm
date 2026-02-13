import { DownloadItem, DownloadStatus } from '../entities/download';

/**
 * Data required to create a new download record.
 * Used by the create() method to initialize a download with all required fields.
 */
export type CreateDownloadData = {
  /** Original URL provided by user */
  url: string;
  /** Normalized URL for duplicate detection */
  normalizedUrl: string;
  /** Reference to Media entity (null if not linked yet) */
  mediaId: number | null;
  /** Initial status (typically 'pending') */
  status: DownloadStatus;
  /** Initial progress (typically 0) */
  progress: number;
  /** Error message (null for new downloads) */
  errorMessage: string | null;
  /** File path (null until completed) */
  filePath: string | null;
  /** Process ID (null until started) */
  processId: number | null;
};

/**
 * Repository contract for Download entity persistence.
 *
 * Domain layer - Defines the interface without implementation details.
 * Implementations live in the infrastructure layer (SQLite, cached decorator).
 *
 * This repository provides methods for:
 * - CRUD operations on downloads
 * - Finding downloads by various criteria (status, URL, age)
 * - Managing download lifecycle (status updates, linking media)
 * - Queue management (finding next pending, detecting stalled downloads)
 *
 * @see {@link DownloadItem} for the entity structure
 */
export interface DownloadRepository {
  /**
   * Finds a download by its unique ID.
   *
   * @param id - Download ID
   * @returns The download if found, null otherwise
   * @throws Error with HTTP 404 if download doesn't exist (in use case layer)
   */
  findById(id: number): Promise<DownloadItem | null>;

  /**
   * Finds the next pending download to process (FIFO queue).
   *
   * Orders by created_at ASC to maintain queue order.
   * Used by DownloadWorker to get the next download to process.
   *
   * @returns The oldest pending download, or null if queue is empty
   */
  findNextPending(): Promise<DownloadItem | null>;

  /**
   * Finds an active download (pending or in_progress) by normalized URL.
   *
   * Used to prevent duplicate downloads of the same URL.
   *
   * @param normalizedUrl - The normalized URL to search for
   * @returns Active download with this URL, or null if none exists
   * @throws Error with HTTP 409 if duplicate found (in use case layer)
   */
  findActiveByNormalizedUrl(normalizedUrl: string): Promise<DownloadItem | null>;

  /**
   * Finds downloads by status with pagination.
   *
   * @param status - Filter by this status
   * @param page - Page number (0-indexed)
   * @param pageSize - Number of items per page
   * @returns Array of downloads matching the status
   */
  findByStatus(status: DownloadStatus, page: number, pageSize: number): Promise<DownloadItem[]>;

  /**
   * Finds all downloads with pagination.
   *
   * @param page - Page number (0-indexed)
   * @param pageSize - Number of items per page
   * @returns Array of all downloads, ordered by created_at DESC
   */
  findAll(page: number, pageSize: number): Promise<DownloadItem[]>;

  /**
   * Finds old completed or failed downloads for cleanup.
   *
   * Used by CleanupOrphanedFiles use case to identify downloads
   * that can be safely deleted based on retention policy.
   *
   * @param days - Number of days to look back (e.g., 7 for weekly cleanup)
   * @returns Array of downloads older than specified days
   */
  findOldCompleted(days: number): Promise<DownloadItem[]>;

  /**
   * Finds downloads stuck in 'in_progress' status beyond timeout.
   *
   * Used by MarkStalledDownloads use case to detect and mark
   * downloads that appear to have stalled or crashed.
   *
   * @param timeoutMinutes - Maximum time a download should take (e.g., 60 minutes)
   * @returns Array of stalled downloads
   */
  findStalledInProgress(timeoutMinutes: number): Promise<DownloadItem[]>;

  /**
   * Counts total number of downloads.
   *
   * @returns Total count of all downloads
   */
  countAll(): Promise<number>;

  /**
   * Counts downloads by status.
   *
   * Used to check pending queue size before enqueueing new downloads.
   *
   * @param status - Status to count
   * @returns Number of downloads with this status
   */
  countByStatus(status: DownloadStatus): Promise<number>;

  /**
   * Creates a new download record.
   *
   * @param download - Download data to create
   * @returns The created download with generated ID
   * @throws Error if creation fails
   */
  create(download: CreateDownloadData): Promise<DownloadItem>;

  /**
   * Updates download status, progress, error message, and optionally file path.
   *
   * Automatically sets finishedAt timestamp when status is 'completed', 'failed', or 'cancelled'.
   *
   * @param id - Download ID to update
   * @param status - New status
   * @param progress - Progress percentage (0-100)
   * @param errorMessage - Error description (null if no error)
   * @param filePath - Optional file path (set when download completes)
   * @throws Error with HTTP 404 if download not found (in use case layer)
   */
  updateStatus(
    id: number,
    status: DownloadStatus,
    progress: number,
    errorMessage: string | null,
    filePath?: string | null
  ): Promise<void>;

  /**
   * Updates the process ID and sets startedAt timestamp.
   *
   * Called when download processing begins to track the yt-dlp process.
   *
   * @param id - Download ID
   * @param processId - OS process ID of yt-dlp
   * @throws Error with HTTP 404 if download not found (in use case layer)
   */
  updateProcessId(id: number, processId: number): Promise<void>;

  /**
   * Links a download to a media entity.
   *
   * Called after metadata extraction to associate download with its media.
   *
   * @param id - Download ID
   * @param mediaId - Media entity ID to link
   * @throws Error with HTTP 404 if download not found (in use case layer)
   */
  updateMediaId(id: number, mediaId: number): Promise<void>;

  /**
   * Deletes a download record.
   *
   * Note: Does not delete the physical file. Use CleanupOrphanedFiles for that.
   *
   * @param id - Download ID to delete
   */
  delete(id: number): Promise<void>;

  /**
   * Deletes all download records.
   *
   * WARNING: Use with caution. Primarily for testing/development.
   */
  deleteAll(): Promise<void>;
}
