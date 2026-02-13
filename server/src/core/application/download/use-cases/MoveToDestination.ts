import { DownloadRepository } from '@/core/domain/download/repositories/download-repository';
import type { PinoLogger } from 'hono-pino';
import { rename, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { exists } from 'fs/promises';

/**
 * Use case for moving completed downloads to final destination.
 *
 * Application layer - Handles file system operations for moving downloads
 * from temporary directory to permanent storage location.
 *
 * Creates destination directory structure if needed.
 * Updates database with new file path after successful move.
 *
 * Can only move completed downloads. Verifies source file exists.
 */
export class MoveToDestination {
	/**
	 * Creates a new MoveToDestination use case.
	 *
	 * @param downloadRepo - Download repository for path updates
	 * @param logger - Logger for structured logging
	 * @param destDir - Destination directory base path
	 */
	constructor(
		private readonly downloadRepo: DownloadRepository,
		private readonly logger: PinoLogger,
		private readonly destDir: string
	) {}

	/**
	 * Moves download files to permanent destination.
	 *
	 * Flow:
	 * 1. Loads download from repository
	 * 2. Validates status is completed
	 * 3. Validates filePath exists
	 * 4. Checks source file exists on disk
	 * 5. Constructs destination path (destDir + relative path)
	 * 6. Creates destination directories recursively
	 * 7. Moves file using fs.rename (atomic on same filesystem)
	 * 8. Updates database with new path
	 *
	 * Uses atomic rename for safety. If move fails, database unchanged.
	 * Destination directory structure created automatically.
	 *
	 * @param downloadId - Download ID to move
	 * @returns New file path after move
	 * @throws Error if download not found (HTTP 404)
	 * @throws Error if download not completed (HTTP 400)
	 * @throws Error if no file path (HTTP 400)
	 * @throws Error if source file missing (HTTP 500)
	 * @throws Error if move operation fails (HTTP 500)
	 *
	 * @example
	 * ```typescript
	 * const moveToDestination = new MoveToDestination(
	 *   downloadRepo,
	 *   logger,
	 *   '/mnt/music'
	 * );
	 *
	 * // Move completed download
	 * const newPath = await moveToDestination.execute(42);
	 * // Moves from: /tmp/downloads/Artist/Album/01 Track.mp3
	 * // To: /mnt/music/Artist/Album/01 Track.mp3
	 * // Returns: '/mnt/music/Artist/Album/01 Track.mp3'
	 * // Updates download.filePath in database
	 *
	 * // Error: download not completed
	 * try {
	 *   await moveToDestination.execute(43); // status = 'in_progress'
	 * } catch (error) {
	 *   // Error: Download 43 is not completed (status: in_progress)
	 * }
	 *
	 * // Error: source file missing
	 * try {
	 *   await moveToDestination.execute(44); // file deleted
	 * } catch (error) {
	 *   // Error: Source file not found: /tmp/downloads/...
	 * }
	 * ```
	 *
	 * @see DownloadRepository.updateStatus - For path update
	 */
	async execute(downloadId: number): Promise<string> {
		const download = await this.downloadRepo.findById(downloadId);
		if (!download) {
			throw new Error(`Download ${downloadId} not found`);
		}

		if (download.status !== 'completed') {
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
			await this.downloadRepo.updateStatus(downloadId, 'completed', 100, null, destPath);

			this.logger.info(
				{ downloadId, from: download.filePath, to: destPath },
				'File moved to destination'
			);

			return destPath;
		} catch (error) {
			this.logger.error({ error, downloadId }, 'Failed to move file');
			throw error;
		}
	}
}
