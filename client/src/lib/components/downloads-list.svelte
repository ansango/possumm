<script lang="ts">
	import { createInfiniteQuery } from '@tanstack/svelte-query';
	import type { DownloadsResponse, DownloadStatus } from '$lib/types/download';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import * as Alert from '$lib/components/ui/alert';
	import { Loader2 } from 'lucide-svelte';
	import DownloadItem from './download-item.svelte';
	import Separator from './ui/separator/separator.svelte';

	let {
		status,
		pageSize = 5,
		onclick
	}: {
		status?: DownloadStatus;
		pageSize?: number;
		onclick?: (downloadId: number) => void;
	} = $props();

	let scrollViewport = $state<HTMLDivElement | null>(null);

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
			const allDownloads = query.state.data?.pages.flatMap((page) => page.downloads) || [];
			const hasActiveDownloads = allDownloads.some(
				(download) =>
					download.status !== 'completed' &&
					download.status !== 'failed' &&
					download.status !== 'cancelled'
			);

			return hasActiveDownloads ? 5000 : false;
		},
		refetchIntervalInBackground: true
	}));

	function handleScroll() {
		if (!scrollViewport || downloadsQuery.isFetchingNextPage || !downloadsQuery.hasNextPage) return;

		const { scrollTop, scrollHeight, clientHeight } = scrollViewport;
		const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

		if (scrollPercentage > 0.8) {
			downloadsQuery.fetchNextPage();
		}
	}

	$effect(() => {
		if (scrollViewport) {
			scrollViewport.addEventListener('scroll', handleScroll);
			return () => scrollViewport?.removeEventListener('scroll', handleScroll);
		}
	});

	$effect(() => {
		const data = downloadsQuery.data;
		if (data) {
			void data;
		}
	});
</script>

<div class="mx-auto max-w-4xl space-y-4 p-4">
	{#if downloadsQuery.isLoading}
		<div class="flex items-center justify-center p-8">
			<Loader2 class="size-8 animate-spin text-muted-foreground" />
		</div>
	{:else if downloadsQuery.isError}
		<Alert.Root variant="destructive">
			<Alert.Title>Error loading downloads</Alert.Title>
			<Alert.Description>
				{downloadsQuery.error?.message || 'Failed to load downloads'}
			</Alert.Description>
		</Alert.Root>
	{:else if downloadsQuery.data}
		{@const allDownloads = downloadsQuery.data.pages.flatMap((page) => page.downloads)}
		{@const firstPage = downloadsQuery.data.pages[0]}

		<div class="flex items-center justify-between">
			<h2 class="text-2xl font-semibold tracking-tight">
				Downloads ({firstPage?.total || 0})
			</h2>
		</div>

		{#if allDownloads.length === 0}
			<div class="flex flex-col items-center justify-center rounded-lg border border-dashed p-8">
				<p class="text-sm text-muted-foreground">No downloads found</p>
			</div>
		{:else}
			<ScrollArea bind:viewportRef={scrollViewport} class="h-150 rounded-md border">
				<div class="space-y-2 p-4">
					{#each allDownloads as download (download.id)}
						<DownloadItem {download} onclick={() => onclick?.(download.id)} />
						<Separator class="my-2" />
					{/each}

					{#if downloadsQuery.isFetchingNextPage}
						<div class="flex items-center justify-center py-4">
							<Loader2 class="size-6 animate-spin text-muted-foreground" />
						</div>
					{/if}
				</div>
			</ScrollArea>
		{/if}
	{/if}
</div>
