import { DownloadLogRepository } from '@/core/domain/download/repositories/download-log-repository';
import { DownloadRepository } from '@/core/domain/download/repositories/download-repository';
import { DownloadLog } from '@/core/domain/download/entities/download-log';
import type { PinoLogger } from 'hono-pino';

/**
 * Use case for retrieving download logs.
 *
 * Application layer - Retrieves paginated logs for a specific download.
 *
 * Returns logs ordered by timestamp DESC (newest first) with pagination support.
 * Validates download existence before returning logs.
 */
export class GetDownloadLogs {
  /**
   * Creates a new GetDownloadLogs use case.
   *
   * @param downloadLogRepo - Repository for log queries
   * @param downloadRepo - Repository for download validation
   * @param logger - Logger for structured logging
   */
  constructor(
    private readonly downloadLogRepo: DownloadLogRepository,
    private readonly downloadRepo: DownloadRepository,
    private readonly logger: PinoLogger
  ) {}

  /**
   * Retrieves logs for a download with pagination.
   *
   * Flow:
   * 1. Validates download exists
   * 2. Counts total logs for the download
   * 3. Retrieves paginated logs ordered by timestamp DESC
   * 4. Returns logs with pagination metadata
   *
   * @param downloadId - Download ID to retrieve logs for
   * @param page - Page number (1-indexed, default: 1)
   * @param limit - Results per page (default: 50, max: 100)
   * @returns Object with logs array and pagination metadata
   * @throws Error if download not found
   *
   * @example
   * ```typescript
   * const getLogs = new GetDownloadLogs(downloadLogRepo, downloadRepo, logger);
   *
   * // Get first page of logs
   * const result = await getLogs.execute(42);
   * // Returns: {
   * //   logs: [
   * //     { eventType: 'download:completed', message: '...', timestamp: '...' },
   * //     { eventType: 'download:progress', message: 'Download progress: 95%', ... },
   * //     ...
   * //   ],
   * //   pagination: { page: 1, limit: 50, total: 120, totalPages: 3 }
   * // }
   *
   * // Get second page with custom limit
   * const result2 = await getLogs.execute(42, 2, 20);
   * // Returns logs 21-40
   * ```
   */
  async execute(
    downloadId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    logs: DownloadLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    // Validate download exists
    const download = await this.downloadRepo.findById(downloadId);
    if (!download) {
      throw new Error(`Download ${downloadId} not found`);
    }

    // Validate and normalize pagination params
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(100, Math.max(1, limit));

    // Get total count
    const total = await this.downloadLogRepo.countByDownloadId(downloadId);

    // Calculate pagination
    const totalPages = Math.ceil(total / normalizedLimit);
    const pageIndex = normalizedPage - 1; // Convert to 0-indexed

    // Get logs (repository expects: downloadId, page, pageSize)
    const logs = await this.downloadLogRepo.findByDownloadId(
      downloadId,
      pageIndex,
      normalizedLimit
    );

    this.logger.debug(
      { downloadId, page: normalizedPage, limit: normalizedLimit, total },
      'Retrieved download logs'
    );

    return {
      logs,
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages
      }
    };
  }
}
