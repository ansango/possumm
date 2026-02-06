import { Context, Hono } from "hono";
import { pinoLogger } from "hono-pino";
import pino from "pino";
import { createAppDependencies, getDefaultConfig } from "@/core/config/dependencies";
import { createDownloadHandlers } from "@/router/download/handlers";
import { createDownloadRouter } from "@/router/download/routes";
import { createSSEHandler } from "@/router/download/sse";

// Create logger
const logger = pino({ level: process.env.LOG_LEVEL || "info" });

// Create app dependencies
const config = getDefaultConfig();
const dependencies = createAppDependencies(config, logger as any);

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
  logger.error({ error }, "Failed to start download worker");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  await dependencies.worker.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  await dependencies.worker.stop();
  process.exit(0);
});

export { dependencies };
