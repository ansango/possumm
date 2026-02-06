import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import { DownloadStatus } from "@/core/domain/download/entities/download";
import type { PinoLogger } from "hono-pino";

/**
 * Result structure for paginated download listing.
 * 
 * Includes download array and pagination metadata.
 */
interface ListDownloadsResult {
  /** Array of downloads for current page */
  downloads: Array<{
    id: number;
    url: string;
    status: string;
    progress: number;
    errorMessage: string | null;
    filePath: string | null;
    createdAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
  }>;
  /** Total count of downloads matching filter */
  total: number;
  /** Current page number (0-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
}

/**
 * Use case for listing downloads with optional status filter.
 * 
 * Application layer - Query use case for download collection retrieval.
 * Supports pagination and optional status filtering.
 * 
 * Used by API handlers to display download lists in UI.
 */
export class ListDownloads {
  /**
   * Creates a new ListDownloads use case.
   * 
   * @param downloadRepo - Download repository for retrieval
   * @param logger - Logger for structured logging
   */
  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly logger: PinoLogger
  ) {}

  /**
   * Lists downloads with optional status filter and pagination.
   * 
   * Flow:
   * 1. If status provided, calls findByStatus + countByStatus
   * 2. Otherwise calls findAll + countAll
   * 3. Maps download entities to response format
   * 4. Returns paginated result with total count
   * 
   * Pagination is 0-based. Default page size is 20.
   * 
   * @param status - Optional status filter (pending/in_progress/completed/failed/cancelled)
   * @param page - Page number (0-based), default 0
   * @param pageSize - Items per page, default 20
   * @returns Paginated list of downloads with total count
   * 
   * @example
   * ```typescript
   * const listDownloads = new ListDownloads(downloadRepo, logger);
   * 
   * // List all downloads (first page)
   * const all = await listDownloads.execute();
   * // Returns: {
   * //   downloads: [
   * //     { id: 1, url: '...', status: 'completed', ... },
   * //     { id: 2, url: '...', status: 'pending', ... },
   * //     // ... 18 more items ...
   * //   ],
   * //   total: 150,
   * //   page: 0,
   * //   pageSize: 20
   * // }
   * 
   * // List only pending downloads (second page)
   * const pending = await listDownloads.execute('pending', 1, 10);
   * // Returns: {
   * //   downloads: [
   * //     { id: 15, url: '...', status: 'pending', progress: 0, ... },
   * //     // ... 9 more pending items ...
   * //   ],
   * //   total: 25,  // Total pending downloads
   * //   page: 1,    // Second page (0-based)
   * //   pageSize: 10
   * // }
   * 
   * // List failed downloads
   * const failed = await listDownloads.execute('failed');
   * // Returns: {
   * //   downloads: [
   * //     {
   * //       id: 99,
   * //       url: 'https://...',
   * //       status: 'failed',
   * //       errorMessage: 'Download failed with exit code 1: ...',
   * //       ...
   * //     }
   * //   ],
   * //   total: 5,
   * //   page: 0,
   * //   pageSize: 20
   * // }
   * ```
   * 
   * @see DownloadRepository.findByStatus - For status-filtered queries
   * @see DownloadRepository.findAll - For unfiltered queries
   */
  async execute(
    status?: DownloadStatus,
    page: number = 0,
    pageSize: number = 20
  ): Promise<ListDownloadsResult> {
    const downloads = status
      ? await this.downloadRepo.findByStatus(status, page, pageSize)
      : await this.downloadRepo.findAll(page, pageSize);

    const total = status
      ? await this.downloadRepo.countByStatus(status)
      : await this.downloadRepo.countAll();

    return {
      downloads: downloads.map((d) => ({
        id: d.id!,
        url: d.url,
        status: d.status,
        progress: d.progress,
        errorMessage: d.errorMessage,
        filePath: d.filePath,
        createdAt: d.createdAt,
        startedAt: d.startedAt,
        finishedAt: d.finishedAt,
      })),
      total,
      page,
      pageSize,
    };
  }
}
