import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import { DownloadLogRepository } from "@/core/domain/download/repositories/download-log-repository";
import type { PinoLogger } from "hono-pino";

/**
 * Use case for retrying a failed or cancelled download.
 * 
 * Application layer - Resets download state to pending for retry.
 * Resets progress to 0, clears error message and file path, and
 * re-enqueues download for worker processing.
 * 
 * Can only retry downloads in failed or cancelled status.
 * Pending/in_progress/completed downloads cannot be retried.
 */
export class RetryDownload {
  /**
   * Creates a new RetryDownload use case.
   * 
   * @param downloadRepo - Download repository for status updates
   * @param downloadLogRepo - Repository for logging download events
   * @param logger - Logger for structured logging
   */
  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly downloadLogRepo: DownloadLogRepository,
    private readonly logger: PinoLogger
  ) {}

  /**
   * Retries a failed or cancelled download.
   * 
   * Flow:
   * 1. Loads download from repository
   * 2. Validates status is failed or cancelled
   * 3. Resets status to pending with 0% progress
   * 4. Clears error message and file path
   * 5. Emits enqueued event
   * 6. Worker picks up download from queue
   * 
   * Does not preserve previous progress - always starts from 0%.
   * ProcessId is not cleared (harmless, will be overwritten on next execution).
   * 
   * @param downloadId - Download ID to retry
   * @throws Error if download not found (HTTP 404)
   * @throws Error if download status is not failed/cancelled (HTTP 400)
   * 
   * @example
   * ```typescript
   * const retryDownload = new RetryDownload(
   *   downloadRepo,
   *   eventEmitter,
   *   logger
   * );
   * 
   * // Retry failed download
   * await retryDownload.execute(42);
   * // Resets from { status: 'failed', progress: 75, errorMessage: '...' }
   * // to { status: 'pending', progress: 0, errorMessage: null }
   * 
   * // Retry cancelled download
   * await retryDownload.execute(43);
   * // Resets to pending, re-enters queue
   * 
   * // Error: cannot retry pending download
   * try {
   *   await retryDownload.execute(44); // status = 'pending'
   * } catch (error) {
   *   // Error: Cannot retry download 44 with status: pending
   * }
   * ```
   */
  async execute(downloadId: number): Promise<void> {
    const download = await this.downloadRepo.findById(downloadId);
    if (!download) {
      throw new Error(`Download ${downloadId} not found`);
    }

    if (download.status !== "failed" && download.status !== "cancelled") {
      throw new Error(`Cannot retry download ${downloadId} with status: ${download.status}`);
    }

    try {
      // Reset download to pending
      await this.downloadRepo.updateStatus(
        downloadId,
        "pending",
        0,
        null,
        null
      );

      this.logger.info({ downloadId }, "Download reset to pending for retry");
      this.eventEmitter.emitWithId("download:enqueued", {
        downloadId,
        url: download.url,
        status: "pending",
      });
    } catch (error) {
      this.logger.error({ error, downloadId }, "Failed to retry download");
      throw error;
    }
  }
}
