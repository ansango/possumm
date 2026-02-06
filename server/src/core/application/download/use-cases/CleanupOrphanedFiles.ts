import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import { MediaRepository } from "@/core/domain/media/repositories/media-repository";
import type { PinoLogger } from "hono-pino";
import { rm } from "fs/promises";
import { exists } from "fs/promises";

interface CleanupResult {
  downloadsDeleted: number;
  mediaDeleted: number;
  filesDeleted: number;
}

export class CleanupOrphanedFiles {
  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly mediaRepo: MediaRepository,
    private readonly logger: PinoLogger,
    private readonly retentionDays: number = 7
  ) {}

  async execute(): Promise<CleanupResult> {
    let downloadsDeleted = 0;
    let mediaDeleted = 0;
    let filesDeleted = 0;

    try {
      // Find old completed downloads
      const oldDownloads = await this.downloadRepo.findOldCompleted(this.retentionDays);
      
      this.logger.info({ count: oldDownloads.length, days: this.retentionDays }, "Found old downloads to clean");

      for (const download of oldDownloads) {
        try {
          // Delete file if exists
          if (download.filePath) {
            const fileExists = await exists(download.filePath);
            if (fileExists) {
              await rm(download.filePath, { recursive: true, force: true });
              filesDeleted++;
              this.logger.debug({ path: download.filePath }, "File deleted");
            }
          }

          // Delete download record
          await this.downloadRepo.delete(download.id!);
          downloadsDeleted++;
        } catch (error) {
          this.logger.warn({ error, downloadId: download.id }, "Failed to cleanup download");
        }
      }

      // Find orphaned media (no associated downloads)
      // This is a simple implementation - could be optimized with a SQL query
      const allMedia = await this.mediaRepo.findAll(0, 1000);
      
      for (const media of allMedia) {
        if (media.id === null) continue;

        const associatedDownloads = await this.downloadRepo.findAll(0, 1);
        const hasDownloads = associatedDownloads.some(d => d.mediaId === media.id);

        if (!hasDownloads) {
          try {
            await this.mediaRepo.delete(media.id);
            mediaDeleted++;
            this.logger.debug({ mediaId: media.id }, "Orphaned media deleted");
          } catch (error) {
            this.logger.warn({ error, mediaId: media.id }, "Failed to delete orphaned media");
          }
        }
      }

      this.logger.info(
        { downloadsDeleted, mediaDeleted, filesDeleted },
        "Cleanup completed"
      );

      return { downloadsDeleted, mediaDeleted, filesDeleted };
    } catch (error) {
      this.logger.error({ error }, "Cleanup failed");
      throw error;
    }
  }
}
