import { DownloadRepository } from '@/core/domain/download/repositories/download-repository';
import { ProcessDownload } from '../use-cases/ProcessDownload';
import { CleanupOrphanedFiles } from '../use-cases/CleanupOrphanedFiles';
import { CleanupOldLogs } from '../use-cases/CleanupOldLogs';
import { MarkStalledDownloads } from '../use-cases/MarkStalledDownloads';
import type { PinoLogger } from 'hono-pino';

/**
 * Worker state for monitoring and health checks.
 */
interface WorkerState {
	/** Whether worker loop is currently running */
	isRunning: boolean;
	/** ID of download currently being processed (null if idle) */
	currentDownloadId: number | null;
	/** Timestamp of last successful download processing */
	lastProcessedAt: Date | null;
	/** Total number of downloads processed successfully */
	processedCount: number;
	/** Total number of processing errors encountered */
	errorCount: number;
}

/**
 * Background worker for automated download processing.
 *
 * Application layer - Long-running worker that polls for pending downloads
 * and processes them using FIFO queue strategy.
 *
 * Features:
 * - FIFO download queue (oldest pending first)
 * - Configurable poll interval (default 2s)
 * - Graceful shutdown with 30s timeout
 * - Periodic cleanup job (default 7 days)
 * - Periodic stalled check (default 5 minutes)
 * - State tracking for monitoring
 *
 * Architecture:
 * - Main loop polls for pending downloads
 * - Delegates to ProcessDownload use case for execution
 * - Schedulers run cleanup and stalled checks independently
 * - All operations logged for observability
 *
 * Error handling:
 * - Individual download failures don't stop worker
 * - Loop errors trigger 5s backoff before retry
 * - Scheduler failures logged but don't stop schedulers
 *
 * @example
 * ```typescript
 * const worker = new DownloadWorker(
 *   downloadRepo,
 *   processDownload,
 *   cleanupOrphanedFiles,
 *   markStalledDownloads,
 *   logger,
 *   2000,  // Poll every 2s
 *   7 * 24 * 60 * 60 * 1000,  // Cleanup every 7 days
 *   5 * 60 * 1000  // Stalled check every 5min
 * );
 *
 * // Start worker
 * await worker.start();
 * // Starts main loop, cleanup scheduler, and stalled check scheduler
 *
 * // Check status
 * const status = worker.getStatus();
 * // Returns: {
 * //   isRunning: true,
 * //   currentDownloadId: 42,
 * //   lastProcessedAt: 2024-01-15T10:30:00Z,
 * //   processedCount: 150,
 * //   errorCount: 5
 * // }
 *
 * // Graceful shutdown
 * await worker.stop();
 * // Waits for current download (max 30s) then stops
 * ```
 */
export class DownloadWorker {
	private state: WorkerState = {
		isRunning: false,
		currentDownloadId: null,
		lastProcessedAt: null,
		processedCount: 0,
		errorCount: 0
	};

	private cleanupInterval: Timer | null = null;
	private stalledCheckInterval: Timer | null = null;
	private workerLoop: Promise<void> | null = null;
	private shouldStop = false;

	/**
	 * Creates a new DownloadWorker.
	 *
	 * @param downloadRepo - Download repository for queue polling
	 * @param processDownload - Use case for download execution
	 * @param cleanupOrphanedFiles - Use case for periodic cleanup
	 * @param cleanupOldLogs - Use case for periodic log cleanup
	 * @param markStalledDownloads - Use case for stalled detection
	 * @param logger - Logger for structured logging
	 * @param pollIntervalMs - Queue poll interval (default 2000ms)
	 * @param cleanupIntervalMs - Cleanup job interval (default 7 days)
	 * @param stalledCheckIntervalMs - Stalled check interval (default 5 minutes)
	 */
	constructor(
		private readonly downloadRepo: DownloadRepository,
		private readonly processDownload: ProcessDownload,
		private readonly cleanupOrphanedFiles: CleanupOrphanedFiles,
		private readonly cleanupOldLogs: CleanupOldLogs,
		private readonly markStalledDownloads: MarkStalledDownloads,
		private readonly logger: PinoLogger,
		private readonly pollIntervalMs: number = 2000,
		private readonly cleanupIntervalMs: number = 7 * 24 * 60 * 60 * 1000, // 7 days
		private readonly stalledCheckIntervalMs: number = 5 * 60 * 1000 // 5 minutes
	) {}

	/**
	 * Starts the worker and all schedulers.
	 *
	 * Flow:
	 * 1. Checks if already running (prevents double-start)
	 * 2. Sets state to running
	 * 3. Starts cleanup scheduler (immediate + periodic)
	 * 4. Starts stalled check scheduler (immediate + periodic)
	 * 5. Starts main worker loop
	 *
	 * Idempotent - multiple calls are safe (logs warning if already running).
	 * Cleanup and stalled checks run immediately on start, then periodically.
	 *
	 * @example
	 * ```typescript
	 * await worker.start();
	 * // Worker now polling for downloads every 2s
	 * // Cleanup runs immediately, then every 7 days
	 * // Stalled check runs immediately, then every 5 minutes
	 * ```
	 */
	async start(): Promise<void> {
		if (this.state.isRunning) {
			this.logger.warn('Worker already running');
			return;
		}

		this.state.isRunning = true;
		this.shouldStop = false;
		this.logger.info('Starting download worker');

		// Start cleanup scheduler
		this.startCleanupScheduler();

		// Start stalled check scheduler
		this.startStalledCheckScheduler();

		// Start worker loop
		this.workerLoop = this.runLoop();
	}

