import { DownloadLog, DownloadLogEventType } from '../entities/download-log';

/**
 * Data required to create a download log entry.
 */
export type CreateDownloadLogData = {
	downloadId: number;
	eventType: DownloadLogEventType;
	message: string;
	metadata?: Record<string, any> | null;
};

/**
 * Repository contract for DownloadLog persistence.
 *
 * Domain layer - Defines interface for log operations.
 */
export interface DownloadLogRepository {
	/**
	 * Creates a new log entry.
	 */
	create(log: CreateDownloadLogData): Promise<void>;

	/**
	 * Finds logs for a specific download with pagination.
	 * Results ordered by timestamp DESC (newest first).
	 */
	findByDownloadId(downloadId: number, page: number, pageSize: number): Promise<DownloadLog[]>;

	/**
	 * Counts total logs for a download.
	 */
	countByDownloadId(downloadId: number): Promise<number>;

	/**
	 * Deletes logs older than specified days.
	 * Returns number of deleted logs.
	 */
	deleteOldLogs(days: number): Promise<number>;
}
