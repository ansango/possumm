import { z } from "zod";

// Enums
export const DownloadStatusEnum = z.enum([
  "pending",
  "downloading",
  "completed",
  "failed",
  "cancelled",
  "stalled",
]);

export const PlatformEnum = z.enum([
  "youtube",
  "soundcloud",
  "bandcamp",
  "spotify",
  "other",
]);

// Request schemas
export const EnqueueDownloadSchema = z.object({
  url: z.string().url(),
});

export const UpdateMediaMetadataSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional(),
  albumArtist: z.string().optional(),
  year: z.number().int().optional(),
});

export const ListDownloadsQuerySchema = z.object({
  status: DownloadStatusEnum.optional(),
  page: z.string().optional().default("0").transform((val) => parseInt(val, 10)),
  pageSize: z.string().optional().default("20").transform((val) => parseInt(val, 10)),
});

export const SSEQuerySchema = z.object({
  since: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// Response schemas
export const MediaSchema = z.object({
  id: z.number(),
  title: z.string(),
  artist: z.string().nullable(),
  album: z.string().nullable(),
  albumArtist: z.string().nullable(),
  duration: z.number().nullable(),
  year: z.number().nullable(),
  thumbnailUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DownloadSchema = z.object({
  id: z.number(),
  mediaId: z.number(),
  url: z.string(),
  normalizedUrl: z.string(),
  platform: PlatformEnum,
  status: DownloadStatusEnum,
  progress: z.number(),
  filePath: z.string().nullable(),
  fileSize: z.number().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});

export const EnqueueDownloadResponseSchema = z.object({
  download: DownloadSchema,
  media: MediaSchema,
});

export const DownloadStatusResponseSchema = z.object({
  download: DownloadSchema,
  media: MediaSchema,
});

export const ListDownloadsResponseSchema = z.object({
  downloads: z.array(
    z.object({
      download: DownloadSchema,
      media: MediaSchema,
    })
  ),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    hasMore: z.boolean(),
  }),
});

export const MoveToDestinationResponseSchema = z.object({
  success: z.boolean(),
  destPath: z.string(),
});
