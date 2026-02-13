import { AppRouteHandler, AppRouteHook } from '@/types';
import {
	EnqueueDownloadRoute,
	GetDownloadStatusRoute,
	ListDownloadsRoute,
	GetDownloadLogsRoute,
	CancelDownloadRoute,
	RetryDownloadRoute,
	MoveDownloadRoute,
	GetMediaDetailsRoute,
	UpdateMediaMetadataRoute
} from './routes';
import { EnqueueDownload } from '@/core/application/download/use-cases/EnqueueDownload';
import { GetDownloadStatus } from '@/core/application/download/use-cases/GetDownloadStatus';
import { ListDownloads } from '@/core/application/download/use-cases/ListDownloads';
import { GetDownloadLogs } from '@/core/application/download/use-cases/GetDownloadLogs';
import { CancelDownload } from '@/core/application/download/use-cases/CancelDownload';
import { RetryDownload } from '@/core/application/download/use-cases/RetryDownload';
import { MoveToDestination } from '@/core/application/download/use-cases/MoveToDestination';
import { GetMediaDetails } from '@/core/application/download/use-cases/GetMediaDetails';
import { UpdateMediaMetadata } from '@/core/application/download/use-cases/UpdateMediaMetadata';
import { DownloadStatus } from '@/core/domain/download/entities/download';

/**
 * Collection of download-related use cases injected into handlers.
 */
interface DownloadUseCases {
	enqueueDownload: EnqueueDownload;
	getDownloadStatus: GetDownloadStatus;
	listDownloads: ListDownloads;
	getDownloadLogs: GetDownloadLogs;
	cancelDownload: CancelDownload;
	retryDownload: RetryDownload;
	moveToDestination: MoveToDestination;
	getMediaDetails: GetMediaDetails;
	updateMediaMetadata: UpdateMediaMetadata;
}

/**
 * Factory function to create download route handlers with dependency injection.
 *
 * API layer - Thin controllers that delegate to use cases.
 * Handlers are responsible for:
 * - Extracting and validating request data
 * - Calling appropriate use case
 * - Mapping errors to HTTP status codes
 * - Returning JSON responses
 *
 * @param useCases - Injected use cases for download operations
 * @returns Object containing all handler functions
 */
