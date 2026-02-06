import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import { DownloadExecutor } from "../services/DownloadExecutor";
import { DownloadEventEmitter } from "@/core/infrastructure/events/DownloadEventEmitter";
import type { PinoLogger } from "hono-pino";

export class CancelDownload {
  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly downloadExecutor: DownloadExecutor,
    private readonly eventEmitter: DownloadEventEmitter,
    private readonly logger: PinoLogger
  ) {}

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
      this.eventEmitter.emitWithId("download:cancelled", {
        downloadId,
        url: download.url,
        status: "cancelled",
      });

      // Clear progress throttle for this download
      this.eventEmitter.clearProgressThrottle(downloadId);
    } catch (error) {
      this.logger.error({ error, downloadId }, "Failed to cancel download");
      throw error;
    }
  }
}
