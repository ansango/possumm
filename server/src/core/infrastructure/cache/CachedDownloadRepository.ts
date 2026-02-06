import { DownloadRepository, CreateDownloadData } from "@/core/domain/download/repositories/download-repository";
import { DownloadItem, DownloadStatus } from "@/core/domain/download/entities/download";
import { withCache } from "@/lib/db/cache/utils";

/**
 * Caching decorator for DownloadRepository.
 * 
 * Infrastructure layer - Adds caching layer using Decorator pattern.
 * Wraps any DownloadRepository implementation with automatic caching.
 * 
 * Caching strategy:
 * - Read operations: Cached with 30-second TTL
 * - Write operations: No caching (pass-through)
 * - Real-time queries: No caching (findNextPending, cleanup queries)
 * 
 * Cache keys follow pattern:
 * - `downloads:{id}` - Individual download
 * - `downloads:active-url:{normalizedUrl}` - Active download by URL
 * - `downloads:list:{page}:{pageSize}[:{status}]` - Paginated lists
 * - `downloads:count[:{status}]` - Count queries
 * 
 * Short TTL (30s) ensures relatively fresh data while reducing database load
 * for frequently accessed downloads (progress polling, status checks).
 * 
 * Cache invalidation is implicit via TTL - no manual invalidation on writes.
 * This means cached data may be stale for up to 30 seconds.
 * 
 * @example
 * ```typescript
 * const sqliteRepo = new SQLiteDownloadRepository();
 * const cachedRepo = new CachedDownloadRepository(sqliteRepo);
 * 
 * // First call: cache miss, hits database
 * const download1 = await cachedRepo.findById(42);
 * 
 * // Second call within 30s: cache hit, no database query
 * const download2 = await cachedRepo.findById(42);
 * 
 * // Write operations always hit database
 * await cachedRepo.updateStatus(42, 'completed', 100, null);
 * // Cached entry remains until TTL expires
 * ```
 * 
 * @see withCache - For caching implementation details
 * @see SQLiteDownloadRepository - For underlying implementation
 */
export class CachedDownloadRepository implements DownloadRepository {
  /**
   * Creates a new CachedDownloadRepository decorator.
   * 
   * @param repository - Underlying repository to wrap with caching
   */
  constructor(private readonly repository: DownloadRepository) {}

  /**
   * Finds download by ID with caching.
   * 
   * Cache key: `downloads:{id}`
   * TTL: 30 seconds
   * 
   * @param id - Download ID
   * @returns Cached or fresh download
   */
  async findById(id: number): Promise<DownloadItem | null> {
    return withCache(
      `downloads:${id}`,
      () => this.repository.findById(id),
      30 * 1000 // 30 seconds
    );
  }

  /**
   * Finds next pending download WITHOUT caching.
   * 
   * No caching - must be real-time for worker queue processing.
   * Stale data would cause duplicate processing.
   * 
   * @returns Next pending download
   */
  async findNextPending(): Promise<DownloadItem | null> {
    // Don't cache this, it needs to be real-time
    return this.repository.findNextPending();
  }

  async findActiveByNormalizedUrl(normalizedUrl: string): Promise<DownloadItem | null> {
    return withCache(
      `downloads:active-url:${normalizedUrl}`,
      () => this.repository.findActiveByNormalizedUrl(normalizedUrl),
      30 * 1000
    );
  }

  async findByStatus(
    status: DownloadStatus,
    page: number,
    pageSize: number
  ): Promise<DownloadItem[]> {
    return withCache(
      `downloads:list:${page}:${pageSize}:${status}`,
      () => this.repository.findByStatus(status, page, pageSize),
      30 * 1000
    );
  }

  async findAll(page: number, pageSize: number): Promise<DownloadItem[]> {
    return withCache(
      `downloads:list:${page}:${pageSize}`,
      () => this.repository.findAll(page, pageSize),
      30 * 1000
    );
  }

  async findOldCompleted(days: number): Promise<DownloadItem[]> {
    // Don't cache this
    return this.repository.findOldCompleted(days);
  }

  async findStalledInProgress(timeoutMinutes: number): Promise<DownloadItem[]> {
    // Don't cache this
    return this.repository.findStalledInProgress(timeoutMinutes);
  }

  async countAll(): Promise<number> {
    return withCache(
      "downloads:count",
      () => this.repository.countAll(),
      30 * 1000
    );
  }

  async countByStatus(status: DownloadStatus): Promise<number> {
    return withCache(
      `downloads:count:${status}`,
      () => this.repository.countByStatus(status),
      30 * 1000
    );
  }

  async create(download: CreateDownloadData): Promise<DownloadItem> {
    // No caching for write operations
    return this.repository.create(download);
  }

  async updateStatus(
    id: number,
    status: DownloadStatus,
    progress: number,
    errorMessage: string | null,
    filePath?: string | null
  ): Promise<void> {
    // No caching for write operations
    return this.repository.updateStatus(id, status, progress, errorMessage, filePath);
  }

  async updateProcessId(id: number, processId: number): Promise<void> {
    // No caching for write operations
    return this.repository.updateProcessId(id, processId);
  }

  async updateMediaId(id: number, mediaId: number): Promise<void> {
    // No caching for write operations
    return this.repository.updateMediaId(id, mediaId);
  }

  async delete(id: number): Promise<void> {
    // No caching for write operations
    return this.repository.delete(id);
  }

  async deleteAll(): Promise<void> {
    // No caching for write operations
    return this.repository.deleteAll();
  }
}
