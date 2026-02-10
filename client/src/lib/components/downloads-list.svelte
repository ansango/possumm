<script lang="ts">
	import { createInfiniteQuery } from '@tanstack/svelte-query';
	import type { DownloadsResponse, DownloadStatus } from '$lib/types/download';

	let {
		status,
		pageSize = 20,
		onclick
	}: {
		status?: DownloadStatus;
		pageSize?: number;
		onclick?: (downloadId: number) => void;
	} = $props();

	let scrollContainer = $state<HTMLDivElement>();

	const downloadsQuery = createInfiniteQuery(() => ({
		queryKey: ['downloads', { status, pageSize }],
		queryFn: async ({ pageParam }): Promise<DownloadsResponse> => {
			let url = `http://localhost:3000/api/downloads?page=${pageParam}&pageSize=${pageSize}`;

			if (status) {
				url += `&status=${status}`;
			}

			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`Failed to fetch downloads: ${response.statusText}`);
			}

			return response.json();
		},
		initialPageParam: 0,
		getNextPageParam: (lastPage) => {
			const nextPage = lastPage.page + 1;
			const totalPages = Math.ceil(lastPage.total / lastPage.pageSize);
			return nextPage < totalPages ? nextPage : undefined;
		},
		refetchInterval: (query) => {
			// Check if there are any active downloads (not completed, failed, or cancelled)
			const allDownloads = query.state.data?.pages.flatMap((page) => page.downloads) || [];
			const hasActiveDownloads = allDownloads.some(
				(download) =>
					download.status !== 'completed' &&
					download.status !== 'failed' &&
					download.status !== 'cancelled'
			);

			// Only refetch if there are active downloads
			return hasActiveDownloads ? 5000 : false;
		},
		refetchIntervalInBackground: true
	}));

	function handleScroll() {
		if (!scrollContainer || downloadsQuery.isFetchingNextPage || !downloadsQuery.hasNextPage)
			return;

		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

		if (scrollPercentage > 0.8) {
			downloadsQuery.fetchNextPage();
		}
	}

	$effect(() => {
		if (scrollContainer) {
			scrollContainer.addEventListener('scroll', handleScroll);
			return () => scrollContainer?.removeEventListener('scroll', handleScroll);
		}
	});

	$effect(() => {
		const data = downloadsQuery.data;
		if (data) {
			void data;
		}
	});
</script>

<div class="downloads-list">
	{#if downloadsQuery.isLoading}
		<div class="loading">Loading downloads...</div>
	{:else if downloadsQuery.isError}
		<div class="error">
			Error: {downloadsQuery.error?.message || 'Failed to load downloads'}
		</div>
	{:else if downloadsQuery.data}
		{@const allDownloads = downloadsQuery.data.pages.flatMap((page) => page.downloads)}
		{@const firstPage = downloadsQuery.data.pages[0]}

		<div class="downloads-header">
			<h2>Downloads ({firstPage?.total || 0})</h2>
		</div>

		{#if allDownloads.length === 0}
			<div class="empty-state">No downloads found</div>
		{:else}
			<div class="downloads-grid" bind:this={scrollContainer}>
				{#each allDownloads as download (download.id)}
					<button
						class="download-card"
						data-status={download.status}
						onclick={() => onclick?.(download.id)}
						type="button"
					>
						<div class="download-header">
							<span class="download-id">#{download.id}</span>
							<span class="download-status status-{download.status}">{download.status}</span>
						</div>

						<div class="download-url">{download.url}</div>

						{#if download.status === 'downloading' || download.status === 'pending'}
							<div class="progress-bar">
								<div class="progress-fill" style="width: {download.progress}%"></div>
								<span class="progress-text">{download.progress}%</span>
							</div>
						{/if}

						{#if download.errorMessage}
							<div class="error-message">{download.errorMessage}</div>
						{/if}

						{#if download.filePath}
							<div class="file-path">{download.filePath}</div>
						{/if}

						<div class="download-dates">
							{#if download.createdAt}
								<span>Created: {new Date(download.createdAt).toLocaleString()}</span>
							{/if}
							{#if download.startedAt}
								<span>Started: {new Date(download.startedAt).toLocaleString()}</span>
							{/if}
							{#if download.finishedAt}
								<span>Finished: {new Date(download.finishedAt).toLocaleString()}</span>
							{/if}
						</div>
					</button>
				{/each}

				{#if downloadsQuery.isFetchingNextPage}
					<div class="loading-more">Loading more...</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.downloads-list {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem;
	}

	.loading,
	.error,
	.empty-state {
		text-align: center;
		padding: 2rem;
		color: #666;
	}

	.error {
		color: #dc2626;
		background-color: #fee;
		border-radius: 8px;
	}

	.downloads-header {
		margin-bottom: 1.5rem;
	}

	.downloads-header h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: #333;
	}

	.downloads-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-height: 500px;
		overflow-y: auto;
	}

	.download-card {
		width: 100%;
		background: white;
		border: 2px solid #e5e7eb;
		border-radius: 8px;
		padding: 1rem;
		transition: all 0.2s;
		cursor: pointer;
		text-align: left;
		font: inherit;
	}

	.download-card:hover {
		border-color: #9ca3af;
		transform: translateY(-2px);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	}

	.download-card[data-status='completed'] {
		border-color: #10b981;
	}

	.download-card[data-status='failed'] {
		border-color: #ef4444;
	}

	.download-card[data-status='downloading'] {
		border-color: #3b82f6;
	}

	.download-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.download-id {
		font-weight: 600;
		color: #6b7280;
	}

	.download-status {
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 500;
		text-transform: capitalize;
	}

	.status-pending {
		background-color: #fef3c7;
		color: #92400e;
	}

	.status-downloading {
		background-color: #dbeafe;
		color: #1e40af;
	}

	.status-completed {
		background-color: #d1fae5;
		color: #065f46;
	}

	.status-failed {
		background-color: #fee2e2;
		color: #991b1b;
	}

	.status-cancelled {
		background-color: #f3f4f6;
		color: #374151;
	}

	.status-stalled {
		background-color: #fef3c7;
		color: #92400e;
	}

	.download-url {
		font-size: 0.875rem;
		color: #4b5563;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-bottom: 0.75rem;
	}

	.progress-bar {
		position: relative;
		height: 24px;
		background-color: #f3f4f6;
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 0.75rem;
	}

	.progress-fill {
		height: 100%;
		background-color: #3b82f6;
		transition: width 0.3s ease;
	}

	.progress-text {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-size: 0.75rem;
		font-weight: 600;
		color: #1f2937;
	}

	.error-message {
		padding: 0.5rem;
		background-color: #fee2e2;
		color: #991b1b;
		border-radius: 4px;
		font-size: 0.875rem;
		margin-bottom: 0.75rem;
	}

	.file-path {
		font-size: 0.75rem;
		color: #6b7280;
		font-family: monospace;
		margin-bottom: 0.75rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.download-dates {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.pagination {
		margin-top: 1.5rem;
		text-align: center;
		color: #6b7280;
	}

	.loading-more {
		text-align: center;
		padding: 1rem;
		color: #6b7280;
		font-size: 0.875rem;
	}
</style>
