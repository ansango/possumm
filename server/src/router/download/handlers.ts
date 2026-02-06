import { AppRouteHandler, AppRouteHook } from "@/types";
import {
  EnqueueDownloadRoute,
  GetDownloadStatusRoute,
  ListDownloadsRoute,
  CancelDownloadRoute,
  RetryDownloadRoute,
  MoveDownloadRoute,
  GetMediaDetailsRoute,
  UpdateMediaMetadataRoute,
} from "./routes";
import { EnqueueDownload } from "@/core/application/download/use-cases/EnqueueDownload";
import { GetDownloadStatus } from "@/core/application/download/use-cases/GetDownloadStatus";
import { ListDownloads } from "@/core/application/download/use-cases/ListDownloads";
import { CancelDownload } from "@/core/application/download/use-cases/CancelDownload";
import { RetryDownload } from "@/core/application/download/use-cases/RetryDownload";
import { MoveToDestination } from "@/core/application/download/use-cases/MoveToDestination";
import { GetMediaDetails } from "@/core/application/download/use-cases/GetMediaDetails";
import { UpdateMediaMetadata } from "@/core/application/download/use-cases/UpdateMediaMetadata";
import { DownloadStatus } from "@/core/domain/download/entities/download";

interface DownloadUseCases {
  enqueueDownload: EnqueueDownload;
  getDownloadStatus: GetDownloadStatus;
  listDownloads: ListDownloads;
  cancelDownload: CancelDownload;
  retryDownload: RetryDownload;
  moveToDestination: MoveToDestination;
  getMediaDetails: GetMediaDetails;
  updateMediaMetadata: UpdateMediaMetadata;
}

export function createDownloadHandlers(useCases: DownloadUseCases) {
  const enqueue: AppRouteHandler<EnqueueDownloadRoute> = async (c) => {
    try {
      const body = c.req.valid("json");
      const result = await useCases.enqueueDownload.execute(body.url);
      return c.json(result, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  };

  const getStatus: AppRouteHandler<GetDownloadStatusRoute> = async (c) => {
    try {
      const { id } = c.req.valid("param");
      const result = await useCases.getDownloadStatus.execute(id);
      return c.json(result, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 404);
    }
  };

  const list: AppRouteHandler<ListDownloadsRoute> = async (c) => {
    try {
      const query = c.req.valid("query");
      const status = query.status as DownloadStatus | undefined;
      const page = query.page;
      const pageSize = query.pageSize;

      if (pageSize > 100) {
        return c.json({ error: "Page size cannot exceed 100" }, 400);
      }

      const result = await useCases.listDownloads.execute(status, page, pageSize);
      return c.json(result, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  };

  const cancel: AppRouteHandler<CancelDownloadRoute> = async (c) => {
    try {
      const { id } = c.req.valid("param");
      await useCases.cancelDownload.execute(id);
      return c.json({ success: true }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  };

  const retry: AppRouteHandler<RetryDownloadRoute> = async (c) => {
    try {
      const { id } = c.req.valid("param");
      await useCases.retryDownload.execute(id);
      return c.json({ success: true }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  };

  const move: AppRouteHandler<MoveDownloadRoute> = async (c) => {
    try {
      const { id } = c.req.valid("param");
      const destPath = await useCases.moveToDestination.execute(id);
      return c.json({ success: true, destPath }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  };

  const getMedia: AppRouteHandler<GetMediaDetailsRoute> = async (c) => {
    try {
      const { id } = c.req.valid("param");
      const result = await useCases.getMediaDetails.execute(id);
      return c.json(result, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 404);
    }
  };

  const updateMedia: AppRouteHandler<UpdateMediaMetadataRoute> = async (c) => {
    try {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");

      await useCases.updateMediaMetadata.execute(id, {
        title: body.title,
        artist: body.artist,
        album: body.album,
        albumArtist: body.albumArtist,
        year: body.year?.toString(),
      });

      return c.json({ success: true }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  };

  return {
    enqueue,
    getStatus,
    list,
    cancel,
    retry,
    move,
    getMedia,
    updateMedia,
  };
}

export const downloadValidationHook: AppRouteHook = (result, c) => {
  if (!result.success) {
    return c.json(
      {
        error: "Invalid download request. Please check your parameters.",
      },
      400
    );
  }
};

