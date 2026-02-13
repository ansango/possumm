<script lang="ts">
  import DownloadsList from '$lib/components/downloads-list.svelte';
  import DownloadInput from '$lib/components/download-input.svelte';
  import DownloadLogs from '$lib/components/download-logs.svelte';

  let selectedDownloadId = $state<number | null>(null);
</script>

<DownloadInput />

<DownloadsList onclick={(id) => (selectedDownloadId = id)} />

{#if selectedDownloadId}
  <DownloadLogs downloadId={selectedDownloadId} />
{/if}
