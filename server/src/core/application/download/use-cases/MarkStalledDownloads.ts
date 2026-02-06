import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import { DownloadEventEmitter } from "@/core/infrastructure/events/DownloadEventEmitter";
import type { PinoLogger } from "hono-pino";

export class MarkStalledDownloads {
  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly eventEmitter: DownloadEventEmitter,
    private readonly logger: PinoLogger,
    private readonly timeoutMinutes: number = 60
  ) {}

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

          this.eventEmitter.emitWithId("download:stalled", {
            downloadId: download.id!,
            url: download.url,
            status: "failed",
            error: "Download timeout",
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
