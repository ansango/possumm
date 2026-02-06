import { MediaRepository } from "@/core/domain/media/repositories/media-repository";
import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import { UrlNormalizer } from "../services/UrlNormalizer";
import { PlatformDetector } from "../services/PlatformDetector";
import { MetadataExtractor } from "../services/MetadataExtractor";
import { DownloadEventEmitter } from "@/core/infrastructure/events/DownloadEventEmitter";
import { MediaItem } from "@/core/domain/media/entities/media";
import { DownloadItem } from "@/core/domain/download/entities/download";
import type { PinoLogger } from "hono-pino";

interface EnqueueResult {
  downloadId: number;
  mediaId: number | null;
  url: string;
  status: string;
}

export class EnqueueDownload {
  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly mediaRepo: MediaRepository,
    private readonly urlNormalizer: UrlNormalizer,
    private readonly platformDetector: PlatformDetector,
    private readonly metadataExtractor: MetadataExtractor,
    private readonly eventEmitter: DownloadEventEmitter,
    private readonly logger: PinoLogger,
    private readonly maxPending: number = 10
  ) {}

  async execute(url: string): Promise<EnqueueResult> {
    // Normalize URL
    const normalizedUrl = this.urlNormalizer.normalize(url);

    // Validate URL and get provider
    const provider = this.platformDetector.validateOrThrow(url);

    // Check for duplicate active downloads
    const existingDownload = await this.downloadRepo.findActiveByNormalizedUrl(normalizedUrl);
    if (existingDownload) {
      throw new Error("A download for this URL is already pending or in progress");
    }

    // Check pending limit
    const pendingCount = await this.downloadRepo.countByStatus("pending");
    if (pendingCount >= this.maxPending) {
      throw new Error(`Maximum ${this.maxPending} pending downloads reached`);
    }

    // Create download record
    const download = await this.downloadRepo.create({
      url,
      normalizedUrl,
      mediaId: null,
      status: "pending",
      progress: 0,
      errorMessage: null,
      filePath: null,
      processId: null,
    });

    this.logger.info({ downloadId: download.id, url }, "Download enqueued");

    // Emit enqueued event
    this.eventEmitter.emitWithId("download:enqueued", {
      downloadId: download.id,
      url,
      status: "pending",
    });

    // Extract metadata asynchronously (don't await)
    this.extractAndLinkMetadata(download.id, url, provider).catch((error) => {
      this.logger.warn({ error, downloadId: download.id }, "Failed to extract metadata");
    });

    return {
      downloadId: download.id,
      mediaId: download.mediaId,
      url: download.url,
      status: download.status,
    };
  }

  private async extractAndLinkMetadata(
    downloadId: number,
    url: string,
    provider: "youtube" | "bandcamp"
  ): Promise<void> {
    try {
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
        this.logger.info({ mediaId: media.id, title: media.title }, "Media created");
      }

      // Update download with media_id
      const download = await this.downloadRepo.findById(downloadId);
      if (download && download.status === "pending" && media.id !== null) {
        await this.downloadRepo.updateMediaId(downloadId, media.id);
      }
    } catch (error) {
      this.logger.warn({ error, downloadId }, "Metadata extraction failed, continuing without media link");
    }
  }
}
