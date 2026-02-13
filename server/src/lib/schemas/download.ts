import { z } from 'zod';

// Enums
export const DownloadStatusEnum = z.enum([
	'pending',
	'downloading',
	'completed',
	'failed',
	'cancelled',
	'stalled'
]);

export const DownloadLogEventTypeEnum = z.enum([
	'download:enqueued',
	'download:started',
	'download:progress',
	'download:completed',
	'download:failed',
	'download:cancelled',
	'download:stalled',
	'storage:low',
	'metadata:fetching',
	'metadata:found'
]);

export const PlatformEnum = z.enum(['youtube', 'soundcloud', 'bandcamp', 'spotify', 'other']);

// Request schemas
export const EnqueueDownloadSchema = z.object({
	url: z.string().url()
});

export const UpdateMediaMetadataSchema = z.object({
	title: z.string().optional(),
	artist: z.string().optional(),
	album: z.string().optional(),
	albumArtist: z.string().optional(),
	year: z.number().int().optional()
});

export const ListDownloadsQuerySchema = z.object({
	status: DownloadStatusEnum.optional(),
	page: z
		.string()
		.optional()
		.default('0')
		.transform((val) => parseInt(val, 10)),
	pageSize: z
		.string()
		.optional()
		.default('20')
		.transform((val) => parseInt(val, 10))
});

export const GetDownloadLogsQuerySchema = z.object({
	page: z
		.string()
		.optional()
		.default('1')
		.transform((val) => Math.max(1, parseInt(val, 10))),
	limit: z
		.string()
		.optional()
		.default('50')
		.transform((val) => Math.min(100, Math.max(1, parseInt(val, 10))))
});

export const SSEQuerySchema = z.object({
	since: z.string().regex(/^\d+$/).transform(Number).optional()
});

// Response schemas

// EnqueueDownload response
export const EnqueueDownloadResponseSchema = z.object({
	downloadId: z.number(),
	mediaId: z.number().nullable(),
	url: z.string(),
	status: z.string()
});

// GetDownloadStatus response
export const DownloadStatusResponseSchema = z.object({
	download: z.object({
		id: z.number(),
		url: z.string(),
		status: z.string(),
		progress: z.number(),
		errorMessage: z.string().nullable(),
		filePath: z.string().nullable(),
		processId: z.number().nullable(),
		createdAt: z.coerce.date(),
		startedAt: z.coerce.date().nullable(),
		finishedAt: z.coerce.date().nullable()
	}),
	media: z
		.object({
			id: z.number(),
			title: z.string().nullable(),
			artist: z.string().nullable(),
			album: z.string().nullable(),
			duration: z.number().nullable(),
			coverUrl: z.string().nullable()
		})
		.nullable()
});

// ListDownloads response
export const ListDownloadsResponseSchema = z.object({
	downloads: z.array(
		z.object({
			id: z.number(),
			url: z.string(),
			status: z.string(),
			progress: z.number(),
			errorMessage: z.string().nullable(),
			filePath: z.string().nullable(),
			createdAt: z.coerce.date(),
			startedAt: z.coerce.date().nullable(),
			finishedAt: z.coerce.date().nullable()
		})
	),
	total: z.number(),
	page: z.number(),
	pageSize: z.number()
});

// GetMediaDetails response
export const MediaSchema = z.object({
	id: z.number(),
	title: z.string().nullable(),
	artist: z.string().nullable(),
	album: z.string().nullable(),
	albumArtist: z.string().nullable(),
	year: z.string().nullable(),
	coverUrl: z.string().nullable(),
	duration: z.number().nullable(),
	provider: z.string(),
	providerId: z.string().nullable(),
	kind: z.enum(['track', 'album']).nullable(),
	tracks: z
		.array(
			z.object({
				track: z.number().nullable(),
				title: z.string().nullable(),
				duration: z.number().nullable()
			})
		)
		.nullable(),
	createdAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date().nullable()
});

// MoveToDestination response
export const MoveToDestinationResponseSchema = z.object({
	success: z.boolean(),
	destPath: z.string()
});

// GetDownloadLogs response
export const DownloadLogSchema = z.object({
	id: z.number(),
	downloadId: z.number(),
	eventType: DownloadLogEventTypeEnum,
	message: z.string(),
	metadata: z.record(z.string(), z.any()).nullable(),
	timestamp: z.coerce.date()
});

export const GetDownloadLogsResponseSchema = z.object({
	logs: z.array(DownloadLogSchema),
	pagination: z.object({
		page: z.number(),
		limit: z.number(),
		total: z.number(),
		totalPages: z.number()
	})
});
