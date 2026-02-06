import { DownloadRepository, CreateDownloadData } from "@/core/domain/download/repositories/download-repository";
import { DownloadItem, DownloadStatus } from "@/core/domain/download/entities/download";
import { withCache } from "@/lib/db/cache/utils";

export class CachedDownloadRepository implements DownloadRepository {
  constructor(private readonly repository: DownloadRepository) {}

  async findById(id: number): Promise<DownloadItem | null> {
    return withCache(
      `downloads:${id}`,
      () => this.repository.findById(id),
      30 * 1000 // 30 seconds
    );
  }

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
