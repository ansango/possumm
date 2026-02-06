import { Context } from "hono";
import { EnqueueDownload } from "@/core/application/download/use-cases/EnqueueDownload";
import { GetDownloadStatus } from "@/core/application/download/use-cases/GetDownloadStatus";
import { ListDownloads } from "@/core/application/download/use-cases/ListDownloads";
import { CancelDownload } from "@/core/application/download/use-cases/CancelDownload";
import { RetryDownload } from "@/core/application/download/use-cases/RetryDownload";
import { MoveToDestination } from "@/core/application/download/use-cases/MoveToDestination";
import { GetMediaDetails } from "@/core/application/download/use-cases/GetMediaDetails";
import { UpdateMediaMetadata } from "@/core/application/download/use-cases/UpdateMediaMetadata";
import { DownloadStatus } from "@/core/domain/download/entities/download";

interface DownloadHandlers {
  enqueueDownload: EnqueueDownload;
  getDownloadStatus: GetDownloadStatus;
  listDownloads: ListDownloads;
  cancelDownload: CancelDownload;
  retryDownload: RetryDownload;
  moveToDestination: MoveToDestination;
  getMediaDetails: GetMediaDetails;
  updateMediaMetadata: UpdateMediaMetadata;
}

export function createDownloadHandlers(useCases: DownloadHandlers) {
  return {
    // POST /api/downloads - Enqueue new download
    enqueue: async (c: Context) => {
      try {
        const body = await c.req.json();
        const { url } = body;

        if (!url || typeof url !== "string") {
          return c.json({ error: "URL is required" }, 400);
        }

        const result = await useCases.enqueueDownload.execute(url);
        return c.json(result, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json({ error: message }, 400);
      }
    },

    // GET /api/downloads/:id - Get download status
    getStatus: async (c: Context) => {
      try {
        const id = parseInt(c.req.param("id"), 10);
        if (isNaN(id)) {
          return c.json({ error: "Invalid download ID" }, 400);
        }

        const result = await useCases.getDownloadStatus.execute(id);
        return c.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json({ error: message }, 404);
      }
    },

    // GET /api/downloads - List downloads
    list: async (c: Context) => {
      try {
        const status = c.req.query("status") as DownloadStatus | undefined;
        const page = parseInt(c.req.query("page") || "0", 10);
        const pageSize = parseInt(c.req.query("pageSize") || "20", 10);

        if (pageSize > 100) {
          return c.json({ error: "Page size cannot exceed 100" }, 400);
        }

        const result = await useCases.listDownloads.execute(status, page, pageSize);
        return c.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json({ error: message }, 500);
      }
    },

    // POST /api/downloads/:id/cancel - Cancel download
    cancel: async (c: Context) => {
      try {
        const id = parseInt(c.req.param("id"), 10);
        if (isNaN(id)) {
          return c.json({ error: "Invalid download ID" }, 400);
        }

        await useCases.cancelDownload.execute(id);
        return c.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json({ error: message }, 400);
      }
    },

    // POST /api/downloads/:id/retry - Retry failed download
    retry: async (c: Context) => {
      try {
        const id = parseInt(c.req.param("id"), 10);
        if (isNaN(id)) {
          return c.json({ error: "Invalid download ID" }, 400);
        }

        await useCases.retryDownload.execute(id);
        return c.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json({ error: message }, 400);
      }
    },

    // POST /api/downloads/:id/move - Move completed download to destination
    move: async (c: Context) => {
      try {
        const id = parseInt(c.req.param("id"), 10);
        if (isNaN(id)) {
          return c.json({ error: "Invalid download ID" }, 400);
        }

        const destPath = await useCases.moveToDestination.execute(id);
        return c.json({ success: true, destPath });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json({ error: message }, 400);
      }
    },

    // GET /api/media/:id - Get media details
    getMedia: async (c: Context) => {
      try {
        const id = parseInt(c.req.param("id"), 10);
        if (isNaN(id)) {
          return c.json({ error: "Invalid media ID" }, 400);
        }

        const result = await useCases.getMediaDetails.execute(id);
        return c.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json({ error: message }, 404);
      }
    },

    // PATCH /api/media/:id - Update media metadata
    updateMedia: async (c: Context) => {
      try {
        const id = parseInt(c.req.param("id"), 10);
        if (isNaN(id)) {
          return c.json({ error: "Invalid media ID" }, 400);
        }

        const body = await c.req.json();
        const { title, artist, album, albumArtist, year } = body;

        await useCases.updateMediaMetadata.execute(id, {
          title,
          artist,
          album,
          albumArtist,
          year,
        });

        return c.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json({ error: message }, 400);
      }
    },
  };
}
