import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import { ProcessDownload } from "../use-cases/ProcessDownload";
import { CleanupOrphanedFiles } from "../use-cases/CleanupOrphanedFiles";
import { MarkStalledDownloads } from "../use-cases/MarkStalledDownloads";
import type { PinoLogger } from "hono-pino";

interface WorkerState {
  isRunning: boolean;
  currentDownloadId: number | null;
  lastProcessedAt: Date | null;
  processedCount: number;
  errorCount: number;
}

export class DownloadWorker {
  private state: WorkerState = {
    isRunning: false,
    currentDownloadId: null,
    lastProcessedAt: null,
    processedCount: 0,
    errorCount: 0,
  };

  private cleanupInterval: Timer | null = null;
  private stalledCheckInterval: Timer | null = null;
  private workerLoop: Promise<void> | null = null;
  private shouldStop = false;

  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly processDownload: ProcessDownload,
    private readonly cleanupOrphanedFiles: CleanupOrphanedFiles,
    private readonly markStalledDownloads: MarkStalledDownloads,
    private readonly logger: PinoLogger,
    private readonly pollIntervalMs: number = 2000,
    private readonly cleanupIntervalMs: number = 7 * 24 * 60 * 60 * 1000, // 7 days
    private readonly stalledCheckIntervalMs: number = 5 * 60 * 1000 // 5 minutes
  ) {}

  async start(): Promise<void> {
    if (this.state.isRunning) {
      this.logger.warn("Worker already running");
      return;
    }

    this.state.isRunning = true;
    this.shouldStop = false;
    this.logger.info("Starting download worker");

    // Start cleanup scheduler
    this.startCleanupScheduler();

    // Start stalled check scheduler
    this.startStalledCheckScheduler();

    // Start worker loop
    this.workerLoop = this.runLoop();
  }

  async stop(): Promise<void> {
    if (!this.state.isRunning) {
      this.logger.warn("Worker not running");
      return;
    }

    this.logger.info("Stopping download worker");
    this.shouldStop = true;

    // Stop schedulers
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.stalledCheckInterval) {
      clearInterval(this.stalledCheckInterval);
      this.stalledCheckInterval = null;
    }

    // Wait for current download to finish (with timeout)
    if (this.workerLoop) {
      await Promise.race([
        this.workerLoop,
        new Promise((resolve) => setTimeout(resolve, 30000)), // 30s timeout
      ]);
    }

    this.state.isRunning = false;
    this.state.currentDownloadId = null;
    this.logger.info("Download worker stopped");
  }

  getStatus(): WorkerState {
    return { ...this.state };
  }

  private async runLoop(): Promise<void> {
    this.logger.info("Worker loop started");

    while (!this.shouldStop) {
      try {
        // Try to get next pending download
        const nextDownload = await this.downloadRepo.findNextPending();

        if (!nextDownload) {
          // No pending downloads, wait before checking again
          await this.sleep(this.pollIntervalMs);
          continue;
        }

        // Process the download
        this.state.currentDownloadId = nextDownload.id;
        this.logger.info({ downloadId: nextDownload.id }, "Processing download");

        try {
          await this.processDownload.execute(nextDownload.id!);
          this.state.processedCount++;
          this.state.lastProcessedAt = new Date();
          this.logger.info(
            { downloadId: nextDownload.id, totalProcessed: this.state.processedCount },
            "Download processed successfully"
          );
        } catch (error) {
          this.state.errorCount++;
          this.logger.error(
            { error, downloadId: nextDownload.id, totalErrors: this.state.errorCount },
            "Download processing failed"
          );
        } finally {
          this.state.currentDownloadId = null;
        }

        // Small delay before next iteration
        await this.sleep(1000);
      } catch (error) {
        this.logger.error({ error }, "Worker loop error");
        // Wait before retrying to avoid tight error loop
        await this.sleep(5000);
      }
    }

    this.logger.info("Worker loop exited");
  }

  private startCleanupScheduler(): void {
    this.logger.info(
      { intervalMs: this.cleanupIntervalMs },
      "Starting cleanup scheduler"
    );

    // Run immediately on start
    this.runCleanup().catch((error) => {
      this.logger.error({ error }, "Initial cleanup failed");
    });

    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch((error) => {
        this.logger.error({ error }, "Scheduled cleanup failed");
      });
    }, this.cleanupIntervalMs);
  }

  private startStalledCheckScheduler(): void {
    this.logger.info(
      { intervalMs: this.stalledCheckIntervalMs },
      "Starting stalled check scheduler"
    );

    // Run immediately on start
    this.runStalledCheck().catch((error) => {
      this.logger.error({ error }, "Initial stalled check failed");
    });

    // Schedule periodic stalled check
    this.stalledCheckInterval = setInterval(() => {
      this.runStalledCheck().catch((error) => {
        this.logger.error({ error }, "Scheduled stalled check failed");
      });
    }, this.stalledCheckIntervalMs);
  }

  private async runCleanup(): Promise<void> {
    this.logger.info("Running cleanup job");
    try {
      const result = await this.cleanupOrphanedFiles.execute();
      this.logger.info(result, "Cleanup completed");
    } catch (error) {
      this.logger.error({ error }, "Cleanup job failed");
      throw error;
    }
  }

  private async runStalledCheck(): Promise<void> {
    this.logger.debug("Running stalled check");
    try {
      const count = await this.markStalledDownloads.execute();
      if (count > 0) {
        this.logger.info({ count }, "Marked stalled downloads");
      }
    } catch (error) {
      this.logger.error({ error }, "Stalled check failed");
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
