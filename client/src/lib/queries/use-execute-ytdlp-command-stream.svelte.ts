import { API_CONFIG } from '$lib/config/api';

/**
 * Event types emitted during yt-dlp command streaming.
 */
export type YtDlpStreamEvent =
  | { type: 'start'; command: string[] }
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'progress'; percent?: number; eta?: string }
  | { type: 'complete'; exitCode: number }
  | { type: 'error'; message: string };

/**
 * Options for executing yt-dlp commands with SSE streaming.
 */
interface ExecuteYtDlpCommandStreamOptions {
  /** Callback invoked for each event received from the stream */
  onEvent: (event: YtDlpStreamEvent) => void;
  /** Callback invoked when the stream completes successfully */
  onComplete?: () => void;
  /** Callback invoked when an error occurs */
  onError?: (error: Error) => void;
  /** AbortSignal to cancel the stream */
  signal?: AbortSignal;
}

/**
 * Execute a yt-dlp command with real-time streaming via Server-Sent Events.
 *
 * This function connects to the SSE endpoint and streams command execution progress
 * in real-time. Unlike the REST version, this provides immediate feedback as the
 * command executes.
 *
 * Event types:
 * - 'start': Command execution begins
 * - 'stdout': Line from stdout (can be JSON or plain text)
 * - 'stderr': Line from stderr (warnings, info)
 * - 'progress': Download progress (percent, eta)
 * - 'complete': Command finished with exit code
 * - 'error': Fatal error during execution
 *
 * @param command - yt-dlp command string (without 'yt-dlp' prefix)
 * @param options - Callbacks and abort signal
 * @returns Promise that resolves when the stream completes or is aborted
 *
 * @example
 * ```typescript
 * const events: YtDlpStreamEvent[] = [];
 *
 * await executeYtDlpCommandStream('--version', {
 *   onEvent: (event) => {
 *     events.push(event);
 *     console.log('Event:', event);
 *   },
 *   onComplete: () => {
 *     console.log('Stream completed!');
 *   },
 *   onError: (error) => {
 *     console.error('Stream error:', error);
 *   }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With abort controller
 * const controller = new AbortController();
 *
 * // Cancel after 5 seconds
 * setTimeout(() => controller.abort(), 5000);
 *
 * await executeYtDlpCommandStream(
 *   '--skip-download --dump-json "https://example.com"',
 *   {
 *     onEvent: (event) => {
 *       if (event.type === 'progress') {
 *         console.log(`Progress: ${event.percent}% ETA: ${event.eta}`);
 *       }
 *     },
 *     signal: controller.signal
 *   }
 * );
 * ```
 */
export async function executeYtDlpCommandStream(
  command: string,
  options: ExecuteYtDlpCommandStreamOptions
): Promise<void> {
  const { onEvent, onComplete, onError, signal } = options;

  try {
    // Make POST request to initiate SSE stream
    const response = await fetch(`${API_CONFIG.BASE_URL}/sandbox/yt-dlp/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      },
      body: JSON.stringify({ command }),
      signal
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Failed to execute command: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Process SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          onComplete?.();
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const message of lines) {
          if (!message.trim()) continue;

          // Parse SSE message format
          const eventMatch = message.match(/^event: (.+)$/m);
          const dataMatch = message.match(/^data: (.+)$/m);

          if (eventMatch && dataMatch) {
            try {
              const event = JSON.parse(dataMatch[1]) as YtDlpStreamEvent;
              onEvent(event);
            } catch (parseError) {
              console.error('Failed to parse SSE event:', parseError, dataMatch[1]);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof Error) {
      // Don't treat abort as an error
      if (error.name === 'AbortError') {
        return;
      }
      onError?.(error);
    } else {
      onError?.(new Error('Unknown error during stream'));
    }
  }
}

/**
 * Svelte 5 runes-based composable for executing yt-dlp commands with SSE streaming.
 *
 * Provides reactive state for managing command execution with real-time feedback.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useExecuteYtDlpCommandStream } from '$lib/queries/use-execute-ytdlp-command-stream.svelte';
 *
 *   const command = useExecuteYtDlpCommandStream();
 *
 *   async function runCommand() {
 *     await command.execute('--version');
 *   }
 * </script>
 *
 * <button onclick={runCommand} disabled={command.isExecuting}>
 *   {command.isExecuting ? 'Executing...' : 'Run Command'}
 * </button>
 *
 * <button onclick={() => command.abort()} disabled={!command.isExecuting}>
 *   Cancel
 * </button>
 *
 * {#each command.events as event}
 *   <div>
 *     {event.type}: {JSON.stringify(event)}
 *   </div>
 * {/each}
 *
 * {#if command.error}
 *   <p class="text-red-500">{command.error.message}</p>
 * {/if}
 * ```
 */
export function useExecuteYtDlpCommandStream() {
  let events = $state<YtDlpStreamEvent[]>([]);
  let isExecuting = $state(false);
  let error = $state<Error | null>(null);
  let abortController = $state<AbortController | null>(null);

  /**
   * Execute a yt-dlp command with streaming.
   *
   * @param command - Command string (without 'yt-dlp' prefix)
   */
  async function execute(command: string): Promise<void> {
    // Reset state
    events = [];
    error = null;
    isExecuting = true;

    // Create new abort controller
    abortController = new AbortController();

    try {
      await executeYtDlpCommandStream(command, {
        onEvent: (event) => {
          events = [...events, event];
        },
        onComplete: () => {
          isExecuting = false;
          abortController = null;
        },
        onError: (err) => {
          error = err;
          isExecuting = false;
          abortController = null;
        },
        signal: abortController.signal
      });
    } catch (err) {
      error = err instanceof Error ? err : new Error('Unknown error');
      isExecuting = false;
      abortController = null;
    }
  }

  /**
   * Abort the current command execution.
   */
  function abort(): void {
    abortController?.abort();
    abortController = null;
    isExecuting = false;
  }

  /**
   * Clear all events and reset state.
   */
  function clear(): void {
    events = [];
    error = null;
  }

  return {
    get events() {
      return events;
    },
    get isExecuting() {
      return isExecuting;
    },
    get error() {
      return error;
    },
    execute,
    abort,
    clear
  };
}
