import { MediaRepository } from '@/core/domain/media/repositories/media-repository';
import { DownloadRepository } from '@/core/domain/download/repositories/download-repository';
import { DownloadLogRepository } from '@/core/domain/download/repositories/download-log-repository';
import { UrlNormalizer } from '../services/UrlNormalizer';
import { PlatformDetector } from '../services/PlatformDetector';
import { MetadataExtractor } from '../services/MetadataExtractor';
import { MediaItem } from '@/core/domain/media/entities/media';
import type { PinoLogger } from 'hono-pino';

/**
 * Result of enqueueing a download.
 */
interface EnqueueResult {
  /** ID of the created download */
  downloadId: number;
  /** ID of linked media (null if not linked yet) */
  mediaId: number | null;
  /** Original URL */
  url: string;
  /** Current status (always 'pending' for new downloads) */
  status: string;
}

/**
 * Use case for enqueueing a new download request.
 *
 * Application layer - Orchestration of domain entities and services.
 *
 * This use case handles the complete flow of adding a download to the queue:
 * 1. URL normalization to prevent duplicates
 * 2. Platform validation (Bandcamp/YouTube Music only)
 * 3. Duplicate detection by normalized URL
 * 4. Queue limit enforcement (max 10 pending downloads)
 * 5. Download record creation
 * 6. Event emission for SSE notifications
 * 7. Asynchronous metadata extraction and linking
 *
 * Business rules:
 * - Only Bandcamp track/album and YouTube Music watch/playlist URLs allowed
 * - Prevents duplicate downloads by normalized URL
 * - Enforces maximum pending download limit
 * - Metadata extraction happens asynchronously and doesn't block enqueue
 *
 * @see {@link DownloadRepository} for persistence operations
 * @see {@link UrlNormalizer} for URL normalization
 * @see {@link PlatformDetector} for platform validation
 */
