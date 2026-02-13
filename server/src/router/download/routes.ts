import { createRoute } from '@hono/zod-openapi';
import {
  ErrorSchema,
  SuccessSchema,
  IdParamSchema,
  EnqueueDownloadSchema,
  EnqueueDownloadResponseSchema,
  DownloadStatusResponseSchema,
  ListDownloadsQuerySchema,
  ListDownloadsResponseSchema,
  GetDownloadLogsQuerySchema,
  GetDownloadLogsResponseSchema,
  UpdateMediaMetadataSchema,
  MediaSchema,
  MoveToDestinationResponseSchema
} from '@/lib/schemas';

export const enqueueDownloadRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Downloads'],
  summary: 'Enqueue a new download',
  request: {
    body: {
      content: {
        'application/json': {
          schema: EnqueueDownloadSchema
        }
      }
    }
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: EnqueueDownloadResponseSchema
        }
      },
      description:
        "Download enqueued successfully. Supports Bandcamp tracks/albums (bandcamp.com/track or bandcamp.com/album) and YouTube Music watch/playlists (music.youtube.com/watch or music.youtube.com/playlist). Metadata extraction runs asynchronously in background without blocking response. Emits SSE event 'download:enqueued' with {downloadId, url, status}."
    },
    400: {
      description:
        'Invalid URL: only Bandcamp tracks/albums and YouTube Music watch/playlists are supported. Verify format with regex /bandcamp\\.com\\/(track|album)\\//i and /music\\.youtube\\.com\\/(watch|playlist)/i',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    },
    409: {
      description:
        'Duplicate download: an active download (pending or in_progress) already exists for this normalized URL. Normalization converts protocol and domain to lowercase preserving path/query.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    },
    429: {
      description:
        'Queue full: maximum 10 pending downloads allowed simultaneously. Retry when downloads complete or cancel existing ones.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    },
    507: {
      description:
        'Insufficient storage: minimum 1GB available disk space required. Storage check verifies temp directory before starting download.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    }
  }
});

export const getDownloadStatusRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Downloads'],
  summary: 'Get download status',
  request: {
    params: IdParamSchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DownloadStatusResponseSchema
        }
      },
      description:
        'Download status retrieved successfully. Includes all DownloadItem fields: id, url, normalized_url, status (pending/in_progress/completed/failed/cancelled/stalled), progress (0-100), error_message (nullable), file_path (nullable), media_id (nullable), and timestamps (created_at, started_at nullable, completed_at nullable, updated_at).'
    },
    400: {
      description: 'Invalid ID: id parameter must be a valid UUID v4.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    },
    404: {
      description: 'Download not found: no download exists with the specified ID.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    }
  }
});

export const listDownloadsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Downloads'],
  summary: 'List downloads',
  request: {
    query: ListDownloadsQuerySchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ListDownloadsResponseSchema
        }
      },
      description:
        'Downloads list retrieved successfully. Supports filtering by status (pending|in_progress|completed|failed|cancelled|stalled) with query param ?status=. Ordering: active downloads (pending/in_progress) ordered by started_at DESC with priority, then others by updated_at DESC. Returns array with complete DownloadItem objects.'
    },
    400: {
      description:
        'Invalid query param: status must be one of pending, in_progress, completed, failed, cancelled, stalled.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    },
    500: {
      description: 'Internal server error when querying database.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    }
  }
});

export const getDownloadLogsRoute = createRoute({
  method: 'get',
  path: '/{id}/logs',
  tags: ['Downloads'],
  summary: 'Get download logs',
  request: {
    params: IdParamSchema,
    query: GetDownloadLogsQuerySchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetDownloadLogsResponseSchema
        }
      },
      description:
        'Download logs retrieved successfully. Returns paginated logs ordered by timestamp DESC (newest first). Supports pagination with query params ?page= (1-indexed, default: 1) and ?limit= (max: 100, default: 50). Includes eventType (download:enqueued, download:started, download:progress, download:completed, download:failed, download:cancelled, download:stalled, storage:low, metadata:fetching, metadata:found), descriptive message, optional metadata JSON object, and timestamp.'
    },
    400: {
      description: 'Invalid pagination params: page must be >= 1, limit must be 1-100.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    },
    404: {
      description: 'Download not found: no download exists with the specified ID.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    }
  }
});

