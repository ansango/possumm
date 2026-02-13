import { createMutation, useQueryClient } from '@tanstack/svelte-query';

/**
 * Hook to enqueue a new download
 * @returns Mutation object for enqueuing downloads
 */
export function useEnqueueDownload() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async (downloadUrl: string) => {
			const response = await fetch('http://localhost:3000/api/downloads', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ url: downloadUrl })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || `Failed to enqueue download: ${response.statusText}`);
			}

			return response.json();
		},
		onMutate: () => {
			queryClient.cancelQueries({ queryKey: ['downloads'] });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['downloads'] });
		}
	}));
}
