import { DownloadLogRepository, CreateDownloadLogData } from "@/core/domain/download/repositories/download-log-repository";
import { DownloadLog } from "@/core/domain/download/entities/download-log";
import { withCache } from "@/lib/db/cache/utils";

/**
 * Cached decorator for DownloadLogRepository.
 * 
 * Infrastructure layer - Adds caching layer to log repository.
 * 
 * Caching strategy:
 * - No cache on writes (create, delete)
 * - 10s cache on read queries (logs update less frequently than downloads)
 */
export class CachedDownloadLogRepository implements DownloadLogRepository {
  constructor(private readonly repository: DownloadLogRepository) {}

  async create(log: CreateDownloadLogData): Promise<void> {
    await this.repository.create(log);
    // Cache invalidation handled by TTL
  }

  async findByDownloadId(downloadId: number, page: number, pageSize: number): Promise<DownloadLog[]> {
    return withCache(
      `download-logs:${downloadId}:${page}:${pageSize}`,
      () => this.repository.findByDownloadId(downloadId, page, pageSize),
      10 * 1000 // 10 seconds - logs update less frequently
    );
  }

  async countByDownloadId(downloadId: number): Promise<number> {
    return withCache(
      `download-logs:${downloadId}:count`,
      () => this.repository.countByDownloadId(downloadId),
      10 * 1000 // 10 seconds - logs update less frequently
    );
  }

  async deleteOldLogs(days: number): Promise<number> {
    const count = await this.repository.deleteOldLogs(days);
    // Cache invalidation handled by TTL
    return count;
  }
}
