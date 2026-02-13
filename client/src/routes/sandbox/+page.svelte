<script lang="ts">
  import { API_CONFIG } from '$lib/config/api';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Badge } from '$lib/components/ui/badge';

  let command = $state('--version');
  let response = $state<{
    stdout: unknown;
    stderr: string;
    exitCode: number;
    isJsonOutput: boolean;
  } | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  async function executeCommand() {
    if (!command.trim()) return;

    isLoading = true;
    error = null;
    response = null;

    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/sandbox/yt-dlp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to execute command');
      }

      const data = await res.json();
      response = data;
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      executeCommand();
    }
  }

  function getFormattedOutput(): string {
    if (!response) return '';

    if (response.isJsonOutput) {
      return JSON.stringify(response.stdout, null, 2);
    }

    return typeof response.stdout === 'string'
      ? response.stdout
      : JSON.stringify(response.stdout, null, 2);
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
      <Label for="command">Command (without "yt-dlp" prefix)</Label>
      <div class="flex gap-2">
        <Input
          id="command"
          bind:value={command}
          placeholder="--version"
          onkeydown={handleKeydown}
          class="font-mono"
        />
        <Button onclick={executeCommand} disabled={isLoading || !command.trim()}>
          {isLoading ? 'Executing...' : 'Execute'}
        </Button>
      </div>
      <p class="text-sm text-muted-foreground">Press Cmd+Enter (Mac) or Ctrl+Enter to execute</p>
    </div>

    {#if error}
      <div class="rounded-lg border border-destructive bg-destructive/10 p-4">
        <p class="text-sm text-destructive">{error}</p>
      </div>
    {/if}

    {#if isLoading}
      <div class="space-y-2">
        <Skeleton class="h-4 w-24" />
        <Skeleton class="h-[200px] w-full" />
      </div>
    {/if}

    {#if response}
      <div class="flex flex-1 flex-col gap-4 overflow-hidden">
        <div class="flex items-center gap-2">
          <h2 class="text-lg font-semibold">Response</h2>
          <Badge variant={response.exitCode === 0 ? 'default' : 'destructive'}>
            Exit Code: {response.exitCode}
          </Badge>
          {#if response.isJsonOutput}
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

          {#if response.stderr}
            <div class="flex flex-col gap-2">
              <Label for="stderr">Standard Error</Label>
              <Textarea
                id="stderr"
                value={response.stderr}
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
