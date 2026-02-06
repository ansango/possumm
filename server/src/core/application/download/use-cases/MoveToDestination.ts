import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import type { PinoLogger } from "hono-pino";
import { rename, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { exists } from "fs/promises";

export class MoveToDestination {
  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly logger: PinoLogger,
    private readonly destDir: string
  ) {}

  async execute(downloadId: number): Promise<string> {
    const download = await this.downloadRepo.findById(downloadId);
    if (!download) {
      throw new Error(`Download ${downloadId} not found`);
    }

    if (download.status !== "completed") {
      throw new Error(`Download ${downloadId} is not completed (status: ${download.status})`);
    }

    if (!download.filePath) {
      throw new Error(`Download ${downloadId} has no file path`);
    }

    try {
      // Check if source exists
      const sourceExists = await exists(download.filePath);
      if (!sourceExists) {
        throw new Error(`Source file not found: ${download.filePath}`);
      }

      // Get relative path from temp directory
      // Assuming filePath is the temp directory, we need to construct full destination
      const destPath = join(this.destDir, download.filePath);
      
      // Create destination directory if needed
      const destDirPath = dirname(destPath);
      await mkdir(destDirPath, { recursive: true });

      // Move file
      await rename(download.filePath, destPath);

      // Update database with new path
      await this.downloadRepo.updateStatus(
        downloadId,
        "completed",
        100,
        null,
        destPath
      );

      this.logger.info({ downloadId, from: download.filePath, to: destPath }, "File moved to destination");
      
      return destPath;
    } catch (error) {
      this.logger.error({ error, downloadId }, "Failed to move file");
      throw error;
    }
  }
}
