import * as downloadHandlers from "./handlers";
import * as downloadRoutes from "./routes";
import { createRouter } from "@/server";
import { dependencies } from "@/core/config/app-setup";
import { createSSEHandler } from "./sse";

// Create handlers with use cases
const handlers = downloadHandlers.createDownloadHandlers({
  enqueueDownload: dependencies.useCases.enqueueDownload,
  getDownloadStatus: dependencies.useCases.getDownloadStatus,
  listDownloads: dependencies.useCases.listDownloads,
  cancelDownload: dependencies.useCases.cancelDownload,
  retryDownload: dependencies.useCases.retryDownload,
  moveToDestination: dependencies.useCases.moveToDestination,
  getMediaDetails: dependencies.useCases.getMediaDetails,
  updateMediaMetadata: dependencies.useCases.updateMediaMetadata,
});

// Create SSE handler
const sseHandler = createSSEHandler(dependencies.eventEmitter);

// Create router
const router = createRouter()
  .basePath("/api/downloads")
  .openapi(
    downloadRoutes.enqueueDownloadRoute,
    handlers.enqueue,
    downloadHandlers.downloadValidationHook
  )
  .openapi(
    downloadRoutes.listDownloadsRoute,
    handlers.list,
    downloadHandlers.downloadValidationHook
  )
  .openapi(
    downloadRoutes.getDownloadStatusRoute,
    handlers.getStatus,
    downloadHandlers.downloadValidationHook
  )
  .openapi(
    downloadRoutes.cancelDownloadRoute,
    handlers.cancel,
    downloadHandlers.downloadValidationHook
  )
  .openapi(
    downloadRoutes.retryDownloadRoute,
    handlers.retry,
    downloadHandlers.downloadValidationHook
  )
  .openapi(
    downloadRoutes.moveDownloadRoute,
    handlers.move,
    downloadHandlers.downloadValidationHook
  )
  .openapi(
    downloadRoutes.getMediaDetailsRoute,
    handlers.getMedia,
    downloadHandlers.downloadValidationHook
  )
  .openapi(
    downloadRoutes.updateMediaMetadataRoute,
    handlers.updateMedia,
    downloadHandlers.downloadValidationHook
  );

// Add SSE route (not using OpenAPI as it's a streaming endpoint)
router.get("/events", sseHandler);

export default router;

