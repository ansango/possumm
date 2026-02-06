import { DownloadRepository, CreateDownloadData } from "@/core/domain/download/repositories/download-repository";
import { DownloadItem, DownloadStatus } from "@/core/domain/download/entities/download";
import { downloadsDb } from "@/lib/db/downloads/database";
import { Database } from "bun:sqlite";

/**
 * SQLite implementation of DownloadRepository.
 * 
 * Infrastructure layer - Concrete repository using SQLite for persistence.
 * Uses Bun's native SQLite driver with prepared statements for performance.
 * 
 * Database schema features:
 * - Composite index on (normalized_url, status) for duplicate detection
 * - Timestamps (created_at, started_at, finished_at) for lifecycle tracking
 * - Foreign key to media table (media_id) with ON DELETE SET NULL
 * - Process ID tracking for cancellation support
 * 
 * All queries use prepared statements to prevent SQL injection.
 * Date/time operations use SQLite's datetime functions (UTC).
 * 
 * @see DownloadRepository - For interface documentation
 * @see downloadsDb - For database connection configuration
 */
export class SQLiteDownloadRepository implements DownloadRepository {
  private db: Database;

  /**
   * Creates a new SQLiteDownloadRepository instance.
   * 
   * Initializes with shared database connection from downloadsDb.
   * Database is already configured with WAL mode and proper indexes.
   */
  constructor() {
    this.db = downloadsDb;
  }

  /**
   * Finds a download by ID.
   * 
   * SQL: `SELECT * FROM downloads WHERE id = ?`
   * 
   * @param id - Download ID
   * @returns Download if found, null otherwise
   * 
   * @example
   * ```typescript
   * const repo = new SQLiteDownloadRepository();
   * const download = await repo.findById(42);
   * // Returns: DownloadItem { id: 42, url: '...', status: 'completed', ... }
   * // or null if not found
   * ```
   */
  async findById(id: number): Promise<DownloadItem | null> {
    const stmt = this.db.prepare("SELECT * FROM downloads WHERE id = ?");
    const row = stmt.get(id) as any;
    return row ? DownloadItem.fromDatabase(row) : null;
  }

