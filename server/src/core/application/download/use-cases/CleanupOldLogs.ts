import { DownloadLogRepository } from '@/core/domain/download/repositories/download-log-repository';
import type { PinoLogger } from 'hono-pino';

/**
 * Use case for cleaning up old download logs.
 *
 * Application layer - Scheduled maintenance job for log retention.
 *
 * Deletes logs older than the configured retention period (default 90 days).
 * This prevents unbounded growth of the job_logs table while maintaining
 * recent history for debugging and user visibility.
 *
 * Designed to be run periodically by DownloadWorker (e.g., daily).
 */
export class CleanupOldLogs {
	/**
	 * Creates a new CleanupOldLogs use case.
	 *
	 * @param downloadLogRepo - Repository for log deletion
	 * @param logger - Logger for structured logging
	 * @param retentionDays - Number of days to retain logs (default: 90)
	 */
	constructor(
		private readonly downloadLogRepo: DownloadLogRepository,
		private readonly logger: PinoLogger,
		private readonly retentionDays: number = 90
	) {}

	/**
	 * Deletes logs older than retention period.
	 *
	 * Flow:
	 * 1. Calls repository to delete logs older than retentionDays
	 * 2. Logs count of deleted records
	 * 3. Returns count for monitoring
	 *
	 * Uses SQLite's datetime() function for efficient date comparison.
	 * Deletion is done in a single transaction for consistency.
	 *
	 * @returns Number of log entries deleted
	 *
	 * @example
	 * ```typescript
	 * const cleanupOldLogs = new CleanupOldLogs(downloadLogRepo, logger, 90);
	 *
	 * // Delete logs older than 90 days
	 * const deletedCount = await cleanupOldLogs.execute();
	 * console.log(`Deleted ${deletedCount} old log entries`);
	 *
	 * // Custom retention period (30 days)
	 * const cleanup30 = new CleanupOldLogs(downloadLogRepo, logger, 30);
	 * await cleanup30.execute();
	 * ```
	 */
	async execute(): Promise<number> {
		try {
			this.logger.info({ retentionDays: this.retentionDays }, 'Cleaning up old logs');

			const deletedCount = await this.downloadLogRepo.deleteOldLogs(this.retentionDays);

			this.logger.info({ deletedCount, retentionDays: this.retentionDays }, 'Cleaned up old logs');

			return deletedCount;
		} catch (error) {
			this.logger.error({ error, retentionDays: this.retentionDays }, 'Failed to cleanup old logs');
			throw error;
		}
	}
}
