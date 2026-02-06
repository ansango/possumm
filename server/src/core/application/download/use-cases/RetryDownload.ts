import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import { DownloadEventEmitter } from "@/core/infrastructure/events/DownloadEventEmitter";
import type { PinoLogger } from "hono-pino";

export class RetryDownload {
  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly eventEmitter: DownloadEventEmitter,
    private readonly logger: PinoLogger
  ) {}

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
