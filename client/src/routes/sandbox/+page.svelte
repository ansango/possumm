<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Badge } from '$lib/components/ui/badge';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Switch } from '$lib/components/ui/switch';
  import { Icon } from '$lib/components/ui/icons';
  import {
    useExecuteYtDlpCommand,
    useExecuteYtDlpCommandStream,
    type YtDlpStreamEvent
  } from '$lib/queries';
  import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';

  let url = $state(
    'https://music.youtube.com/playlist?list=OLAK5uy_kdLOnnGvE3A99ne7nhjnmiytoVAKroUys'
  );
  let command = $state('');
  let skipDownload = $state(true);
  let flatPlaylist = $state(false);
  let useStreaming = $state(true);

  let isCopying = $state(false);
  const executeMutation = useExecuteYtDlpCommand();
  const streamCommand = useExecuteYtDlpCommandStream();

  // Reference to the scroll container
  let scrollContainer: HTMLDivElement | null = $state(null);

  // Auto-scroll to bottom when new events arrive
  $effect(() => {
    if (streamCommand.events.length > 0 && scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  });

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

    if (useStreaming) {
      streamCommand.execute(serverCommand);
    } else {
      executeMutation.mutate({
        command: serverCommand
      });
    }
  }

  function cancelCommand() {
    if (useStreaming && streamCommand.isExecuting) {
      streamCommand.abort();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      executeCommand();
    }
  }

  function getFormattedOutput(): string {
    if (useStreaming) {
      // Para streaming, mostrar todos los eventos stdout
      const stdoutEvents = streamCommand.events.filter((e) => e.type === 'stdout');
      if (stdoutEvents.length === 0) return '';

      const output = stdoutEvents.map((e) => e.data).join('\n');

      // Intentar parsear como JSON
      try {
        const parsed = JSON.parse(output);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return output;
      }
    }

    if (!executeMutation.data) return '';

    if (executeMutation.data.isJsonOutput) {
      return JSON.stringify(executeMutation.data.stdout, null, 2);
    }

    return typeof executeMutation.data.stdout === 'string'
      ? executeMutation.data.stdout
      : JSON.stringify(executeMutation.data.stdout, null, 2);
  }

  function getStderr(): string {
    if (useStreaming) {
      const stderrEvents = streamCommand.events.filter((e) => e.type === 'stderr');
      return stderrEvents.map((e) => e.data).join('\n');
    }
    return executeMutation.data?.stderr || '';
  }

  function getExitCode(): number | null {
    if (useStreaming) {
      const completeEvent = streamCommand.events.find((e) => e.type === 'complete') as
        | Extract<YtDlpStreamEvent, { type: 'complete' }>
        | undefined;
      return completeEvent?.exitCode ?? null;
    }
    return executeMutation.data?.exitCode ?? null;
  }

  function isExecuting(): boolean {
    return useStreaming ? streamCommand.isExecuting : executeMutation.isPending;
  }

  function hasError(): boolean {
    if (useStreaming) {
      return streamCommand.error !== null || streamCommand.events.some((e) => e.type === 'error');
    }
    return executeMutation.isError;
  }

  function getError(): string {
    if (useStreaming) {
      if (streamCommand.error) return streamCommand.error.message;
      const errorEvent = streamCommand.events.find((e) => e.type === 'error') as
        | Extract<YtDlpStreamEvent, { type: 'error' }>
        | undefined;
      return errorEvent?.message || '';
    }
    return executeMutation.error?.message || '';
  }

  function hasOutput(): boolean {
    if (useStreaming) {
      return streamCommand.events.length > 0 && !streamCommand.isExecuting;
    }
    return executeMutation.isSuccess;
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
    <!-- Mode Switch -->
    <div class="flex items-center justify-between rounded-lg border bg-card p-4">
      <div class="space-y-0.5">
        <Label for="streaming-mode" class="text-base">Streaming Mode (SSE)</Label>
        <p class="text-sm text-muted-foreground">
          {useStreaming
            ? 'Real-time feedback with Server-Sent Events'
            : 'Traditional REST request/response'}
        </p>
      </div>
      <Switch id="streaming-mode" bind:checked={useStreaming} />
    </div>

    <!-- URL Input -->
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

    <!-- Flags -->
    <div class="flex items-center gap-2">
      <Checkbox id="skip-download" bind:checked={skipDownload} />
      <Label for="skip-download" class="cursor-pointer text-sm font-normal">
        Add <code class="rounded bg-muted px-1 py-0.5">--skip-download</code>
        flag (useful for extracting metadata without downloading)
      </Label>
    </div>
    <div class="flex items-center gap-2">
      <Checkbox id="flat-playlist" bind:checked={flatPlaylist} />
      <Label for="flat-playlist" class="cursor-pointer text-sm font-normal">
        Add <code class="rounded bg-muted px-1 py-0.5">--flat-playlist</code>
        flag (useful for extracting metadata without downloading)
      </Label>
    </div>

    <!-- Command Input -->
    <div class="space-y-2">
      <Label for="command">Command (without "yt-dlp" prefix)</Label>
      <div class="flex gap-2">
        <Input
          id="command"
          bind:value={command}
          placeholder="--version"
          onkeydown={handleKeydown}
          class="font-mono"
          disabled={isExecuting()}
        />
        <Button onclick={executeCommand} disabled={isExecuting() || !command.trim()}>
          {isExecuting() ? 'Executing...' : 'Execute'}
        </Button>
        {#if useStreaming && streamCommand.isExecuting}
          <Button onclick={cancelCommand} variant="destructive">Cancel</Button>
        {/if}
      </div>

      <p class="text-sm text-muted-foreground">Press Cmd+Enter (Mac) or Ctrl+Enter to execute</p>
    </div>

    <!-- Full Command Preview -->
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

    <!-- Streaming Events (only in streaming mode) -->
    {#if useStreaming && streamCommand.events.length > 0}
      <div class="space-y-2">
        <Label>Event Stream</Label>
        <ScrollArea
          bind:viewportRef={scrollContainer}
          class="h-160 space-y-1 rounded-md border bg-muted p-3 font-mono text-xs"
        >
          {#each streamCommand.events as event, i (i)}
            <div class="flex max-w-full min-w-0 flex-col items-start gap-2">
              {#if event.type === 'start'}
                <Badge variant="outline" class="shrink-0">▶️ start</Badge>
                <span class="break-all text-muted-foreground">{event.command.join(' ')}</span>
              {:else if event.type === 'stdout'}
                <Badge variant="outline" class="shrink-0">📤 stdout</Badge>
                <pre class="max-w-full break-all">{JSON.stringify(JSON.parse(event.data), null, 1)}</pre>
              {:else if event.type === 'stderr'}
                <Badge variant="secondary" class="shrink-0">⚠️ stderr</Badge>
                <pre class="max-w-full break-all text-muted-foreground">{event.data}</pre>
              {:else if event.type === 'progress'}
                <Badge variant="default" class="shrink-0">📊 progress</Badge>
                <span class="break-all"
                  >{event.percent?.toFixed(1)}% {event.eta ? `(ETA: ${event.eta})` : ''}</span
                >
              {:else if event.type === 'complete'}
                <Badge variant="default" class="shrink-0">✅ complete</Badge>
                <span>Exit code: {event.exitCode}</span>
              {:else if event.type === 'error'}
                <Badge variant="destructive" class="shrink-0">❌ error</Badge>
                <span class="break-all text-destructive">{event.message}</span>
              {/if}
            </div>
          {/each}
        </ScrollArea>
      </div>
    {/if}

    <!-- Error Display -->
    {#if hasError()}
      <div class="rounded-lg border border-destructive bg-destructive/10 p-4">
        <p class="text-sm text-destructive">{getError()}</p>
      </div>
    {/if}

    <!-- Loading State -->
    {#if isExecuting() && !useStreaming}
      <div class="space-y-2">
        <Skeleton class="h-4 w-24" />
        <Skeleton class="h-50 w-full" />
      </div>
    {/if}

    <!-- Output Display -->
    {#if hasOutput() && !useStreaming}
      <div class="flex flex-1 flex-col gap-4 overflow-hidden">
        <div class="flex items-center gap-2">
          <h2 class="text-lg font-semibold">Response</h2>
          {#if getExitCode() !== null}
            <Badge variant={getExitCode() === 0 ? 'default' : 'destructive'}>
              Exit Code: {getExitCode()}
            </Badge>
          {/if}
          {#if !useStreaming && executeMutation.data?.isJsonOutput}
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

          {#if getStderr()}
            <div class="flex flex-col gap-2">
              <Label for="stderr">Standard Error</Label>
              <Textarea
                id="stderr"
                value={getStderr()}
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
