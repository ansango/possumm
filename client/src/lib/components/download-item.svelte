<script lang="ts">
	import * as Item from '$lib/components/ui/item';
	import { Progress } from '$lib/components/ui/progress';
	import { Button } from '$lib/components/ui/button';
	import {
		Clock,
		Download as DownloadIcon,
		CheckCircle2,
		XCircle,
		Ban,
		Loader2,
		FolderOpen,
		RotateCw,
		Music
	} from 'lucide-svelte';
	import type { Download } from '$lib/types/download';

	let { download, onclick }: { download: Download; onclick?: () => void } = $props();

	function getStatusIcon(status: Download['status']) {
		switch (status) {
			case 'pending':
				return Clock;
			case 'downloading':
				return DownloadIcon;
			case 'completed':
				return CheckCircle2;
			case 'failed':
				return XCircle;
			case 'cancelled':
				return Ban;
			case 'stalled':
				return Loader2;
			default:
				return Clock;
		}
	}

	function getStatusColor(status: Download['status']) {
		switch (status) {
			case 'pending':
				return 'text-yellow-500';
			case 'downloading':
				return 'text-blue-500';
			case 'completed':
				return 'text-green-500';
			case 'failed':
				return 'text-destructive';
			case 'cancelled':
				return 'text-muted-foreground';
			case 'stalled':
				return 'text-orange-500';
			default:
				return 'text-muted-foreground';
		}
	}

	function extractTitle(url: string): string {
		try {
			const urlObj = new URL(url);
			const pathParts = urlObj.pathname.split('/').filter(Boolean);
			return pathParts[pathParts.length - 1] || url;
		} catch {
			return url;
		}
	}

	function extractArtist(url: string): string {
		try {
			const urlObj = new URL(url);
			if (urlObj.hostname.includes('bandcamp')) {
				return urlObj.hostname.split('.')[0];
			}
			return urlObj.hostname;
		} catch {
			return 'Unknown';
		}
	}

	const StatusIcon = $derived(getStatusIcon(download.status));
	const statusColor = $derived(getStatusColor(download.status));
	const title = $derived(extractTitle(download.url));
	const artist = $derived(extractArtist(download.url));
	const showProgress = $derived(download.status === 'downloading' || download.status === 'pending');
</script>

<Item.Root variant="outline" class="transition-all hover:bg-accent/50">
	{#snippet child({ props })}
		<button type="button" {onclick} {...props} class="flex w-full items-center gap-4">
			<Item.Media>
				<div
					class="flex size-16 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-primary/20 to-primary/5"
				>
					<Music class="size-8 text-primary" />
				</div>
			</Item.Media>

			<Item.Content class="min-w-0 flex-1">
				<Item.Title class="truncate text-base font-semibold">{title}</Item.Title>
				<Item.Description class="truncate text-sm text-muted-foreground">
					{artist}
				</Item.Description>
			</Item.Content>

			<Item.Actions class="flex shrink-0 items-center gap-3">
				{#if showProgress}
					<div class="flex min-w-24 flex-col items-end gap-1">
						<span class="text-sm font-medium text-foreground">{download.progress}%</span>
						<Progress value={download.progress} max={100} class="h-1 w-24" />
					</div>
				{:else if download.status === 'completed'}
					<span class="text-sm font-semibold text-green-500">100%</span>
				{:else if download.status === 'failed'}
					<span class="text-sm font-semibold text-destructive">Failed</span>
				{/if}

				<div class="flex items-center gap-1">
					{#if download.status === 'completed'}
						<Button variant="ghost" size="icon" class="size-8">
							<FolderOpen class="size-4" />
						</Button>
					{:else if download.status === 'failed'}
						<Button variant="ghost" size="icon" class="size-8">
							<RotateCw class="size-4" />
						</Button>
					{:else if download.status === 'downloading'}
						<Button variant="ghost" size="icon" class="size-8">
							<XCircle class="size-4" />
						</Button>
					{:else}
						<StatusIcon class={`size-5 ${statusColor}`} />
					{/if}
				</div>
			</Item.Actions>
		</button>
	{/snippet}
</Item.Root>
