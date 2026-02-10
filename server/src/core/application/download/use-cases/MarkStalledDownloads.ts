import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import { DownloadLogRepository } from "@/core/domain/download/repositories/download-log-repository";
import type { PinoLogger } from "hono-pino";

/**
 * Use case for detecting and marking stalled downloads.
 * 
 * Application layer - Scheduled recovery job for stuck downloads.
 * 
 * Detects downloads stuck in in_progress state beyond timeout threshold
 * (typically due to process crashes or kills). Marks them as failed so
 * they can be retried.
 * 
 * Runs with configurable timeout (default 60 minutes).
 * Emits stalled events for monitoring.
 * 
 * Designed to be run periodically (e.g., every 15 minutes).
 */
export class MarkStalledDownloads {
  /**
   * Creates a new MarkStalledDownloads use case.
   * 
   * @param downloadRepo - Download repository for queries and updates
   * @param downloadLogRepo - Repository for logging download events
   * @param logger - Logger for structured logging
   * @param timeoutMinutes - Timeout threshold in minutes (default 60)
   */
  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly downloadLogRepo: DownloadLogRepository,
    private readonly logger: PinoLogger,
    private readonly timeoutMinutes: number = 60
  ) {}

  /**
   * Marks stalled downloads as failed.
   * 
   * Flow:
   * 1. Finds downloads in in_progress state with started_at > timeout
   * 2. For each stalled download:
   *    a. Updates status to failed with timeout message
   *    b. Preserves current progress
   *    c. Emits stalled event for monitoring
   * 3. Returns count of marked downloads
   * 
   * Individual failures are logged and skipped (doesn't halt recovery).
   * Downloads can be retried after being marked as failed.
   * 
   * Timeout is calculated from started_at timestamp, not last progress update.
   * This ensures truly stuck downloads are caught even if making slow progress.
   * 
   * @returns Number of downloads marked as stalled
   * @throws Error if overall check fails (caught and logged internally)
   * 
   * @example
   * ```typescript
   * const markStalled = new MarkStalledDownloads(
   *   downloadRepo,
   *   eventEmitter,
   *   logger,
   *   60 // 60 minute timeout
   * );
   * 
   * // Run stalled check
   * const count = await markStalled.execute();
   * // Returns: 3 (marked 3 stalled downloads as failed)
   * 
   * // Typical cron setup (every 15 minutes)
   * 
   * // Stalled downloads can then be retried:
   * // const retry = new RetryDownload(...);
   * // await retry.execute(42);
   * ```
   * 
   * @see DownloadRepository.findStalledInProgress - For timeout queries
   * @see RetryDownload - For retrying stalled downloads
   */
  async execute(): Promise<number> {
    try {
      const stalledDownloads = await this.downloadRepo.findStalledInProgress(this.timeoutMinutes);
      
      this.logger.info({ count: stalledDownloads.length, timeoutMinutes: this.timeoutMinutes }, "Found stalled downloads");

      for (const download of stalledDownloads) {
        try {
          await this.downloadRepo.updateStatus(
            download.id!,
            "failed",
            download.progress,
            `Download stalled after ${this.timeoutMinutes} minutes`
          );

          // Log stalled event
          await this.downloadLogRepo.create({
            downloadId: download.id!,
            eventType: "download:stalled",
            message: `Download stalled after ${this.timeoutMinutes} minutes of inactivity`,
            metadata: { 
              url: download.url,
              progress: download.progress,
              inactiveMinutes: this.timeoutMinutes,
            },
          });

          this.logger.info({ downloadId: download.id }, "Marked stalled download as failed");
        } catch (error) {
          this.logger.warn({ error, downloadId: download.id }, "Failed to mark download as stalled");
        }
      }

      return stalledDownloads.length;
    } catch (error) {
      this.logger.error({ error }, "Failed to check for stalled downloads");
      throw error;
    }
  }
}
