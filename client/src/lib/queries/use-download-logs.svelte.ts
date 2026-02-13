import { createQuery } from '@tanstack/svelte-query';
import type { DownloadLogsResponse } from '$lib/types/download-log';
import type { Download } from '$lib/types/download';

interface UseDownloadLogsOptions {
	downloadId: number;
	page?: number;
	limit?: number;
	download?: Download;
}

/**
 * Hook to fetch download logs with pagination and automatic refetching for active downloads
 * @param options - Configuration options including downloadId, page, limit, and optional download status
 * @returns Query object with download logs data
 */
export function useDownloadLogs({
	downloadId,
	page = 1,
	limit = 50,
	download
}: UseDownloadLogsOptions) {
	return createQuery(() => ({
		queryKey: ['download-logs', downloadId, { page, limit }],
		queryFn: async (): Promise<DownloadLogsResponse> => {
			const response = await fetch(
				`http://localhost:3000/api/downloads/${downloadId}/logs?page=${page}&limit=${limit}`
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch logs: ${response.statusText}`);
			}

			return response.json();
		},
		refetchInterval: () => {
			// Only refetch if status is not completed, failed, or cancelled
			if (
				download &&
				download.status !== 'completed' &&
				download.status !== 'failed' &&
				download.status !== 'cancelled'
			) {
				return 5000;
			}
			return false;
		},
		refetchIntervalInBackground: true
	}));
}
