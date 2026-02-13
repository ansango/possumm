<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Badge } from '$lib/components/ui/badge';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { useExecuteYtDlpCommand } from '$lib/queries';

  let url = $state('');
  let command = $state('--version');
  let skipDownload = $state(true);

  const executeMutation = useExecuteYtDlpCommand();

  function executeCommand() {
    if (!command.trim()) return;

    let fullCommand = command.trim();

    // Add --skip-download flag if checkbox is checked and not already present
    if (skipDownload && !fullCommand.includes('--skip-download')) {
      fullCommand = `--skip-download ${fullCommand}`;
    }

    // Add URL if provided
    if (url.trim()) {
      fullCommand = `${fullCommand} "${url.trim()}"`;
    }

    executeMutation.mutate({
      command: fullCommand
    });
  }

  function handleKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      executeCommand();
    }
  }

  function getFormattedOutput(): string {
    if (!executeMutation.data) return '';

    if (executeMutation.data.isJsonOutput) {
      return JSON.stringify(executeMutation.data.stdout, null, 2);
    }

    return typeof executeMutation.data.stdout === 'string'
      ? executeMutation.data.stdout
      : JSON.stringify(executeMutation.data.stdout, null, 2);
  }
</script>

<div class="flex h-screen flex-col gap-6 p-6">
  <div class="space-y-2">
    <h1 class="text-3xl font-bold tracking-tight">yt-dlp Sandbox</h1>
    <p class="text-muted-foreground">
      Execute yt-dlp commands for testing. The server automatically prepends "yt-dlp --js-runtime
      bun" to your command.
    </p>
  </div>

  <div class="flex flex-col gap-4">
    <div class="space-y-2">
      <Label for="url">URL (optional)</Label>
      <Input
        id="url"
        bind:value={url}
        placeholder="https://music.youtube.com/watch?v=..."
        onkeydown={handleKeydown}
        class="font-mono"
      />
    </div>

    <div class="space-y-2">
      <Label for="command">Command (without "yt-dlp" prefix)</Label>
      <div class="flex gap-2">
        <Input
          id="command"
          bind:value={command}
          placeholder="--version"
          onkeydown={handleKeydown}
          class="font-mono"
        />
        <Button onclick={executeCommand} disabled={executeMutation.isPending || !command.trim()}>
          {executeMutation.isPending ? 'Executing...' : 'Execute'}
        </Button>
      </div>
      <div class="flex items-center gap-2">
        <Checkbox id="skip-download" bind:checked={skipDownload} />
        <Label for="skip-download" class="cursor-pointer text-sm font-normal">
          Add --skip-download flag (useful for extracting metadata without downloading)
        </Label>
      </div>
      <p class="text-sm text-muted-foreground">Press Cmd+Enter (Mac) or Ctrl+Enter to execute</p>
    </div>

    {#if executeMutation.isError}
      <div class="rounded-lg border border-destructive bg-destructive/10 p-4">
        <p class="text-sm text-destructive">{executeMutation.error.message}</p>
      </div>
    {/if}

    {#if executeMutation.isPending}
      <div class="space-y-2">
        <Skeleton class="h-4 w-24" />
        <Skeleton class="h-50 w-full" />
      </div>
    {/if}

    {#if executeMutation.isSuccess && executeMutation.data}
      <div class="flex flex-1 flex-col gap-4 overflow-hidden">
        <div class="flex items-center gap-2">
          <h2 class="text-lg font-semibold">Response</h2>
          <Badge variant={executeMutation.data.exitCode === 0 ? 'default' : 'destructive'}>
            Exit Code: {executeMutation.data.exitCode}
          </Badge>
          {#if executeMutation.data.isJsonOutput}
            <Badge variant="outline">JSON</Badge>
          {/if}
        </div>

        <div class="flex flex-1 flex-col gap-4 overflow-hidden">
          <div class="flex flex-1 flex-col gap-2 overflow-hidden">
            <Label for="stdout">Standard Output</Label>
            <Textarea
              id="stdout"
              value={getFormattedOutput()}
              readonly
              class="flex-1 resize-none font-mono text-xs"
            />
          </div>

          {#if executeMutation.data.stderr}
            <div class="flex flex-col gap-2">
              <Label for="stderr">Standard Error</Label>
              <Textarea
                id="stderr"
                value={executeMutation.data.stderr}
                readonly
                class="resize-none font-mono text-xs"
                rows={5}
              />
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