  /**
   * Finds the oldest pending download (FIFO queue).
   * 
   * SQL:
   * ```sql
   * SELECT * FROM downloads
   * WHERE status = 'pending'
   * ORDER BY created_at ASC
   * LIMIT 1
   * ```
   * 
   * Used by DownloadWorker to process downloads in order.
   * 
   * @returns Oldest pending download, or null if queue empty
   * 
   * @example
   * ```typescript
   * const next = await repo.findNextPending();
   * // Returns: DownloadItem with earliest created_at where status = 'pending'
   * // or null if no pending downloads
   * ```
   */
  async findNextPending(): Promise<DownloadItem | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM downloads
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
    `);
    const row = stmt.get() as any;
    return row ? DownloadItem.fromDatabase(row) : null;
  }

  /**
   * Finds active download by normalized URL (duplicate detection).
   * 
   * SQL:
   * ```sql
   * SELECT * FROM downloads
   * WHERE normalized_url = ? AND status IN ('pending', 'in_progress')
   * LIMIT 1
   * ```
   * 
   * Uses composite index on (normalized_url, status) for fast lookup.
   * Only checks pending/in_progress to allow re-downloading completed items.
   * 
   * @param normalizedUrl - Normalized URL from UrlNormalizer
   * @returns Active download if found, null otherwise
   * 
   * @example
   * ```typescript
   * const normalized = 'https://music.youtube.com/watch?v=abc123';
   * const existing = await repo.findActiveByNormalizedUrl(normalized);
   * // Returns: DownloadItem if URL is already queued/downloading
   * // null if completed/failed/not found
   * ```
   */
  async findActiveByNormalizedUrl(normalizedUrl: string): Promise<DownloadItem | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM downloads
      WHERE normalized_url = ? AND status IN ('pending', 'in_progress')
      LIMIT 1
    `);
    const row = stmt.get(normalizedUrl) as any;
    return row ? DownloadItem.fromDatabase(row) : null;
  }

  /**
   * Finds downloads by status with pagination.
   * 
   * SQL:
   * ```sql
   * SELECT * FROM downloads
   * WHERE status = ?
   * ORDER BY created_at DESC
   * LIMIT ? OFFSET ?
   * ```
   * 
   * Results ordered newest first. Pagination is 0-based.
   * 
   * @param status - Status to filter by
   * @param page - Page number (0-based)
   * @param pageSize - Items per page
   * @returns Array of downloads matching status
   * 
   * @example
   * ```typescript
   * // Get second page of completed downloads
   * const completed = await repo.findByStatus('completed', 1, 20);
   * // Returns: Downloads 21-40 ordered by created_at DESC
   * ```
   */
  async findByStatus(
    status: DownloadStatus,
    page: number,
    pageSize: number
  ): Promise<DownloadItem[]> {
    const offset = page * pageSize;
    const stmt = this.db.prepare(`
      SELECT * FROM downloads
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(status, pageSize, offset) as any[];
    return rows.map((row) => DownloadItem.fromDatabase(row));
  }

  /**
   * Finds all downloads with pagination.
   * 
   * SQL:
   * ```sql
   * SELECT * FROM downloads
   * ORDER BY created_at DESC
   * LIMIT ? OFFSET ?
   * ```
   * 
   * Results ordered newest first. Pagination is 0-based.
   * 
   * @param page - Page number (0-based)
   * @param pageSize - Items per page
   * @returns Array of all downloads
   * 
   * @example
   * ```typescript
   * // Get first page of all downloads
   * const all = await repo.findAll(0, 20);
   * // Returns: First 20 downloads ordered by created_at DESC
   * ```
   */
  async findAll(page: number, pageSize: number): Promise<DownloadItem[]> {
    const offset = page * pageSize;
    const stmt = this.db.prepare(`
      SELECT * FROM downloads
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(pageSize, offset) as any[];
    return rows.map((row) => DownloadItem.fromDatabase(row));
  }

  /**
   * Finds old completed/failed downloads for cleanup.
   * 
   * SQL:
   * ```sql
   * SELECT * FROM downloads
   * WHERE (status = 'completed' OR status = 'failed')
   * AND finished_at < datetime('now', '-' || ? || ' days')
   * ```
   * 
   * Used by CleanupOrphanedFiles use case to remove stale entries.
   * 
   * @param days - Age threshold in days
   * @returns Array of downloads older than threshold
   * 
   * @example
   * ```typescript
   * // Find downloads finished more than 30 days ago
   * const old = await repo.findOldCompleted(30);
   * // Returns: Downloads with finished_at < now - 30 days
   * ```
   */
  async findOldCompleted(days: number): Promise<DownloadItem[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM downloads
      WHERE (status = 'completed' OR status = 'failed')
      AND finished_at < datetime('now', '-' || ? || ' days')
    `);
    const rows = stmt.all(days) as any[];
    return rows.map((row) => DownloadItem.fromDatabase(row));
  }

  /**
   * Finds stalled in-progress downloads for recovery.
   * 
   * SQL:
   * ```sql
   * SELECT * FROM downloads
   * WHERE status = 'in_progress'
   * AND started_at < datetime('now', '-' || ? || ' minutes')
   * ```
   * 
   * Detects downloads stuck in in_progress state (process crashed/killed).
   * Used by MarkStalledDownloads use case.
   * 
   * @param timeoutMinutes - Timeout threshold in minutes
   * @returns Array of stalled downloads
   * 
   * @example
   * ```typescript
   * // Find downloads stuck for more than 60 minutes
   * const stalled = await repo.findStalledInProgress(60);
   * // Returns: Downloads with started_at < now - 60 minutes and status still 'in_progress'
   * ```
   */
  async findStalledInProgress(timeoutMinutes: number): Promise<DownloadItem[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM downloads
      WHERE status = 'in_progress'
      AND started_at < datetime('now', '-' || ? || ' minutes')
    `);
    const rows = stmt.all(timeoutMinutes) as any[];
    return rows.map((row) => DownloadItem.fromDatabase(row));
  }

  /**
   * Counts all downloads.
   * 
   * SQL: `SELECT COUNT(*) as count FROM downloads`
   * 
   * @returns Total number of downloads
   * 
   * @example
   * ```typescript
   * const total = await repo.countAll();
   * // Returns: 150
   * ```
   */
  async countAll(): Promise<number> {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM downloads");
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Counts downloads by status.
   * 
   * SQL: `SELECT COUNT(*) as count FROM downloads WHERE status = ?`
   * 
   * @param status - Status to count
   * @returns Number of downloads with given status
   * 
   * @example
   * ```typescript
   * const pendingCount = await repo.countByStatus('pending');
   * // Returns: 5
   * ```
   */
  async countByStatus(status: DownloadStatus): Promise<number> {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM downloads WHERE status = ?");
    const result = stmt.get(status) as { count: number };
    return result.count;
  }

  /**
   * Creates a new download record.
   * 
   * SQL:
   * ```sql
   * INSERT INTO downloads (
   *   url, normalized_url, media_id, status, progress, error_message, file_path, process_id
   * ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
   * ```
   * 
   * Timestamps (created_at, started_at, finished_at) are set by database defaults.
   * created_at defaults to current timestamp.
   * 
   * @param download - Download data to create
   * @returns Created download with generated ID
   * @throws Error if creation fails or record cannot be retrieved
   * 
   * @example
   * ```typescript
   * const download = await repo.create({
   *   url: 'https://music.youtube.com/watch?v=abc123',
   *   normalizedUrl: 'https://music.youtube.com/watch?v=abc123',
   *   mediaId: null,
   *   status: 'pending',
   *   progress: 0,
   *   errorMessage: null,
   *   filePath: null,
   *   processId: null
   * });
   * // Returns: DownloadItem { id: 42, createdAt: 2024-01-15T10:30:00Z, ... }
   * ```
   */
  async create(download: CreateDownloadData): Promise<DownloadItem> {
    const stmt = this.db.prepare(`
      INSERT INTO downloads (
        url, normalized_url, media_id, status, progress, error_message, file_path, process_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      download.url,
      download.normalizedUrl,
      download.mediaId,
      download.status,
      download.progress,
      download.errorMessage,
      download.filePath,
      download.processId
    );

    const id = Number(result.lastInsertRowid);
    const created = await this.findById(id);

    if (!created) {
      throw new Error("Failed to create download");
    }

    return created;
  }

  /**
   * Updates download status, progress, and error message.
   * 
   * SQL (dynamic based on parameters):
   * ```sql
   * UPDATE downloads
   * SET status = ?, progress = ?, error_message = ?
   *     [, file_path = ?]           -- if filePath provided
   *     [, finished_at = datetime('now')]  -- if terminal status
   * WHERE id = ?
   * ```
   * 
   * Automatically sets finished_at for terminal statuses (completed/failed/cancelled).
   * Optionally updates file_path if provided.
   * 
   * @param id - Download ID
   * @param status - New status
   * @param progress - Progress percentage (0-100)
   * @param errorMessage - Error message (null if no error)
   * @param filePath - Optional file path to update
   * 
   * @example
   * ```typescript
   * // Update to in_progress with 50% progress
   * await repo.updateStatus(42, 'in_progress', 50, null);
   * 
   * // Complete download with file path
   * await repo.updateStatus(
   *   42,
   *   'completed',
   *   100,
   *   null,
   *   '/tmp/downloads/Artist/Album/01 Track.mp3'
   * );
   * // Sets finished_at = current timestamp
   * 
   * // Mark as failed with error
   * await repo.updateStatus(
   *   43,
   *   'failed',
   *   75,
   *   'Download failed with exit code 1: ERROR: Video unavailable'
   * );
   * // Sets finished_at = current timestamp
   * ```
   */
  async updateStatus(
    id: number,
    status: DownloadStatus,
    progress: number,
    errorMessage: string | null,
    filePath?: string | null
  ): Promise<void> {
    const updates: string[] = ["status = ?", "progress = ?", "error_message = ?"];
    const values: any[] = [status, progress, errorMessage];

    if (filePath !== undefined) {
      updates.push("file_path = ?");
      values.push(filePath);
    }

    if (status === "completed" || status === "failed" || status === "cancelled") {
      updates.push("finished_at = datetime('now')");
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE downloads
      SET ${updates.join(", ")}
      WHERE id = ?
    `);

    stmt.run(...values);
  }

  /**
   * Updates process ID and sets started_at timestamp.
   * 
   * SQL:
   * ```sql
   * UPDATE downloads
   * SET process_id = ?, started_at = datetime('now')
   * WHERE id = ?
   * ```
   * 
   * Called when download execution begins. Process ID used for cancellation.
   * 
   * @param id - Download ID
   * @param processId - yt-dlp process ID
   * 
   * @example
   * ```typescript
   * await repo.updateProcessId(42, 12345);
   * // Sets process_id = 12345, started_at = current timestamp
   * ```
   */
  async updateProcessId(id: number, processId: number): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE downloads
      SET process_id = ?, started_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(processId, id);
  }

  /**
   * Links a download to media metadata.
   * 
   * SQL:
   * ```sql
   * UPDATE downloads
   * SET media_id = ?
   * WHERE id = ?
   * ```
   * 
   * Called after metadata extraction to associate download with MediaItem.
   * 
   * @param id - Download ID
   * @param mediaId - Media ID to link
   * 
   * @example
   * ```typescript
   * await repo.updateMediaId(42, 100);
   * // Links download 42 to media 100
   * ```
   */
  async updateMediaId(id: number, mediaId: number): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE downloads
      SET media_id = ?
      WHERE id = ?
    `);
    stmt.run(mediaId, id);
  }

  /**
   * Deletes a download by ID.
   * 
   * SQL: `DELETE FROM downloads WHERE id = ?`
   * 
   * Used by cleanup jobs. Does not cascade delete associated files.
   * 
   * @param id - Download ID to delete
   * 
   * @example
   * ```typescript
   * await repo.delete(42);
   * // Removes download record from database
   * ```
   */
  async delete(id: number): Promise<void> {
    const stmt = this.db.prepare("DELETE FROM downloads WHERE id = ?");
    stmt.run(id);
  }

  /**
   * Deletes all downloads.
   * 
   * SQL: `DELETE FROM downloads`
   * 
   * Dangerous operation - removes all download records.
   * Use with caution (typically only for testing).
   * 
   * @example
   * ```typescript
   * await repo.deleteAll();
   * // Removes all download records from database
   * ```
   */
  async deleteAll(): Promise<void> {
    const stmt = this.db.prepare("DELETE FROM downloads");
    stmt.run();
  }
}
