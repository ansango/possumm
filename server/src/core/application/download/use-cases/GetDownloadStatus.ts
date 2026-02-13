import { DownloadRepository } from '@/core/domain/download/repositories/download-repository';
import { MediaRepository } from '@/core/domain/media/repositories/media-repository';
import type { PinoLogger } from 'hono-pino';

/**
 * Result structure for download status query.
 *
 * Combines download state with optional linked media information.
 */
interface DownloadStatusResult {
	/** Download entity with all tracking information */
	download: {
		id: number;
		url: string;
		status: string;
		progress: number;
		errorMessage: string | null;
		filePath: string | null;
		processId: number | null;
		createdAt: Date;
		startedAt: Date | null;
		finishedAt: Date | null;
	};
	/** Associated media metadata, null if not linked yet */
	media: {
		id: number;
		title: string | null;
		artist: string | null;
		album: string | null;
		duration: number | null;
		coverUrl: string | null;
	} | null;
}

/**
 * Use case for retrieving download status with linked media.
 *
 * Application layer - Query use case for single download retrieval.
 * Returns both download tracking information and associated media
 * metadata if available.
 *
 * Used by API handlers and SSE for status updates.
 */
export class GetDownloadStatus {
	/**
	 * Creates a new GetDownloadStatus use case.
	 *
	 * @param downloadRepo - Download repository for retrieval
	 * @param mediaRepo - Media repository for linked metadata
	 * @param logger - Logger for structured logging
	 */
	constructor(
		private readonly downloadRepo: DownloadRepository,
		private readonly mediaRepo: MediaRepository,
		private readonly logger: PinoLogger
	) {}

	/**
	 * Retrieves download status with optional linked media.
	 *
	 * Flow:
	 * 1. Loads download by ID from repository
	 * 2. If download has mediaId, loads associated MediaItem
	 * 3. Returns combined result with download and media info
	 *
	 * @param downloadId - Download ID to retrieve
	 * @returns Download status with optional media metadata
	 * @throws Error if download not found (HTTP 404)
	 *
	 * @example
	 * ```typescript
	 * const getStatus = new GetDownloadStatus(downloadRepo, mediaRepo, logger);
	 *
	 * // Get status for pending download (no media yet)
	 * const status1 = await getStatus.execute(42);
	 * // Returns: {
	 * //   download: {
	 * //     id: 42,
	 * //     url: 'https://music.youtube.com/watch?v=abc123',
	 * //     status: 'pending',
	 * //     progress: 0,
	 * //     errorMessage: null,
	 * //     filePath: null,
	 * //     processId: null,
	 * //     createdAt: 2024-01-15T10:30:00Z,
	 * //     startedAt: null,
	 * //     finishedAt: null
	 * //   },
	 * //   media: null
	 * // }
	 *
	 * // Get status for in-progress download with metadata
	 * const status2 = await getStatus.execute(43);
	 * // Returns: {
	 * //   download: {
	 * //     id: 43,
	 * //     status: 'in_progress',
	 * //     progress: 75,
	 * //     processId: 12345,
	 * //     startedAt: 2024-01-15T10:31:00Z,
	 * //     ...
	 * //   },
	 * //   media: {
	 * //     id: 100,
	 * //     title: 'Song Title',
	 * //     artist: 'Artist Name',
	 * //     album: 'Album Name',
	 * //     duration: 240,
	 * //     coverUrl: 'https://...'
	 * //   }
	 * // }
	 *
	 * // Error: download not found
	 * try {
	 *   await getStatus.execute(999);
	 * } catch (error) {
	 *   // Error: Download 999 not found
	 * }
	 * ```
	 *
	 * @see DownloadRepository.findById - For download retrieval
	 * @see MediaRepository.findById - For media retrieval
	 */
	async execute(downloadId: number): Promise<DownloadStatusResult> {
		const download = await this.downloadRepo.findById(downloadId);
		if (!download) {
			throw new Error(`Download ${downloadId} not found`);
		}

		let media = null;
		if (download.mediaId) {
			const mediaItem = await this.mediaRepo.findById(download.mediaId);
			if (mediaItem) {
				media = {
					id: mediaItem.id!,
					title: mediaItem.title,
					artist: mediaItem.artist,
					album: mediaItem.album,
					duration: mediaItem.duration,
					coverUrl: mediaItem.coverUrl
				};
			}
		}

		return {
			download: {
				id: download.id!,
				url: download.url,
				status: download.status,
				progress: download.progress,
				errorMessage: download.errorMessage,
				filePath: download.filePath,
				processId: download.processId,
				createdAt: download.createdAt,
				startedAt: download.startedAt,
				finishedAt: download.finishedAt
			},
			media
		};
	}
}
