<script lang="ts">
  import DownloadsList from '$lib/components/downloads-list.svelte';
  import DownloadInput from '$lib/components/download-input.svelte';
  import DownloadLogs from '$lib/components/download-logs.svelte';

  let selectedDownloadId = $state<number | null>(null);
</script>

<div class="container">
  <h1>Download Manager</h1>

  <DownloadInput />

  <div class="flex w-full gap-4">
    <DownloadsList onclick={(id) => (selectedDownloadId = id)} />

    {#if selectedDownloadId}
      <DownloadLogs downloadId={selectedDownloadId} />
    {/if}
  </div>
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 1rem;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
  }

  h1 {
    margin-bottom: 1.5rem;
    font-size: 2rem;
    color: #333;
  }
</style>