export function createDownloadHandlers(useCases: DownloadUseCases) {
	/**
	 * Handler for enqueueing a new download.
	 *
	 * POST /api/downloads
	 *
	 * Maps errors to HTTP status codes:
	 * - 201: Download enqueued successfully
	 * - 400: Invalid URL or unsupported platform
	 * - 409: Duplicate active download (implicit in error message)
	 * - 429: Maximum pending downloads reached (implicit in error message)
	 *
	 * @example
	 * ```
	 * POST /api/downloads
	 * Content-Type: application/json
	 *
	 * {
	 *   "url": "https://music.youtube.com/watch?v=abc123"
	 * }
	 *
	 * Response 201:
	 * {
	 *   "downloadId": 42,
	 *   "mediaId": null,
	 *   "url": "https://music.youtube.com/watch?v=abc123",
	 *   "status": "pending"
	 * }
	 *
	 * Response 400 (invalid URL):
	 * {
	 *   "error": "Invalid URL. Only Bandcamp (track/album) and YouTube Music (watch/playlist) URLs are supported."
	 * }
	 *
	 * Response 400 (duplicate):
	 * {
	 *   "error": "A download for this URL is already pending or in progress"
	 * }
	 *
	 * Response 400 (queue full):
	 * {
	 *   "error": "Maximum 10 pending downloads reached"
	 * }
	 * ```
	 */
	const enqueue: AppRouteHandler<EnqueueDownloadRoute> = async (c) => {
		try {
			const body = c.req.valid('json');
			const result = await useCases.enqueueDownload.execute(body.url);
			return c.json(result, 201);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ error: message }, 400);
		}
	};

	/**
	 * Handler for retrieving download status with linked media.
	 *
	 * GET /api/downloads/:id
	 *
	 * Maps errors to HTTP status codes:
	 * - 200: Download found and returned
	 * - 404: Download not found
	 *
	 * @example
	 * ```
	 * GET /api/downloads/42
	 *
	 * Response 200:
	 * {
	 *   "download": {
	 *     "id": 42,
	 *     "url": "https://music.youtube.com/watch?v=abc123",
	 *     "status": "in_progress",
	 *     "progress": 75,
	 *     "errorMessage": null,
	 *     "filePath": null,
	 *     "processId": 12345,
	 *     "createdAt": "2024-01-15T10:30:00Z",
	 *     "startedAt": "2024-01-15T10:31:00Z",
	 *     "finishedAt": null
	 *   },
	 *   "media": {
	 *     "id": 100,
	 *     "title": "Song Title",
	 *     "artist": "Artist Name",
	 *     "album": "Album Name",
	 *     "duration": 240,
	 *     "coverUrl": "https://..."
	 *   }
	 * }
	 *
	 * Response 404:
	 * {
	 *   "error": "Download 999 not found"
	 * }
	 * ```
	 */
	const getStatus: AppRouteHandler<GetDownloadStatusRoute> = async (c) => {
		try {
			const { id } = c.req.valid('param');
			const result = await useCases.getDownloadStatus.execute(id);
			return c.json(result, 200);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ error: message }, 404);
		}
	};

	/**
	 * Handler for listing downloads with optional status filter and pagination.
	 *
	 * GET /api/downloads?status=pending&page=0&pageSize=20
	 *
	 * Query parameters:
	 * - status (optional): Filter by status (pending/in_progress/completed/failed/cancelled)
	 * - page (optional): 0-based page number, default 0
	 * - pageSize (optional): Items per page, default 20, max 100
	 *
	 * Maps errors to HTTP status codes:
	 * - 200: Downloads listed successfully
	 * - 400: Invalid page size (exceeds 100)
	 * - 500: Internal server error
	 *
	 * @example
	 * ```
	 * GET /api/downloads?status=pending&page=0&pageSize=10
	 *
	 * Response 200:
	 * {
	 *   "downloads": [
	 *     {
	 *       "id": 1,
	 *       "url": "https://music.youtube.com/watch?v=abc123",
	 *       "status": "pending",
	 *       "progress": 0,
	 *       "errorMessage": null,
	 *       "filePath": null,
	 *       "createdAt": "2024-01-15T10:30:00Z",
	 *       "startedAt": null,
	 *       "finishedAt": null
	 *     },
	 *     // ... 9 more items ...
	 *   ],
	 *   "total": 25,
	 *   "page": 0,
	 *   "pageSize": 10
	 * }
	 *
	 * Response 400 (page size too large):
	 * {
	 *   "error": "Page size cannot exceed 100"
	 * }
	 * ```
	 */
	const list: AppRouteHandler<ListDownloadsRoute> = async (c) => {
		try {
			const query = c.req.valid('query');
			const status = query.status as DownloadStatus | undefined;
			const page = query.page;
			const pageSize = query.pageSize;

			if (pageSize > 100) {
				return c.json({ error: 'Page size cannot exceed 100' }, 400);
			}

			const result = await useCases.listDownloads.execute(status, page, pageSize);
			return c.json(result, 200);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ error: message }, 500);
		}
	};

	/**
	 * Handler for retrieving download logs with pagination.
	 *
	 * GET /api/downloads/:id/logs?page=1&limit=50
	 */
	const getLogs: AppRouteHandler<GetDownloadLogsRoute> = async (c) => {
		try {
			const { id } = c.req.valid('param');
			const query = c.req.valid('query');
			const result = await useCases.getDownloadLogs.execute(id, query.page, query.limit);
			return c.json(result, 200);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';

			// Check if it's a "not found" error
			if (message.includes('not found')) {
				return c.json({ error: message }, 404);
			}

			return c.json({ error: message }, 400);
		}
	};

	const cancel: AppRouteHandler<CancelDownloadRoute> = async (c) => {
		try {
			const { id } = c.req.valid('param');
			await useCases.cancelDownload.execute(id);
			return c.json({ success: true }, 200);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ error: message }, 400);
		}
	};

	const retry: AppRouteHandler<RetryDownloadRoute> = async (c) => {
		try {
			const { id } = c.req.valid('param');
			await useCases.retryDownload.execute(id);
			return c.json({ success: true }, 200);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ error: message }, 400);
		}
	};

	const move: AppRouteHandler<MoveDownloadRoute> = async (c) => {
		try {
			const { id } = c.req.valid('param');
			const destPath = await useCases.moveToDestination.execute(id);
			return c.json({ success: true, destPath }, 200);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ error: message }, 400);
		}
	};

	const getMedia: AppRouteHandler<GetMediaDetailsRoute> = async (c) => {
		try {
			const { id } = c.req.valid('param');
			const result = await useCases.getMediaDetails.execute(id);
			return c.json(result, 200);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ error: message }, 404);
		}
	};

	const updateMedia: AppRouteHandler<UpdateMediaMetadataRoute> = async (c) => {
		try {
			const { id } = c.req.valid('param');
			const body = c.req.valid('json');

			await useCases.updateMediaMetadata.execute(id, {
				title: body.title,
				artist: body.artist,
				album: body.album,
				albumArtist: body.albumArtist,
				year: body.year?.toString()
			});

			return c.json({ success: true }, 200);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ error: message }, 400);
		}
	};

	return {
		enqueue,
		getStatus,
		list,
		getLogs,
		cancel,
		retry,
		move,
		getMedia,
		updateMedia
	};
}

export const downloadValidationHook: AppRouteHook = (result, c) => {
	if (!result.success) {
		return c.json(
			{
				error: 'Invalid download request. Please check your parameters.'
			},
			400
		);
	}
};
