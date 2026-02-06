import pino from "pino";
import type { PinoLogger } from "hono-pino";

// Repositories
import { SQLiteMediaRepository } from "@/core/infrastructure/downloads/SQLiteMediaRepository";
import { SQLiteDownloadRepository } from "@/core/infrastructure/downloads/SQLiteDownloadRepository";
import { CachedMediaRepository } from "@/core/infrastructure/cache/CachedMediaRepository";
import { CachedDownloadRepository } from "@/core/infrastructure/cache/CachedDownloadRepository";

// Services
import { UrlNormalizer } from "@/core/application/download/services/UrlNormalizer";
import { PlatformDetector } from "@/core/application/download/services/PlatformDetector";
import { MetadataExtractor } from "@/core/application/download/services/MetadataExtractor";
import { DownloadExecutor } from "@/core/application/download/services/DownloadExecutor";
import { StorageService } from "@/core/application/download/services/StorageService";

// Use Cases
import { EnqueueDownload } from "@/core/application/download/use-cases/EnqueueDownload";
import { ProcessDownload } from "@/core/application/download/use-cases/ProcessDownload";
import { GetDownloadStatus } from "@/core/application/download/use-cases/GetDownloadStatus";
import { ListDownloads } from "@/core/application/download/use-cases/ListDownloads";
import { GetMediaDetails } from "@/core/application/download/use-cases/GetMediaDetails";
import { UpdateMediaMetadata } from "@/core/application/download/use-cases/UpdateMediaMetadata";
import { MoveToDestination } from "@/core/application/download/use-cases/MoveToDestination";
import { CancelDownload } from "@/core/application/download/use-cases/CancelDownload";
import { RetryDownload } from "@/core/application/download/use-cases/RetryDownload";
import { CleanupOrphanedFiles } from "@/core/application/download/use-cases/CleanupOrphanedFiles";
import { MarkStalledDownloads } from "@/core/application/download/use-cases/MarkStalledDownloads";

// Infrastructure
import { DownloadEventEmitter } from "@/core/infrastructure/events/DownloadEventEmitter";
import { DownloadWorker } from "@/core/application/download/worker/DownloadWorker";
import { cache } from "@/lib/db/cache";

interface AppConfig {
  downloadTempDir: string;
  downloadDestDir: string;
  minStorageGB: number;
  maxPendingDownloads: number;
  cleanupRetentionDays: number;
  downloadTimeoutMinutes: number;
  eventBufferSize: number;
  progressThrottleMs: number;
}

export interface AppDependencies {
  repositories: {
    media: CachedMediaRepository;
    download: CachedDownloadRepository;
  };
  services: {
    urlNormalizer: UrlNormalizer;
    platformDetector: PlatformDetector;
    metadataExtractor: MetadataExtractor;
    downloadExecutor: DownloadExecutor;
    storageService: StorageService;
  };
  useCases: {
    enqueueDownload: EnqueueDownload;
    processDownload: ProcessDownload;
    getDownloadStatus: GetDownloadStatus;
    listDownloads: ListDownloads;
    getMediaDetails: GetMediaDetails;
    updateMediaMetadata: UpdateMediaMetadata;
    moveToDestination: MoveToDestination;
    cancelDownload: CancelDownload;
    retryDownload: RetryDownload;
    cleanupOrphanedFiles: CleanupOrphanedFiles;
    markStalledDownloads: MarkStalledDownloads;
  };
  eventEmitter: DownloadEventEmitter;
  worker: DownloadWorker;
}