	/**
	 * Stops the worker gracefully.
	 *
	 * Flow:
	 * 1. Checks if running (logs warning if not)
	 * 2. Signals worker loop to stop
	 * 3. Stops cleanup scheduler
	 * 4. Stops stalled check scheduler
	 * 5. Waits for current download to finish (max 30s timeout)
	 * 6. Clears state
	 *
	 * Graceful shutdown - waits for in-progress download up to 30 seconds.
	 * After timeout, worker stops regardless (download continues in background).
	 *
	 * Idempotent - multiple calls are safe (logs warning if not running).
	 *
	 * @example
	 * ```typescript
	 * // Graceful shutdown
	 * await worker.stop();
	 * // Waits for current download (max 30s)
	 * // All schedulers stopped
	 * // State cleared
	 *
	 * // In-progress download continues in background if timeout reached
	 * ```
	 */
	async stop(): Promise<void> {
		if (!this.state.isRunning) {
			this.logger.warn('Worker not running');
			return;
		}

		this.logger.info('Stopping download worker');
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
				new Promise((resolve) => setTimeout(resolve, 30000)) // 30s timeout
			]);
		}

		this.state.isRunning = false;
		this.state.currentDownloadId = null;
		this.logger.info('Download worker stopped');
	}

	/**
	 * Returns current worker state (for monitoring/health checks).
	 *
	 * Returns a copy of state object to prevent external mutation.
	 *
	 * @returns Current worker state
	 *
	 * @example
	 * ```typescript
	 * const status = worker.getStatus();
	 * // Returns: {
	 * //   isRunning: true,
	 * //   currentDownloadId: 42,
	 * //   lastProcessedAt: 2024-01-15T10:30:00Z,
	 * //   processedCount: 150,
	 * //   errorCount: 5
	 * // }
	 *
	 * // Use for health endpoint:
	 * // GET /api/worker/status -> worker.getStatus()
	 * ```
	 */
	getStatus(): WorkerState {
		return { ...this.state };
	}

	/**
	 * Main worker loop - polls for pending downloads and processes them.
	 *
	 * Flow:
	 * 1. Poll for next pending download (oldest first)
	 * 2. If none found, sleep pollIntervalMs and retry
	 * 3. If found, process via ProcessDownload use case
	 * 4. Update state (processedCount or errorCount)
	 * 5. Sleep 1s before next iteration
	 * 6. Repeat until shouldStop flag set
	 *
	 * FIFO queue strategy - oldest pending downloads processed first.
	 * Individual download failures don't stop loop - logged and counted.
	 * Loop errors trigger 5s backoff to avoid tight error loops.
	 *
	 * Private method - called by start(), runs until stop() sets shouldStop.
	 */
	private async runLoop(): Promise<void> {
		this.logger.info('Worker loop started');

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
				this.logger.info({ downloadId: nextDownload.id }, 'Processing download');

				try {
					await this.processDownload.execute(nextDownload.id!);
					this.state.processedCount++;
					this.state.lastProcessedAt = new Date();
					this.logger.info(
						{ downloadId: nextDownload.id, totalProcessed: this.state.processedCount },
						'Download processed successfully'
					);
				} catch (error) {
					this.state.errorCount++;
					this.logger.error(
						{ error, downloadId: nextDownload.id, totalErrors: this.state.errorCount },
						'Download processing failed'
					);
				} finally {
					this.state.currentDownloadId = null;
				}

				// Small delay before next iteration
				await this.sleep(1000);
			} catch (error) {
				this.logger.error({ error }, 'Worker loop error');
				// Wait before retrying to avoid tight error loop
				await this.sleep(5000);
			}
		}

		this.logger.info('Worker loop exited');
	}

	private startCleanupScheduler(): void {
		this.logger.info({ intervalMs: this.cleanupIntervalMs }, 'Starting cleanup scheduler');

		// Run immediately on start
		this.runCleanup().catch((error) => {
			this.logger.error({ error }, 'Initial cleanup failed');
		});

		// Schedule periodic cleanup
		this.cleanupInterval = setInterval(() => {
			this.runCleanup().catch((error) => {
				this.logger.error({ error }, 'Scheduled cleanup failed');
			});
		}, this.cleanupIntervalMs);
	}

	private startStalledCheckScheduler(): void {
		this.logger.info(
			{ intervalMs: this.stalledCheckIntervalMs },
			'Starting stalled check scheduler'
		);

		// Run immediately on start
		this.runStalledCheck().catch((error) => {
			this.logger.error({ error }, 'Initial stalled check failed');
		});

		// Schedule periodic stalled check
		this.stalledCheckInterval = setInterval(() => {
			this.runStalledCheck().catch((error) => {
				this.logger.error({ error }, 'Scheduled stalled check failed');
			});
		}, this.stalledCheckIntervalMs);
	}

	private async runCleanup(): Promise<void> {
		this.logger.info('Running cleanup job');
		try {
			// Cleanup orphaned files
			const fileCleanupResult = await this.cleanupOrphanedFiles.execute();
			this.logger.info(fileCleanupResult, 'File cleanup completed');

			// Cleanup old logs
			const deletedLogs = await this.cleanupOldLogs.execute();
			this.logger.info({ deletedLogs }, 'Log cleanup completed');
		} catch (error) {
			this.logger.error({ error }, 'Cleanup job failed');
			throw error;
		}
	}

	private async runStalledCheck(): Promise<void> {
		this.logger.debug('Running stalled check');
		try {
			const count = await this.markStalledDownloads.execute();
			if (count > 0) {
				this.logger.info({ count }, 'Marked stalled downloads');
			}
		} catch (error) {
			this.logger.error({ error }, 'Stalled check failed');
			throw error;
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