export class EnqueueDownload {
  /**
   * Creates a new EnqueueDownload use case.
   *
   * @param downloadRepo - Repository for download persistence
   * @param mediaRepo - Repository for media persistence
   * @param urlNormalizer - Service for URL normalization
   * @param platformDetector - Service for platform validation
   * @param metadataExtractor - Service for extracting media metadata
   * @param downloadLogRepo - Repository for logging download events
   * @param logger - Logger for structured logging
   * @param maxPending - Maximum number of pending downloads allowed (default: 10)
   */
  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly mediaRepo: MediaRepository,
    private readonly urlNormalizer: UrlNormalizer,
    private readonly platformDetector: PlatformDetector,
    private readonly metadataExtractor: MetadataExtractor,
    private readonly downloadLogRepo: DownloadLogRepository,
    private readonly logger: PinoLogger,
    private readonly maxPending: number = 10
  ) {}

  /**
   * Enqueues a new download for processing.
   *
   * Flow:
   * 1. Normalizes URL to prevent case-sensitive duplicates
   * 2. Validates URL is from supported platform
   * 3. Checks for existing active download with same normalized URL
   * 4. Checks pending queue limit
   * 5. Creates download record in 'pending' status
   * 6. Emits 'download:enqueued' event for SSE
   * 7. Asynchronously extracts and links metadata (non-blocking)
   *
   * @param url - URL to download (Bandcamp or YouTube Music)
   * @returns Download details including ID and status
   * @throws Error with HTTP 400 if URL is invalid or unsupported platform
   * @throws Error with HTTP 409 if duplicate active download exists
   * @throws Error with HTTP 429 if maximum pending downloads reached
   *
   * @example
   * ```typescript
   * const enqueue = new EnqueueDownload(
   *   downloadRepo,
   *   mediaRepo,
   *   urlNormalizer,
   *   platformDetector,
   *   metadataExtractor,
   *   eventEmitter,
   *   logger
   * );
   *
   * // Enqueue a Bandcamp album
   * const result = await enqueue.execute(
   *   'https://artist.bandcamp.com/album/album-name'
   * );
   * // Returns: {
   * //   downloadId: 42,
   * //   mediaId: null,  // Will be linked after metadata extraction
   * //   url: 'https://artist.bandcamp.com/album/album-name',
   * //   status: 'pending'
   * // }
   *
   * // Enqueue YouTube Music playlist
   * const result2 = await enqueue.execute(
   *   'https://music.youtube.com/playlist?list=abc123'
   * );
   * ```
   */
  async execute(url: string): Promise<EnqueueResult> {
    // Normalize URL
    const normalizedUrl = this.urlNormalizer.normalize(url);

    // Validate URL and get provider
    const provider = this.platformDetector.validateOrThrow(url);

    // Check for duplicate active downloads
    const existingDownload = await this.downloadRepo.findActiveByNormalizedUrl(normalizedUrl);
    if (existingDownload) {
      throw new Error('A download for this URL is already pending or in progress');
    }

    // Check pending limit
    const pendingCount = await this.downloadRepo.countByStatus('pending');
    if (pendingCount >= this.maxPending) {
      throw new Error(`Maximum ${this.maxPending} pending downloads reached`);
    }

    // Create download record
    const download = await this.downloadRepo.create({
      url,
      normalizedUrl,
      mediaId: null,
      status: 'pending',
      progress: 0,
      errorMessage: null,
      filePath: null,
      processId: null
    });

    this.logger.info({ downloadId: download.id, url }, 'Download enqueued');

    // Log enqueued event
    await this.downloadLogRepo.create({
      downloadId: download.id,
      eventType: 'download:enqueued',
      message: `Download enqueued: ${url}`,
      metadata: { url, provider }
    });

    // Extract metadata asynchronously (don't await)
    this.extractAndLinkMetadata(download.id, url, provider).catch((error) => {
      this.logger.warn({ error, downloadId: download.id }, 'Failed to extract metadata');
    });

    return {
      downloadId: download.id,
      mediaId: download.mediaId,
      url: download.url,
      status: download.status
    };
  }

  /**
   * Extracts metadata from URL and links it to the download (private helper).
   *
   * This runs asynchronously after the download is enqueued, so it doesn't
   * block the API response. If metadata extraction fails, the download
   * continues without media link.
   *
   * Flow:
   * 1. Extracts metadata using yt-dlp
   * 2. Searches for existing media by provider ID
   * 3. Creates new media if not found (allows null fields)
   * 4. Links media to download if still in 'pending' status
   *
   * @param downloadId - Download to link media to
   * @param url - URL to extract metadata from
   * @param provider - Platform provider (bandcamp or youtube)
   */
  private async extractAndLinkMetadata(
    downloadId: number,
    url: string,
    provider: 'youtube' | 'bandcamp'
  ): Promise<void> {
    try {
      // Log metadata fetching
      await this.downloadLogRepo.create({
        downloadId,
        eventType: 'metadata:fetching',
        message: `Fetching metadata from ${provider}`,
        metadata: { provider, url }
      });

      // Extract metadata
      const metadata = await this.metadataExtractor.extract(url, provider);

      // Try to find existing media by provider ID
      let media: MediaItem | null = null;
      if (metadata.id) {
        media = await this.mediaRepo.findByProviderAndProviderId(provider, metadata.id);
      }

      // Create media if doesn't exist
      if (!media) {
        media = await this.mediaRepo.create(MediaItem.fromYtDlpMetadata(metadata, provider));
        this.logger.info({ metadata }, 'Metadata extracted');
        this.logger.info({ mediaId: media.id, title: media.title }, 'Media created');

        // Log metadata found
        const isPlaylist = metadata._type === 'playlist';
        const trackCount = metadata.entries ? metadata.entries.length : 1;
        await this.downloadLogRepo.create({
          downloadId,
          eventType: 'metadata:found',
          message: isPlaylist
            ? `Found ${trackCount} tracks in album "${metadata.title || 'Unknown'}"`
            : `Found track "${metadata.title || 'Unknown'}"`,
          metadata: {
            title: metadata.title,
            artist: metadata.artist || metadata.uploader,
            trackCount,
            isPlaylist
          }
        });
      }

      // Update download with media_id
      const download = await this.downloadRepo.findById(downloadId);
      if (download && download.status === 'pending' && media.id !== null) {
        await this.downloadRepo.updateMediaId(downloadId, media.id);
      }
    } catch (error) {
      this.logger.warn(
        { error, downloadId },
        'Metadata extraction failed, continuing without media link'
      );
    }
  }
}
