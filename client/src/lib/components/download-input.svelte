<script lang="ts">
  import { useEnqueueDownload } from '$lib/queries';
  import { Input } from '$lib/components/ui/input';
  import * as Alert from '$lib/components/ui/alert';
  import { Icon } from '$lib/components/ui/icons';

  let url = $state('');
  let isSubmitting = $state(false);

  const enqueueDownloadMutation = useEnqueueDownload();

  async function handleSubmit(event: KeyboardEvent) {
    if (event.key === 'Enter' && url.trim() && !isSubmitting) {
      isSubmitting = true;
      try {
        await enqueueDownloadMutation.mutateAsync(url.trim());
        url = '';
      } catch (error) {
        console.error('Error enqueuing download:', error);
      } finally {
        isSubmitting = false;
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
      <Icon.LoaderCircle class="animate-spin" />
      <Alert.Title>Enqueuing download...</Alert.Title>
    </Alert.Root>
  {:else if enqueueDownloadMutation.isError}
    <Alert.Root variant="destructive">
      <Icon.AlertCircle />
      <Alert.Title>Error</Alert.Title>
      <Alert.Description>
        {enqueueDownloadMutation.error?.message || 'Failed to enqueue download'}
      </Alert.Description>
    </Alert.Root>
  {:else if enqueueDownloadMutation.isSuccess}
    <Alert.Root class="border-green-200 bg-green-50 text-green-900">
      <Icon.CheckCircle2 />
      <Alert.Title>Download enqueued successfully!</Alert.Title>
    </Alert.Root>
  {/if}
</div>
