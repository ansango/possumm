import { DownloadRepository } from '@/core/domain/download/repositories/download-repository';
import { MediaRepository } from '@/core/domain/media/repositories/media-repository';
import { DownloadExecutor } from '../services/DownloadExecutor';
import { StorageService } from '../services/StorageService';
import { MetadataExtractor } from '../services/MetadataExtractor';
import { DownloadLogRepository } from '@/core/domain/download/repositories/download-log-repository';
import { MediaItem } from '@/core/domain/media/entities/media';
import type { PinoLogger } from 'hono-pino';

/**
 * Use case for processing a pending download.
 *
 * Application layer - Orchestrates the complete download execution flow.
 * This is the main use case that coordinates all download services to
 * execute downloads from the queue.
 *
 * Execution flow:
 * 1. Validates download is pending
 * 2. Checks available disk space
 * 3. Updates status to in_progress
 * 4. Executes download with progress tracking
 * 5. Extracts and links metadata (if not already linked)
 * 6. Updates status to completed/failed
 * 7. Emits events for SSE consumers
 *
 * Called by DownloadWorker for automated processing of queued downloads.
 */
export class ProcessDownload {
	// Track last logged progress per download for 5% threshold throttling
	private static lastLoggedProgress = new Map<number, number>();

	/**
	 * Creates a new ProcessDownload use case.
	 *
	 * @param downloadRepo - Download repository for persistence
	 * @param mediaRepo - Media repository for metadata
	 * @param downloadExecutor - Service for executing yt-dlp downloads
	 * @param storageService - Service for checking disk space
	 * @param metadataExtractor - Service for extracting metadata
	 * @param downloadLogRepo - Repository for logging download events
	 * @param logger - Logger for structured logging
	 * @param tempDir - Temporary directory for downloads
	 * @param minStorageGB - Minimum required storage space in GB
	 */
	constructor(
		private readonly downloadRepo: DownloadRepository,
		private readonly mediaRepo: MediaRepository,
		private readonly downloadExecutor: DownloadExecutor,
		private readonly storageService: StorageService,
		private readonly metadataExtractor: MetadataExtractor,
		private readonly downloadLogRepo: DownloadLogRepository,
		private readonly logger: PinoLogger,
		private readonly tempDir: string,
		private readonly minStorageGB: number
	) {}

