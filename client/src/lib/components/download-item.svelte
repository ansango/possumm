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
	import type { ComponentType } from 'svelte';

	let { download, onclick }: { download: Download; onclick?: () => void } = $props();

	const STATUS_ICONS: Record<Download['status'], ComponentType> = {
		pending: Clock,
		downloading: DownloadIcon,
		completed: CheckCircle2,
		failed: XCircle,
		cancelled: Ban,
		stalled: Loader2
	};

	const STATUS_COLORS: Record<Download['status'], string> = {
		pending: 'text-yellow-500',
		downloading: 'text-blue-500',
		completed: 'text-green-500',
		failed: 'text-destructive',
		cancelled: 'text-muted-foreground',
		stalled: 'text-orange-500'
	};

	const ACTION_BUTTONS: Partial<Record<Download['status'], { icon: ComponentType; size: string }>> =
		{
			completed: { icon: FolderOpen, size: 'size-4' },
			failed: { icon: RotateCw, size: 'size-4' },
			downloading: { icon: XCircle, size: 'size-4' }
		};

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

	const StatusIcon = $derived(STATUS_ICONS[download.status]);
	const statusColor = $derived(STATUS_COLORS[download.status]);
	const title = $derived(extractTitle(download.url));
	const artist = $derived(extractArtist(download.url));
	const showProgress = $derived(download.status === 'downloading' || download.status === 'pending');
	const actionButton = $derived(ACTION_BUTTONS[download.status]);
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
					{#if actionButton}
						{@const ActionIcon = actionButton.icon}
						<Button variant="ghost" size="icon" class="size-8">
							<ActionIcon class={actionButton.size} />
						</Button>
					{:else}
						<StatusIcon class={`size-5 ${statusColor}`} />
					{/if}
				</div>
			</Item.Actions>
		</button>
	{/snippet}
</Item.Root>
