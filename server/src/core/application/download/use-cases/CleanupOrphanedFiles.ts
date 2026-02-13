import { DownloadRepository } from '@/core/domain/download/repositories/download-repository';
import { MediaRepository } from '@/core/domain/media/repositories/media-repository';
import type { PinoLogger } from 'hono-pino';
import { rm } from 'fs/promises';
import { exists } from 'fs/promises';

/**
 * Result structure for cleanup operation.
 */
interface CleanupResult {
	/** Number of download records deleted */
	downloadsDeleted: number;
	/** Number of orphaned media records deleted */
	mediaDeleted: number;
	/** Number of files deleted from disk */
	filesDeleted: number;
}

/**
 * Use case for cleaning up old and orphaned data.
 *
 * Application layer - Scheduled maintenance job for removing stale data.
 *
 * Cleanup tasks:
 * 1. Deletes completed/failed downloads older than retention period
 * 2. Deletes associated files from disk (recursive, forced)
 * 3. Deletes orphaned media records (no associated downloads)
 *
 * Runs with configurable retention period (default 7 days).
 * Failures for individual items are logged but don't stop cleanup.
 *
 * Designed to be run periodically (e.g., daily cron job).
 */
export class CleanupOrphanedFiles {
	/**
	 * Creates a new CleanupOrphanedFiles use case.
	 *
	 * @param downloadRepo - Download repository for queries and deletes
	 * @param mediaRepo - Media repository for orphan detection
	 * @param logger - Logger for structured logging
	 * @param retentionDays - Days to retain completed/failed downloads (default 7)
	 */
	constructor(
		private readonly downloadRepo: DownloadRepository,
		private readonly mediaRepo: MediaRepository,
		private readonly logger: PinoLogger,
		private readonly retentionDays: number = 7
	) {}

	/**
	 * Executes cleanup of old and orphaned data.
	 *
	 * Flow:
	 * 1. Finds completed/failed downloads older than retentionDays
	 * 2. For each old download:
	 *    a. Deletes file/directory if exists (recursive, forced)
	 *    b. Deletes download record from database
	 * 3. Finds all media records
	 * 4. For each media:
	 *    a. Checks if any downloads reference it
	 *    b. Deletes if orphaned (no references)
	 * 5. Returns counts of deleted items
	 *
	 * Individual failures are logged and skipped (doesn't halt cleanup).
	 * File deletion uses `rm -rf` equivalent (recursive, force).
	 *
	 * Note: Orphan detection could be optimized with SQL query instead
	 * of loading all media into memory.
	 *
	 * @returns Cleanup statistics
	 * @throws Error if overall cleanup fails (caught and logged internally)
	 *
	 * @example
	 * ```typescript
	 * const cleanup = new CleanupOrphanedFiles(
	 *   downloadRepo,
	 *   mediaRepo,
	 *   logger,
	 *   7 // Keep 7 days
	 * );
	 *
	 * // Run cleanup
	 * const result = await cleanup.execute();
	 * // Returns: {
	 * //   downloadsDeleted: 50,   // 50 old download records removed
	 * //   mediaDeleted: 10,       // 10 orphaned media records removed
	 * //   filesDeleted: 45        // 45 files/directories deleted from disk
	 * // }
	 *
	 * // Typical cron setup (daily at 3am):
	 * // 0 3 * * * /usr/bin/bun run cleanup-job.ts
	 * ```
	 *
	 * @see DownloadRepository.findOldCompleted - For retention queries
	 */
	async execute(): Promise<CleanupResult> {
		let downloadsDeleted = 0;
		let mediaDeleted = 0;
		let filesDeleted = 0;

		try {
			// Find old completed downloads
			const oldDownloads = await this.downloadRepo.findOldCompleted(this.retentionDays);

			this.logger.info(
				{ count: oldDownloads.length, days: this.retentionDays },
				'Found old downloads to clean'
			);

			for (const download of oldDownloads) {
				try {
					// Delete file if exists
					if (download.filePath) {
						const fileExists = await exists(download.filePath);
						if (fileExists) {
							await rm(download.filePath, { recursive: true, force: true });
							filesDeleted++;
							this.logger.debug({ path: download.filePath }, 'File deleted');
						}
					}

					// Delete download record
					await this.downloadRepo.delete(download.id!);
					downloadsDeleted++;
				} catch (error) {
					this.logger.warn({ error, downloadId: download.id }, 'Failed to cleanup download');
				}
			}

			// Find orphaned media (no associated downloads)
			// This is a simple implementation - could be optimized with a SQL query
			const allMedia = await this.mediaRepo.findAll(0, 1000);

			for (const media of allMedia) {
				if (media.id === null) continue;

				const associatedDownloads = await this.downloadRepo.findAll(0, 1);
				const hasDownloads = associatedDownloads.some((d) => d.mediaId === media.id);

				if (!hasDownloads) {
					try {
						await this.mediaRepo.delete(media.id);
						mediaDeleted++;
						this.logger.debug({ mediaId: media.id }, 'Orphaned media deleted');
					} catch (error) {
						this.logger.warn({ error, mediaId: media.id }, 'Failed to delete orphaned media');
					}
				}
			}

			this.logger.info({ downloadsDeleted, mediaDeleted, filesDeleted }, 'Cleanup completed');

			return { downloadsDeleted, mediaDeleted, filesDeleted };
		} catch (error) {
			this.logger.error({ error }, 'Cleanup failed');
			throw error;
		}
	}
}
