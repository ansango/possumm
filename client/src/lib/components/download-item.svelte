<script lang="ts">
	import * as Item from '$lib/components/ui/item';
	import { Badge } from '$lib/components/ui/badge';
	import { Progress } from '$lib/components/ui/progress';
	import * as Alert from '$lib/components/ui/alert';
	import {
		Clock,
		Download as DownloadIcon,
		CheckCircle2,
		XCircle,
		Ban,
		Loader2,
		FileDown,
		Calendar,
		PlayCircle,
		StopCircle,
		AlertCircle
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
				return DownloadIcon;
		}
	}

	function getStatusVariant(status: Download['status']) {
		switch (status) {
			case 'pending':
				return 'secondary';
			case 'downloading':
				return 'default';
			case 'completed':
				return 'default';
			case 'failed':
				return 'destructive';
			case 'cancelled':
				return 'outline';
			case 'stalled':
				return 'secondary';
			default:
				return 'outline';
		}
	}

	const StatusIcon = $derived(getStatusIcon(download.status));
	const statusVariant = $derived(getStatusVariant(download.status));
	const showProgress = $derived(download.status === 'downloading' || download.status === 'pending');
</script>

<Item.Root variant="outline" class="transition-all hover:shadow-md">
	{#snippet child({ props })}
		<button type="button" {onclick} {...props} class="w-full">
			<Item.Media>
				<div class="flex size-10 items-center justify-center rounded-lg bg-muted">
					<StatusIcon class="size-5 text-muted-foreground" />
				</div>
			</Item.Media>

			<Item.Content>
				<div class="flex items-center gap-2">
					<Item.Title class="text-sm font-semibold">#{download.id}</Item.Title>
					<Badge variant={statusVariant} class="capitalize">
						{download.status}
					</Badge>
				</div>

				<Item.Description class="line-clamp-1 text-xs">
					{download.url}
				</Item.Description>

				{#if showProgress}
					<div class="mt-2 flex items-center gap-2">
						<Progress value={download.progress} max={100} class="flex-1" />
						<span class="text-xs font-medium text-muted-foreground">{download.progress}%</span>
					</div>
				{/if}

				{#if download.errorMessage}
					<Alert.Root variant="destructive" class="mt-2">
						<AlertCircle class="size-4" />
						<Alert.Description class="text-xs">
							{download.errorMessage}
						</Alert.Description>
					</Alert.Root>
				{/if}

				{#if download.filePath}
					<div class="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
						<FileDown class="size-3" />
						<span class="truncate font-mono">{download.filePath}</span>
					</div>
				{/if}

				<div class="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
					{#if download.createdAt}
						<div class="flex items-center gap-1">
							<Calendar class="size-3" />
							<span>{new Date(download.createdAt).toLocaleString()}</span>
						</div>
					{/if}
					{#if download.startedAt}
						<div class="flex items-center gap-1">
							<PlayCircle class="size-3" />
							<span>{new Date(download.startedAt).toLocaleString()}</span>
						</div>
					{/if}
					{#if download.finishedAt}
						<div class="flex items-center gap-1">
							<StopCircle class="size-3" />
							<span>{new Date(download.finishedAt).toLocaleString()}</span>
						</div>
					{/if}
				</div>
			</Item.Content>
		</button>
	{/snippet}
</Item.Root>
