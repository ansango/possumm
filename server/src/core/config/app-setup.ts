
import { createAppDependencies, getDefaultConfig } from "@/core/config/dependencies";
import { log } from "@/lib/logger";
import { createDownloadHandlers } from "@/router/download/handlers";
import { createDownloadRouter } from "@/router/download/routes";
import { createSSEHandler } from "@/router/download/sse";
import type { PinoLogger } from "hono-pino";



// Create app dependencies
const config = getDefaultConfig();
const dependencies = createAppDependencies(config, log as unknown as PinoLogger);

// Create handlers
const handlers = createDownloadHandlers({
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
export const downloadRouter = createDownloadRouter(handlers, sseHandler);

// Start worker
dependencies.worker.start().catch((error) => {
  log.error({ error }, "Failed to start download worker");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  log.info("SIGTERM received, shutting down gracefully");
  await dependencies.worker.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  log.info("SIGINT received, shutting down gracefully");
  await dependencies.worker.stop();
  process.exit(0);
});

export { dependencies };
