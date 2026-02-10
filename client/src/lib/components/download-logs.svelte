<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import type { DownloadLogsResponse } from '$lib/types/download-log';

	let {
		downloadId,
		page = 1,
		limit = 50
	}: { downloadId: number; page?: number; limit?: number } = $props();

	let logContainer = $state<HTMLDivElement>();

	const logsQuery = createQuery(() => ({
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
		refetchInterval: 5000, // Poll every 5 seconds
		refetchIntervalInBackground: true
	}));

	$effect(() => {
		const data = logsQuery.data;
		if (data && logContainer) {
			logContainer.scrollTop = logContainer.scrollHeight;
		}
	});
</script>

<div class="download-logs">
	{#if logsQuery.isLoading}
		<div class="loading">Loading logs...</div>
	{:else if logsQuery.isError}
		<div class="error">
			Error: {logsQuery.error?.message || 'Failed to load logs'}
		</div>
	{:else if logsQuery.data}
		<div class="logs-header">
			<h3>Download Logs #{downloadId}</h3>
			<span class="logs-count">
				{logsQuery.data.pagination.total} logs
			</span>
		</div>

		<div class="logs-container" bind:this={logContainer}>
			{#if logsQuery.data.logs.length === 0}
				<div class="empty-state">No logs yet</div>
			{:else}
				{#each logsQuery.data.logs as log (log.id)}
					<div class="log-entry" data-event-type={log.eventType}>
						<div class="log-header">
							<span class="log-event-type">{log.eventType}</span>
							{#if log.timestamp}
								<span class="log-timestamp">
									{new Date(log.timestamp).toLocaleString()}
								</span>
							{/if}
						</div>
						<div class="log-message">{log.message}</div>
						{#if log.metadata}
							<details class="log-metadata">
								<summary>Metadata</summary>
								<pre>{JSON.stringify(log.metadata, null, 2)}</pre>
							</details>
						{/if}
					</div>
				{/each}
			{/if}
		</div>

		{#if logsQuery.data.pagination.totalPages > 1}
			<div class="pagination-info">
				Page {logsQuery.data.pagination.page} of {logsQuery.data.pagination.totalPages}
			</div>
		{/if}
	{/if}
</div>

<style>
	.download-logs {
		background: white;
		border: 2px solid #e5e7eb;
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1rem;
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

	.logs-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 2px solid #e5e7eb;
	}

	.logs-header h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: #333;
		margin: 0;
	}

	.logs-count {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.logs-container {
		max-height: 400px;
		overflow-y: auto;
		padding: 0.5rem;
		background-color: #f9fafb;
		border-radius: 4px;
	}

	.log-entry {
		background: white;
		border-left: 3px solid #9ca3af;
		border-radius: 4px;
		padding: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.log-entry[data-event-type='download:enqueued'] {
		border-left-color: #3b82f6;
	}

	.log-entry[data-event-type='download:started'] {
		border-left-color: #8b5cf6;
	}

	.log-entry[data-event-type='download:progress'] {
		border-left-color: #06b6d4;
	}

	.log-entry[data-event-type='download:completed'] {
		border-left-color: #10b981;
	}

	.log-entry[data-event-type='download:failed'] {
		border-left-color: #ef4444;
	}

	.log-entry[data-event-type='download:cancelled'] {
		border-left-color: #6b7280;
	}

	.log-entry[data-event-type='download:stalled'] {
		border-left-color: #f59e0b;
	}

	.log-entry[data-event-type='metadata:fetching'],
	.log-entry[data-event-type='metadata:found'] {
		border-left-color: #ec4899;
	}

	.log-entry[data-event-type='storage:low'] {
		border-left-color: #dc2626;
	}

	.log-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.log-event-type {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		color: #4b5563;
		background-color: #f3f4f6;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.log-timestamp {
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.log-message {
		font-size: 0.875rem;
		color: #1f2937;
		word-break: break-word;
	}

	.log-metadata {
		margin-top: 0.5rem;
		font-size: 0.75rem;
	}

	.log-metadata summary {
		cursor: pointer;
		color: #6b7280;
		font-weight: 500;
	}

	.log-metadata pre {
		margin-top: 0.5rem;
		padding: 0.5rem;
		background-color: #f3f4f6;
		border-radius: 4px;
		overflow-x: auto;
		font-family: monospace;
		font-size: 0.75rem;
	}

	.pagination-info {
		margin-top: 0.75rem;
		text-align: center;
		font-size: 0.875rem;
		color: #6b7280;
	}
</style>
