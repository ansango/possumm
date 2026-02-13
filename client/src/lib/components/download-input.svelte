<script lang="ts">
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Input } from '$lib/components/ui/input';
	import * as Alert from '$lib/components/ui/alert';
	import { LoaderCircle, CheckCircle2, AlertCircle } from 'lucide-svelte';

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
		onMutate: () => {
			isSubmitting = true;
			queryClient.cancelQueries({ queryKey: ['downloads'] });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['downloads'] });
			url = '';
		},
		onSettled: () => {
			isSubmitting = false;
		}
	}));

	async function handleSubmit(event: KeyboardEvent) {
		if (event.key === 'Enter' && url.trim() && !isSubmitting) {
			isSubmitting = true;
			try {
				await enqueueDownloadMutation.mutateAsync(url.trim());
			} catch (error) {
				console.error('Error enqueuing download:', error);
			}
		}
	}
</script>

<div class="space-y-4">
	<Input
		type="text"
		bind:value={url}
		onkeydown={handleSubmit}
		placeholder="Enter Bandcamp or YouTube Music URL and press Enter"
		disabled={isSubmitting}
	/>

	{#if enqueueDownloadMutation.isPending}
		<Alert.Root class="border-blue-200 bg-blue-50 text-blue-900">
			<LoaderCircle class="animate-spin" />
			<Alert.Title>Enqueuing download...</Alert.Title>
		</Alert.Root>
	{:else if enqueueDownloadMutation.isError}
		<Alert.Root variant="destructive">
			<AlertCircle />
			<Alert.Title>Error</Alert.Title>
			<Alert.Description>
				{enqueueDownloadMutation.error?.message || 'Failed to enqueue download'}
			</Alert.Description>
		</Alert.Root>
	{:else if enqueueDownloadMutation.isSuccess}
		<Alert.Root class="border-green-200 bg-green-50 text-green-900">
			<CheckCircle2 />
			<Alert.Title>Download enqueued successfully!</Alert.Title>
		</Alert.Root>
	{/if}
</div>
