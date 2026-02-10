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

export interface DownloadLog {
	id: number;
	downloadId: number;
	eventType: DownloadLogEventType;
	message: string;
	metadata: Record<string, object> | null;
	timestamp: string | null;
}

export interface DownloadLogsResponse {
	logs: DownloadLog[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}
