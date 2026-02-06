import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import { MediaRepository } from "@/core/domain/media/repositories/media-repository";
import { DownloadExecutor } from "../services/DownloadExecutor";
import { StorageService } from "../services/StorageService";
import { MetadataExtractor } from "../services/MetadataExtractor";
import { DownloadEventEmitter } from "@/core/infrastructure/events/DownloadEventEmitter";
import { MediaItem } from "@/core/domain/media/entities/media";
import type { PinoLogger } from "hono-pino";
import { join } from "path";

export class ProcessDownload {
  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly mediaRepo: MediaRepository,
    private readonly downloadExecutor: DownloadExecutor,
    private readonly storageService: StorageService,
    private readonly metadataExtractor: MetadataExtractor,
    private readonly eventEmitter: DownloadEventEmitter,
    private readonly logger: PinoLogger,
    private readonly tempDir: string,
    private readonly minStorageGB: number
  ) {}

  async execute(downloadId: number): Promise<void> {
    const download = await this.downloadRepo.findById(downloadId);
    if (!download) {
      throw new Error(`Download ${downloadId} not found`);
    }

    if (download.status !== "pending") {
      throw new Error(`Download ${downloadId} is not pending (status: ${download.status})`);
    }

    try {
      // Check storage space
      const hasSpace = await this.storageService.hasEnoughSpace(this.tempDir, this.minStorageGB);
      if (!hasSpace) {
        const available = await this.storageService.checkAvailableSpace(this.tempDir);
        this.eventEmitter.emitWithId("storage:low", { 
          availableGB: available / (1024 ** 3), 
          requiredGB: this.minStorageGB 
        });
        throw new Error(`Insufficient storage space. Required: ${this.minStorageGB}GB`);
      }

      // Update status to in_progress
      await this.downloadRepo.updateStatus(downloadId, "in_progress", 0, null);
      this.eventEmitter.emitWithId("download:started", {
        downloadId,
        url: download.url,
        status: "in_progress",
      });

      // Determine provider
      const provider = download.url.includes("bandcamp.com") ? "bandcamp" : "youtube";

      // Execute download
      const result = await this.downloadExecutor.execute(
        download.url,
        provider,
        (progress: number) => {
          // Update progress in database
          this.downloadRepo.updateStatus(downloadId, "in_progress", progress, null).catch((err) => {
            this.logger.warn({ error: err, downloadId }, "Failed to update progress");
          });

          // Emit progress event (throttled by event emitter)
          this.eventEmitter.emitProgress(downloadId, progress, download.url);
        }
      );

      // Store process ID
      if (result.processId) {
        await this.downloadRepo.updateProcessId(downloadId, result.processId);
      }

      // Extract metadata if not already linked
      if (!download.mediaId && result.filePath) {
        await this.extractAndLinkMetadata(downloadId, download.url, result.filePath);
      }

      // Update status to completed
      await this.downloadRepo.updateStatus(
        downloadId,
        "completed",
        100,
        null,
        result.filePath
      );

      this.logger.info({ downloadId, filePath: result.filePath }, "Download completed");
      this.eventEmitter.emitWithId("download:completed", {
        downloadId,
        url: download.url,
        status: "completed",
        filePath: result.filePath,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      await this.downloadRepo.updateStatus(
        downloadId,
        "failed",
        download.progress,
        errorMessage
      );

      this.logger.error({ error, downloadId }, "Download failed");
      this.eventEmitter.emitWithId("download:failed", {
        downloadId,
        url: download.url,
        status: "failed",
        error: errorMessage,
      });

      throw error;
    }
  }

  private async extractAndLinkMetadata(
    downloadId: number,
    url: string,
    filePath: string
  ): Promise<void> {
    try {
      // Determine provider from URL
      const provider = url.includes("bandcamp.com") ? "bandcamp" : "youtube";

      // Extract metadata
      const metadata = await this.metadataExtractor.extract(url, provider);

      // Try to find existing media by provider ID
      let media: MediaItem | null = null;
      if (metadata.id) {
        media = await this.mediaRepo.findByProviderAndProviderId(provider, metadata.id);
      }

      // Create media if doesn't exist
      if (!media) {
        media = await this.mediaRepo.create(
          MediaItem.fromYtDlpMetadata(metadata, provider)
        );
        this.logger.info({ mediaId: media.id, title: media.title }, "Media created from download");
      }

      // Link media to download
      if (media.id !== null) {
        await this.downloadRepo.updateMediaId(downloadId, media.id);
      }
    } catch (error) {
      this.logger.warn({ error, downloadId }, "Failed to extract and link metadata");
    }
  }
}
