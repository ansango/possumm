<script lang="ts">
	import DownloadsList from '$lib/components/downloads-list.svelte';

	let url = $state('');
	let logs = $state<string[]>([]);
	let isLoading = $state(false);
	let logContainer: HTMLDivElement;
	const backendUrl = 'http://localhost:3000/download?url=';

	async function handleSubmit(event: KeyboardEvent) {
		if (event.key === 'Enter' && url.trim()) {
			isLoading = true;
			logs = [];

			try {
				// Use local proxy to avoid CORS issues
				const proxyUrl = `/api/proxy?url=${encodeURIComponent(backendUrl + encodeURIComponent(url))}`;
				const response = await fetch(proxyUrl);
				
				if (!response.ok) {
					logs = [...logs, `Error: ${response.status} ${response.statusText}`];
					isLoading = false;
					return;
				}

				if (!response.body) {
					logs = [...logs, 'Error: Response body is empty'];
					isLoading = false;
					return;
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder();

				while (true) {
					const { done, value } = await reader.read();
					
					if (done) {
						isLoading = false;
						break;
					}

					const text = decoder.decode(value, { stream: true });
					const lines = text.split('\n');
					
					for (const line of lines) {
						if (line.trim()) {
							logs = [...logs, line];
						}
					}
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				logs = [...logs, `Error: ${errorMessage}`];
				isLoading = false;
			}
		}
	}

	$effect(() => {
		// Track logs array for changes
		void logs.length;
		if (logContainer) {
			logContainer.scrollTop = logContainer.scrollHeight;
		}
	});
</script>

<div class="container">
	<h1>SSE Logger</h1>
	
	<input
		type="text"
		bind:value={url}
		onkeydown={handleSubmit}
		placeholder="Enter YouTube URL and press Enter"
		class="url-input"
	/>

	<div class="log-container" bind:this={logContainer}>
		{#each logs as log, index (index)}
			<div class="log-entry">{log}</div>
		{:else}
			<div class="empty-state">
				{#if isLoading}
					Loading...
				{:else}
					No logs yet. Enter a URL and press Enter to start.
				{/if}
			</div>
		{/each}
	</div>

	<DownloadsList />
</div>

<style>
	.container {
		max-width: 800px;
		margin: 2rem auto;
		padding: 1rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	h1 {
		margin-bottom: 1.5rem;
		font-size: 2rem;
		color: #333;
	}

	.url-input {
		width: 100%;
		padding: 0.75rem;
		font-size: 1rem;
		border: 2px solid #ddd;
		border-radius: 8px;
		margin-bottom: 1rem;
		transition: border-color 0.2s;
	}

	.url-input:focus {
		outline: none;
		border-color: #4CAF50;
	}

	.log-container {
		height: 400px;
		overflow-y: auto;
		border: 2px solid #ddd;
		border-radius: 8px;
		padding: 1rem;
		background-color: #f9f9f9;
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
	}

	.log-entry {
		padding: 0.5rem;
		margin-bottom: 0.25rem;
		background-color: white;
		border-left: 3px solid #4CAF50;
		border-radius: 4px;
		word-break: break-all;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #999;
		font-style: italic;
	}
</style>
