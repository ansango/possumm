import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import { DownloadExecutor } from "../services/DownloadExecutor";
import { DownloadLogRepository } from "@/core/domain/download/repositories/download-log-repository";
import type { PinoLogger } from "hono-pino";

/**
 * Use case for cancelling a download.
 * 
 * Application layer - Handles download cancellation with process termination.
 * Cancels active yt-dlp process if running, updates status, and cleans up
 * progress throttle state.
 * 
 * Can only cancel downloads in pending or in_progress status.
 * Completed/failed downloads cannot be cancelled.
 */
export class CancelDownload {
  /**
   * Creates a new CancelDownload use case.
   * 
   * @param downloadRepo - Download repository for status updates
   * @param downloadExecutor - Executor for process termination
   * @param downloadLogRepo - Repository for logging download events
   * @param logger - Logger for structured logging
   */
  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly downloadExecutor: DownloadExecutor,
    private readonly downloadLogRepo: DownloadLogRepository,
    private readonly logger: PinoLogger
  ) {}

  /**
   * Cancels a download.
   * 
   * Flow:
   * 1. Loads download from repository
   * 2. Validates status is pending or in_progress
   * 3. If in_progress with processId, terminates yt-dlp process
   * 4. Updates status to cancelled with error message
   * 5. Emits cancelled event
   * 6. Clears progress throttle state
   * 
   * Process termination is done via SIGKILL to ensure cleanup.
   * 
   * @param downloadId - Download ID to cancel
   * @throws Error if download not found (HTTP 404)
   * @throws Error if download status is completed/failed (HTTP 400)
   * 
   * @example
   * ```typescript
   * const cancelDownload = new CancelDownload(
   *   downloadRepo,
   *   downloadExecutor,
   *   eventEmitter,
   *   logger
   * );
   * 
   * // Cancel pending download
   * await cancelDownload.execute(42);
   * // Updates status to 'cancelled', no process to kill
   * 
   * // Cancel in-progress download
   * await cancelDownload.execute(43);
   * // Kills process 12345, updates status to 'cancelled'
   * 
   * // Error: cannot cancel completed download
   * try {
   *   await cancelDownload.execute(44); // status = 'completed'
   * } catch (error) {
   *   // Error: Cannot cancel download 44 with status: completed
   * }
   * ```
   * 
   * @see DownloadExecutor.cancel - For process termination
   */
  async execute(downloadId: number): Promise<void> {
    const download = await this.downloadRepo.findById(downloadId);
    if (!download) {
      throw new Error(`Download ${downloadId} not found`);
    }

    if (download.status !== "pending" && download.status !== "in_progress") {
      throw new Error(`Cannot cancel download ${downloadId} with status: ${download.status}`);
    }

    try {
      // Cancel active process if exists
      if (download.processId && download.status === "in_progress") {
        this.downloadExecutor.cancel(download.processId);
      }

      // Update status to cancelled
      await this.downloadRepo.updateStatus(
        downloadId,
        "cancelled",
        download.progress,
        "Cancelled by user"
      );

      this.logger.info({ downloadId }, "Download cancelled");
      
      // Log cancellation
      await this.downloadLogRepo.create({
        downloadId,
        eventType: "download:cancelled",
        message: "Download cancelled by user",
        metadata: { url: download.url },
      });
    } catch (error) {
      this.logger.error({ error, downloadId }, "Failed to cancel download");
      throw error;
    }
  }
}
