<script lang="ts">
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';

	let url = $state('');
	let isSubmitting = $state(false);

	const queryClient = useQueryClient();

	const enqueueDownloadMutation = createMutation(() => ({
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
		onSuccess: () => {
			// Revalidar las descargas
			queryClient.invalidateQueries({ queryKey: ['downloads'] });
			// Limpiar el input
			url = '';
		}
	}));

	async function handleSubmit(event: KeyboardEvent) {
		if (event.key === 'Enter' && url.trim() && !isSubmitting) {
			isSubmitting = true;
			try {
				await enqueueDownloadMutation.mutateAsync(url.trim());
			} catch (error) {
				console.error('Error enqueuing download:', error);
			} finally {
				isSubmitting = false;
			}
		}
	}
</script>

<div class="download-input-container">
	<input
		type="text"
		bind:value={url}
		onkeydown={handleSubmit}
		placeholder="Enter Bandcamp or YouTube Music URL and press Enter"
		class="url-input"
		disabled={isSubmitting}
	/>

	{#if enqueueDownloadMutation.isPending}
		<div class="status-message loading">Enqueuing download...</div>
	{:else if enqueueDownloadMutation.isError}
		<div class="status-message error">
			Error: {enqueueDownloadMutation.error?.message || 'Failed to enqueue download'}
		</div>
	{:else if enqueueDownloadMutation.isSuccess}
		<div class="status-message success">Download enqueued successfully!</div>
	{/if}
</div>

<style>
	.download-input-container {
		margin-bottom: 1rem;
	}

	.url-input {
		width: 100%;
		padding: 0.75rem;
		font-size: 1rem;
		border: 2px solid #ddd;
		border-radius: 8px;
		transition: border-color 0.2s;
	}

	.url-input:focus {
		outline: none;
		border-color: #4caf50;
	}

	.url-input:disabled {
		background-color: #f5f5f5;
		cursor: not-allowed;
	}

	.status-message {
		margin-top: 0.5rem;
		padding: 0.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.status-message.loading {
		background-color: #dbeafe;
		color: #1e40af;
	}

	.status-message.error {
		background-color: #fee2e2;
		color: #991b1b;
	}

	.status-message.success {
		background-color: #d1fae5;
		color: #065f46;
	}
</style>
