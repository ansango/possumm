/**
 * Event types for download logs.
 */
export type DownloadLogEventType =
	| 'download:enqueued'
	| 'download:started'
	| 'download:progress'
	| 'download:completed'
	| 'download:failed'
	| 'download:cancelled'
	| 'download:stalled'
	| 'storage:low'
	| 'metadata:fetching'
	| 'metadata:found';

/**
 * Download log entity representing a step in the download process.
 *
 * Domain layer - Immutable log entry for download lifecycle events.
 * Provides human-readable messages for UI display.
 */
export class DownloadLog {
	constructor(
		public readonly id: number,
		public readonly downloadId: number,
		public readonly eventType: DownloadLogEventType,
		public readonly message: string,
		public readonly metadata: Record<string, any> | null,
		public readonly timestamp: Date
	) {}

	/**
	 * Creates DownloadLog from database row.
	 */
	static fromDatabase(row: any): DownloadLog {
		return new DownloadLog(
			row.id,
			row.download_id,
			row.event_type as DownloadLogEventType,
			row.message,
			row.metadata ? JSON.parse(row.metadata) : null,
			new Date(row.timestamp)
		);
	}
}