export function createAppDependencies(config: AppConfig, logger: PinoLogger): AppDependencies {
  // Create base repositories
  const sqliteMediaRepo = new SQLiteMediaRepository();
  const sqliteDownloadRepo = new SQLiteDownloadRepository();

  // Wrap with cache
  const mediaRepo = new CachedMediaRepository(sqliteMediaRepo);
  const downloadRepo = new CachedDownloadRepository(sqliteDownloadRepo);

  // Create services
  const urlNormalizer = new UrlNormalizer();
  const platformDetector = new PlatformDetector();
  const metadataExtractor = new MetadataExtractor(logger);
  const downloadExecutor = new DownloadExecutor(logger, config.downloadTempDir);
  const storageService = new StorageService();

  // Create event emitter
  const eventEmitter = new DownloadEventEmitter(
    config.eventBufferSize,
    config.progressThrottleMs
  );

  // Create use cases - Operations
  const enqueueDownload = new EnqueueDownload(
    downloadRepo,
    mediaRepo,
    urlNormalizer,
    platformDetector,
    metadataExtractor,
    eventEmitter,
    logger,
    config.maxPendingDownloads
  );

  const processDownload = new ProcessDownload(
    downloadRepo,
    mediaRepo,
    downloadExecutor,
    storageService,
    metadataExtractor,
    eventEmitter,
    logger,
    config.downloadTempDir,
    config.minStorageGB
  );

  const getDownloadStatus = new GetDownloadStatus(downloadRepo, mediaRepo, logger);
  const listDownloads = new ListDownloads(downloadRepo, logger);
  const getMediaDetails = new GetMediaDetails(mediaRepo, logger);
  const updateMediaMetadata = new UpdateMediaMetadata(mediaRepo, logger);
  const moveToDestination = new MoveToDestination(downloadRepo, logger, config.downloadDestDir);

  // Create use cases - Management
  const cancelDownload = new CancelDownload(
    downloadRepo,
    downloadExecutor,
    eventEmitter,
    logger
  );

  const retryDownload = new RetryDownload(downloadRepo, eventEmitter, logger);

  const cleanupOrphanedFiles = new CleanupOrphanedFiles(
    downloadRepo,
    mediaRepo,
    logger,
    config.cleanupRetentionDays
  );

  const markStalledDownloads = new MarkStalledDownloads(
    downloadRepo,
    eventEmitter,
    logger,
    config.downloadTimeoutMinutes
  );

  // Create worker
  const worker = new DownloadWorker(
    downloadRepo,
    processDownload,
    cleanupOrphanedFiles,
    markStalledDownloads,
    logger,
    2000, // pollIntervalMs
    config.cleanupRetentionDays * 24 * 60 * 60 * 1000, // cleanupIntervalMs
    5 * 60 * 1000 // stalledCheckIntervalMs
  );

  return {
    repositories: {
      media: mediaRepo,
      download: downloadRepo,
    },
    services: {
      urlNormalizer,
      platformDetector,
      metadataExtractor,
      downloadExecutor,
      storageService,
    },
    useCases: {
      enqueueDownload,
      processDownload,
      getDownloadStatus,
      listDownloads,
      getMediaDetails,
      updateMediaMetadata,
      moveToDestination,
      cancelDownload,
      retryDownload,
      cleanupOrphanedFiles,
      markStalledDownloads,
    },
    eventEmitter,
    worker,
  };
}

export function getDefaultConfig(): AppConfig {
  return {
    downloadTempDir: process.env.DOWNLOAD_TEMP_DIR || "/tmp/downloads",
    downloadDestDir: process.env.DOWNLOAD_DEST_DIR || "/home/downloads",
    minStorageGB: parseInt(process.env.MIN_STORAGE_GB || "5", 10),
    maxPendingDownloads: parseInt(process.env.MAX_PENDING_DOWNLOADS || "10", 10),
    cleanupRetentionDays: parseInt(process.env.CLEANUP_RETENTION_DAYS || "7", 10),
    downloadTimeoutMinutes: parseInt(process.env.DOWNLOAD_TIMEOUT_MINUTES || "60", 10),
    eventBufferSize: parseInt(process.env.EVENT_BUFFER_SIZE || "100", 10),
    progressThrottleMs: parseInt(process.env.PROGRESS_THROTTLE_MS || "500", 10),
  };
}
