import { createQuery } from '@tanstack/svelte-query';
import type { Download } from '$lib/types/download';

/**
 * Hook to fetch a single download by ID with automatic refetching for active downloads
 * @param downloadId - The ID of the download to fetch
 * @returns Query object with download data
 */
export function useDownload(downloadId: number) {
  return createQuery(() => ({
    queryKey: ['download', downloadId],
    queryFn: async (): Promise<{ download: Download }> => {
      const response = await fetch(`/api/downloads/${downloadId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch download: ${response.statusText}`);
      }

      return response.json();
    },
    refetchInterval: (query) => {
      const download = query.state.data?.download;
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
