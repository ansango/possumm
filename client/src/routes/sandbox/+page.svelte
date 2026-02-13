<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Badge } from '$lib/components/ui/badge';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Icon } from '$lib/components/ui/icons';
  import { useExecuteYtDlpCommand } from '$lib/queries';

  let url = $state(
    'https://music.youtube.com/playlist?list=OLAK5uy_kdLOnnGvE3A99ne7nhjnmiytoVAKroUys'
  );
  let command = $state('');
  let skipDownload = $state(true);
  let flatPlaylist = $state(false);

  let isCopying = $state(false);
  const executeMutation = useExecuteYtDlpCommand();

  function executeCommand() {
    if (!command.trim()) return;

    let fullCommand = command.trim();

    // Add --skip-download flag if checkbox is checked and not already present
    if (skipDownload && !fullCommand.includes('--skip-download')) {
      fullCommand = `--skip-download ${fullCommand}`;
    }

    // Add --flat-playlist flag if checkbox is checked and not already present
    if (flatPlaylist && !fullCommand.includes('--flat-playlist')) {
      fullCommand = `--flat-playlist ${fullCommand}`;
    }

    // Add URL if provided
    if (url.trim()) {
      fullCommand = `${fullCommand} "${url.trim()}"`;
    }

    // Replace double quotes with single quotes for the server
    const serverCommand = fullCommand.replace(/"/g, "'");

    executeMutation.mutate({
      command: serverCommand
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

  function getFullCommand(): string {
    let fullCommand = command.trim();

    if (skipDownload && !fullCommand.includes('--skip-download')) {
      fullCommand = `--skip-download ${fullCommand}`;
    }

    if (url.trim()) {
      fullCommand = `${fullCommand} ${url.trim()}`;
    }

    if (flatPlaylist && !fullCommand.includes('--flat-playlist')) {
      fullCommand = `--flat-playlist ${fullCommand}`;
    }

    return `yt-dlp ${fullCommand}`;
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(getFullCommand());
      isCopying = true;
      setTimeout(() => {
        isCopying = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
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
    <div class="flex items-center gap-2">
      <Checkbox id="skip-download" bind:checked={skipDownload} />
      <Label for="skip-download" class="cursor-pointer text-sm font-normal">
        Add <pre class="rounded bg-muted px-1 py-0.5">--skip-download</pre>
        flag (useful for extracting metadata without downloading)
      </Label>
    </div>
    <div class="flex items-center gap-2">
      <Checkbox id="flat-playlist" bind:checked={flatPlaylist} />
      <Label for="flat-playlist" class="cursor-pointer text-sm font-normal">
        Add <pre class="rounded bg-muted px-1 py-0.5">--flat-playlist</pre>
        flag (useful for extracting metadata without downloading)
      </Label>
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

      <p class="text-sm text-muted-foreground">Press Cmd+Enter (Mac) or Ctrl+Enter to execute</p>
    </div>

    {#if command.trim()}
      <div class="space-y-2">
        <Label>Full command to execute in terminal</Label>
        <div class="relative">
          <code
            class="block overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-sm"
          >
            {getFullCommand()}
          </code>
          <Button
            variant="ghost"
            size="icon"
            onclick={copyCommand}
            class="absolute top-1/2 right-2 h-8 w-8 -translate-y-1/2"
            disabled={isCopying}
          >
            {#if isCopying}
              <Icon.Check class="h-4 w-4" />
            {:else}
              <Icon.Copy class="h-4 w-4" />
            {/if}
          </Button>
        </div>
      </div>
    {/if}

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