export const cancelDownloadRoute = createRoute({
  method: 'post',
  path: '/{id}/cancel',
  tags: ['Downloads'],
  summary: 'Cancel a download',
  request: {
    params: IdParamSchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessSchema
        }
      },
      description:
        "Download cancelled successfully. If status is in_progress, kills the active yt-dlp process. Updates status to 'cancelled' and emits SSE event 'download:cancelled'. Clears progress throttle state."
    },
    400: {
      description:
        'Invalid status: only downloads with pending or in_progress status can be cancelled. Completed/failed/cancelled downloads are not cancellable.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    },
    404: {
      description: 'Download not found: no download exists with the specified ID.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    }
  }
});

export const retryDownloadRoute = createRoute({
  method: 'post',
  path: '/{id}/retry',
  tags: ['Downloads'],
  summary: 'Retry a failed download',
  request: {
    params: IdParamSchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessSchema
        }
      },
      description:
        "Download re-enqueued for retry successfully. Resets status to 'pending' with progress 0%, error_message null, and file_path null. Emits SSE event 'download:enqueued'. Worker will reprocess from queue."
    },
    400: {
      description:
        'Invalid status: only downloads with failed or cancelled status can be retried. Pending/in_progress/completed downloads are not retryable.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    },
    404: {
      description: 'Download not found: no download exists with the specified ID.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    }
  }
});

export const moveDownloadRoute = createRoute({
  method: 'post',
  path: '/{id}/move',
  tags: ['Downloads'],
  summary: 'Move completed download to destination',
  request: {
    params: IdParamSchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MoveToDestinationResponseSchema
        }
      },
      description:
        'File moved successfully from temp directory to final destination using Bun fs.rename(). Updates file_path in database with new location.'
    },
    400: {
      description:
        'Invalid status: only downloads with completed status can be moved. Download must have finished successfully before moving.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    },
    404: {
      description: 'Download not found or file does not exist in filesystem.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    }
  }
});

export const getMediaDetailsRoute = createRoute({
  method: 'get',
  path: '/media/{id}',
  tags: ['Media'],
  summary: 'Get media details',
  request: {
    params: IdParamSchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MediaSchema
        }
      },
      description:
        'Media details retrieved successfully. Includes all MediaItem fields: id, provider (bandcamp|youtube_music), provider_id, title (required), artist/album/album_artist/year/cover_url/duration/tracks (all nullable), and timestamps (created_at, updated_at). Nullable fields are null if yt-dlp did not extract information.'
    },
    400: {
      description: 'Invalid ID: id parameter must be a valid UUID v4.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    },
    404: {
      description: 'Media not found: no media exists with the specified ID.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    }
  }
});

export const updateMediaMetadataRoute = createRoute({
  method: 'patch',
  path: '/media/{id}',
  tags: ['Media'],
  summary: 'Update media metadata',
  request: {
    params: IdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateMediaMetadataSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessSchema
        }
      },
      description:
        'Metadata updated successfully. Editable fields: title, artist, album, album_artist, year, cover_url, duration, tracks (all nullable). Updates updated_at timestamp automatically.'
    },
    400: {
      description:
        'Invalid fields: cannot modify provider or provider_id (immutable fields that identify original source). Only editable metadata updates are allowed.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    },
    404: {
      description: 'Media not found: no media exists with the specified ID.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    }
  }
});

export type EnqueueDownloadRoute = typeof enqueueDownloadRoute;
export type GetDownloadStatusRoute = typeof getDownloadStatusRoute;
export type ListDownloadsRoute = typeof listDownloadsRoute;
export type GetDownloadLogsRoute = typeof getDownloadLogsRoute;
export type CancelDownloadRoute = typeof cancelDownloadRoute;
export type RetryDownloadRoute = typeof retryDownloadRoute;
export type MoveDownloadRoute = typeof moveDownloadRoute;
export type GetMediaDetailsRoute = typeof getMediaDetailsRoute;
export type UpdateMediaMetadataRoute = typeof updateMediaMetadataRoute;
