import { createRoute } from "@hono/zod-openapi";
import {
  ErrorSchema,
  SuccessSchema,
  IdParamSchema,
  EnqueueDownloadSchema,
  EnqueueDownloadResponseSchema,
  DownloadStatusResponseSchema,
  ListDownloadsQuerySchema,
  ListDownloadsResponseSchema,
  UpdateMediaMetadataSchema,
  MediaSchema,
  MoveToDestinationResponseSchema,
} from "@/lib/schemas";

export const enqueueDownloadRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Downloads"],
  summary: "Enqueue a new download",
  request: {
    body: {
      content: {
        "application/json": {
          schema: EnqueueDownloadSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: EnqueueDownloadResponseSchema,
        },
      },
      description: "Download enqueued successfully",
    },
    400: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const getDownloadStatusRoute = createRoute({
  method: "get",
  path: "/:id",
  tags: ["Downloads"],
  summary: "Get download status",
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DownloadStatusResponseSchema,
        },
      },
      description: "Download status retrieved successfully",
    },
    400: {
      description: "Invalid download ID",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Download not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const listDownloadsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Downloads"],
  summary: "List downloads",
  request: {
    query: ListDownloadsQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ListDownloadsResponseSchema,
        },
      },
      description: "Downloads listed successfully",
    },
    400: {
      description: "Invalid query parameters",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const cancelDownloadRoute = createRoute({
  method: "post",
  path: "/:id/cancel",
  tags: ["Downloads"],
  summary: "Cancel a download",
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SuccessSchema,
        },
      },
      description: "Download cancelled successfully",
    },
    400: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const retryDownloadRoute = createRoute({
  method: "post",
  path: "/:id/retry",
  tags: ["Downloads"],
  summary: "Retry a failed download",
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SuccessSchema,
        },
      },
      description: "Download retried successfully",
    },
    400: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const moveDownloadRoute = createRoute({
  method: "post",
  path: "/:id/move",
  tags: ["Downloads"],
  summary: "Move completed download to destination",
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MoveToDestinationResponseSchema,
        },
      },
      description: "Download moved successfully",
    },
    400: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const getMediaDetailsRoute = createRoute({
  method: "get",
  path: "/media/:id",
  tags: ["Media"],
  summary: "Get media details",
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MediaSchema,
        },
      },
      description: "Media details retrieved successfully",
    },
    400: {
      description: "Invalid media ID",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Media not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export const updateMediaMetadataRoute = createRoute({
  method: "patch",
  path: "/media/:id",
  tags: ["Media"],
  summary: "Update media metadata",
  request: {
    params: IdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateMediaMetadataSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SuccessSchema,
        },
      },
      description: "Media metadata updated successfully",
    },
    400: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export type EnqueueDownloadRoute = typeof enqueueDownloadRoute;
export type GetDownloadStatusRoute = typeof getDownloadStatusRoute;
export type ListDownloadsRoute = typeof listDownloadsRoute;
export type CancelDownloadRoute = typeof cancelDownloadRoute;
export type RetryDownloadRoute = typeof retryDownloadRoute;
export type MoveDownloadRoute = typeof moveDownloadRoute;
export type GetMediaDetailsRoute = typeof getMediaDetailsRoute;
export type UpdateMediaMetadataRoute = typeof updateMediaMetadataRoute;