	/**
	 * Processes a pending download through its complete lifecycle.
	 *
	 * Detailed flow:
	 * 1. Load download from repository (validates existence)
	 * 2. Validate status is "pending" (prevents reprocessing)
	 * 3. Check disk space availability (must meet minStorageGB threshold)
	 * 4. Update status to "in_progress" with 0% progress
	 * 5. Emit "download:started" event
	 * 6. Execute download with yt-dlp:
	 *    - Progress callback updates database and emits throttled events
	 *    - Process ID stored for cancellation support
	 * 7. Extract and link metadata (if not already associated):
	 *    - Calls MetadataExtractor to get media info
	 *    - Creates MediaItem or finds existing by provider ID
	 *    - Links media to download via mediaId
	 * 8. Update status to "completed" with 100% and file path
	 * 9. Emit "download:completed" event
	 *
	 * On error:
	 * - Updates status to "failed" with error message
	 * - Emits "download:failed" event
	 * - Re-throws error for worker to handle
	 *
	 * @param downloadId - ID of download to process
	 * @throws Error if download not found (404)
	 * @throws Error if download not pending (409)
	 * @throws Error if insufficient storage space (507)
	 * @throws Error if yt-dlp execution fails
	 *
	 * @example
	 * ```typescript
	 * const processDownload = new ProcessDownload(
	 *   downloadRepo,
	 *   mediaRepo,
	 *   downloadExecutor,
	 *   storageService,
	 *   metadataExtractor,
	 *   eventEmitter,
	 *   logger,
	 *   '/tmp/downloads',
	 *   10 // 10GB minimum
	 * );
	 *
	 * // Process a queued download
	 * await processDownload.execute(42);
	 * // Flow:
	 * // 1. Validates download 42 exists and is pending
	 * // 2. Checks /tmp/downloads has >= 10GB free
	 * // 3. Updates to in_progress, emits download:started
	 * // 4. Executes yt-dlp with progress callbacks
	 * // 5. Extracts metadata and creates/links MediaItem
	 * // 6. Updates to completed, emits download:completed
	 *
	 * // Error: insufficient storage
	 * try {
	 *   await processDownload.execute(43);
	 * } catch (error) {
	 *   // Error: Insufficient storage space. Required: 10GB
	 *   // Event emitted: storage:low with { availableGB: 5.2, requiredGB: 10 }
	 * }
	 *
	 * // Error: download not pending
	 * try {
	 *   await processDownload.execute(44); // Already completed
	 * } catch (error) {
	 *   // Error: Download 44 is not pending (status: completed)
	 * }
	 * ```
	 *
	 * @see DownloadExecutor.execute - For download execution details
	 * @see MetadataExtractor.extract - For metadata extraction
	 * @see StorageService.hasEnoughSpace - For space validation
	 * @see DownloadEventEmitter - For event emission patterns
	 */
	async execute(downloadId: number): Promise<void> {
		const download = await this.downloadRepo.findById(downloadId);
		if (!download) {
			throw new Error(`Download ${downloadId} not found`);
		}

		if (download.status !== 'pending') {
			throw new Error(`Download ${downloadId} is not pending (status: ${download.status})`);
		}

		try {
			// Check storage space
			const hasSpace = await this.storageService.hasEnoughSpace(this.tempDir, this.minStorageGB);
			if (!hasSpace) {
				const available = await this.storageService.checkAvailableSpace(this.tempDir);
				const availableGB = available / 1024 ** 3;

				await this.downloadLogRepo.create({
					downloadId,
					eventType: 'storage:low',
					message: `Insufficient storage: ${availableGB.toFixed(2)}GB available, ${this.minStorageGB}GB required`,
					metadata: { availableGB, requiredGB: this.minStorageGB }
				});

				throw new Error(`Insufficient storage space. Required: ${this.minStorageGB}GB`);
			}

			// Update status to in_progress
			await this.downloadRepo.updateStatus(downloadId, 'in_progress', 0, null);

			await this.downloadLogRepo.create({
				downloadId,
				eventType: 'download:started',
				message: `Starting download: ${download.url}`,
				metadata: { url: download.url }
			});

			// Initialize progress tracking for this download
			ProcessDownload.lastLoggedProgress.set(downloadId, 0);

			// Determine provider
			const provider = download.url.includes('bandcamp.com') ? 'bandcamp' : 'youtube';

			// Execute download
			const result = await this.downloadExecutor.execute(
				download.url,
				provider,
				(progress: number) => {
					// Update progress in database
					this.downloadRepo.updateStatus(downloadId, 'in_progress', progress, null).catch((err) => {
						this.logger.warn({ error: err, downloadId }, 'Failed to update progress');
					});

					// Log progress with 5% throttling
					const lastProgress = ProcessDownload.lastLoggedProgress.get(downloadId) || 0;
					const progressDelta = progress - lastProgress;

					if (progressDelta >= 5 || progress === 100) {
						this.downloadLogRepo
							.create({
								downloadId,
								eventType: 'download:progress',
								message: `Download progress: ${progress}%`,
								metadata: { progress }
							})
							.catch((err) => {
								this.logger.warn({ error: err, downloadId }, 'Failed to log progress');
							});
						ProcessDownload.lastLoggedProgress.set(downloadId, progress);
					}
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
			await this.downloadRepo.updateStatus(downloadId, 'completed', 100, null, result.filePath);

			this.logger.info({ downloadId, filePath: result.filePath }, 'Download completed');

			await this.downloadLogRepo.create({
				downloadId,
				eventType: 'download:completed',
				message: 'Download completed successfully',
				metadata: { filePath: result.filePath }
			});

			// Cleanup progress tracking
			ProcessDownload.lastLoggedProgress.delete(downloadId);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			await this.downloadRepo.updateStatus(downloadId, 'failed', download.progress, errorMessage);

			this.logger.error({ error, downloadId }, 'Download failed');

			await this.downloadLogRepo.create({
				downloadId,
				eventType: 'download:failed',
				message: `Download failed: ${errorMessage}`,
				metadata: { error: errorMessage }
			});

			// Cleanup progress tracking
			ProcessDownload.lastLoggedProgress.delete(downloadId);

			throw error;
		}
	}

	/**
	 * Extracts metadata and links it to a download.
	 *
	 * Private helper called after successful download execution if the
	 * download doesn't already have associated media (mediaId is null).
	 *
	 * Flow:
	 * 1. Determines provider from URL (bandcamp or youtube)
	 * 2. Calls MetadataExtractor to get yt-dlp metadata
	 * 3. Attempts to find existing MediaItem by provider+providerId
	 * 4. Creates new MediaItem if not found
	 * 5. Links media to download via updateMediaId
	 *
	 * Failures are logged but not thrown - metadata linking is optional.
	 * Download can complete successfully even if this fails.
	 *
	 * @param downloadId - Download ID to link metadata to
	 * @param url - Original download URL for provider detection
	 * @param filePath - Download output path (not currently used but available)
	 *
	 * @example
	 * ```typescript
	 * // Called internally after download completion
	 * await this.extractAndLinkMetadata(
	 *   42,
	 *   'https://music.youtube.com/watch?v=abc123',
	 *   '/tmp/downloads'
	 * );
	 * // Flow:
	 * // 1. Detects provider = 'youtube'
	 * // 2. Extracts metadata: { id: 'abc123', title: 'Song', artist: 'Artist', ... }
	 * // 3. Searches for existing media: findByProviderAndProviderId('youtube', 'abc123')
	 * // 4. Creates new MediaItem if not found
	 * // 5. Updates download.mediaId = media.id
	 *
	 * // Bandcamp album example
	 * await this.extractAndLinkMetadata(
	 *   43,
	 *   'https://artist.bandcamp.com/album/album-name',
	 *   '/tmp/downloads'
	 * );
	 * // Flow similar but with provider = 'bandcamp'
	 * // Metadata may have null fields (artist, album_artist)
	 * ```
	 */
	private async extractAndLinkMetadata(
		downloadId: number,
		url: string,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		filePath: string
	): Promise<void> {
		try {
			// Determine provider from URL
			const provider = url.includes('bandcamp.com') ? 'bandcamp' : 'youtube';

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
				this.logger.info({ mediaId: media.id, title: media.title }, 'Media created from download');
			}

			// Link media to download
			if (media.id !== null) {
				await this.downloadRepo.updateMediaId(downloadId, media.id);
			}
		} catch (error) {
			this.logger.warn({ error, downloadId }, 'Failed to extract and link metadata');
		}
	}
}
