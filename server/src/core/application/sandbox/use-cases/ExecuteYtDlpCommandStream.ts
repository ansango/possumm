import { spawn } from 'bun';
import type { PinoLogger } from 'hono-pino';

/**
 * Event types emitted during yt-dlp command execution.
 */
export type YtDlpStreamEvent =
  | { type: 'start'; command: string[] }
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'progress'; percent?: number; eta?: string }
  | { type: 'complete'; exitCode: number }
  | { type: 'error'; message: string };

/**
 * Use case for executing yt-dlp commands with real-time streaming output.
 *
 * Application layer - Use Case for streaming yt-dlp command execution via SSE.
 *
 * Unlike the REST version (ExecuteYtDlpCommand), this streams events in real-time:
 * - 'start': Command execution begins
 * - 'stdout': Line from stdout (can be JSON or plain text)
 * - 'stderr': Line from stderr (warnings, progress info)
 * - 'progress': Parsed download progress (if available)
 * - 'complete': Command finished with exit code
 * - 'error': Fatal error during execution
 *
 * Security considerations:
 * - Always prepends 'yt-dlp', '--js-runtime', 'bun' to commands
 * - Parses user input string into array of arguments
 * - Streams output line-by-line for real-time feedback
 *
 * Example commands:
 * - "--help" → ['yt-dlp', '--js-runtime', 'bun', '--help']
 * - "--version" → ['yt-dlp', '--js-runtime', 'bun', '--version']
 * - '--skip-download --dump-json "https://example.com"' → ['yt-dlp', '--js-runtime', 'bun', '--skip-download', '--dump-json', 'https://example.com']
 */
export class ExecuteYtDlpCommandStream {
  /**
   * Creates a new ExecuteYtDlpCommandStream instance.
   *
   * @param logger - Logger for structured logging
   */
  constructor(private readonly logger: PinoLogger) {}

  /**
   * Executes a yt-dlp command with streaming output via callback.
   *
   * Flow:
   * 1. Parses command string into array of arguments
   * 2. Prepends required yt-dlp runtime arguments
   * 3. Spawns yt-dlp process with Bun
   * 4. Emits 'start' event
   * 5. Streams stdout/stderr line-by-line via callback
   * 6. Attempts to parse progress information from stderr
   * 7. Emits 'complete' or 'error' event when done
   *
   * The callback receives events in real-time as the command executes.
   * This is ideal for long-running downloads or metadata extraction.
   *
   * Progress Parsing:
   * - Parses yt-dlp progress lines: "[download] 45.2% of 10.5MiB at 1.2MiB/s ETA 00:05"
   * - Extracts percentage and ETA when available
   *
   * @param commandString - User command string (e.g., "--help", "--version")
   * @param onEvent - Callback function receiving stream events
   * @throws Error if command parsing fails
   *
   * @example
   * ```typescript
   * const useCase = new ExecuteYtDlpCommandStream(logger);
   *
   * // Stream version output
   * await useCase.execute('--version', (event) => {
   *   if (event.type === 'stdout') {
   *     console.log('Version:', event.data);
   *   }
   * });
   *
   * // Stream metadata extraction with progress
   * await useCase.execute(
   *   '--skip-download --dump-json "https://music.youtube.com/watch?v=abc123"',
   *   (event) => {
   *     switch (event.type) {
   *       case 'start':
   *         console.log('Starting:', event.command);
   *         break;
   *       case 'stdout':
   *         console.log('Metadata:', event.data);
   *         break;
   *       case 'stderr':
   *         console.log('Info:', event.data);
   *         break;
   *       case 'progress':
   *         console.log('Progress:', event.percent, event.eta);
   *         break;
   *       case 'complete':
   *         console.log('Done! Exit code:', event.exitCode);
   *         break;
   *       case 'error':
   *         console.error('Error:', event.message);
   *         break;
   *     }
   *   }
   * );
   * ```
   */
  async execute(commandString: string, onEvent: (event: YtDlpStreamEvent) => void): Promise<void> {
    this.logger.info(`Executing yt-dlp stream command: ${commandString}`);

    try {
      // Parse command string into array
      const userArgs = this.parseCommandString(commandString);
      this.logger.info(`Parsed user args: ${JSON.stringify(userArgs)}`);

      // Build full command: always start with yt-dlp, --js-runtime, bun
      const cmd = ['yt-dlp', '--js-runtime', 'bun', ...userArgs];
      this.logger.info(`Full command: ${cmd.join(' ')}`);

      // Emit start event
      onEvent({ type: 'start', command: cmd });

      // Spawn process
      const process = spawn({
        cmd,
        stdout: 'pipe',
        stderr: 'pipe'
      });

      this.logger.info(`Process spawned with PID: ${process.pid}`);

      // Stream stdout line by line
      const stdoutReader = process.stdout.getReader();
      const stderrReader = process.stderr.getReader();
      const decoder = new TextDecoder();

      // Process streams concurrently
      const stdoutPromise = this.processStream(stdoutReader, decoder, (line) => {
        onEvent({ type: 'stdout', data: line });
      });

      const stderrPromise = this.processStream(stderrReader, decoder, (line) => {
        // Try to parse progress from stderr
        const progress = this.parseProgress(line);
        if (progress) {
          onEvent({ type: 'progress', ...progress });
        } else {
          onEvent({ type: 'stderr', data: line });
        }
      });

      // Wait for both streams to complete
      await Promise.all([stdoutPromise, stderrPromise]);

      // Get exit code
      const exitCode = await process.exited;
      this.logger.info(`Process finished with exit code: ${exitCode}`);

      // Emit complete event
      onEvent({ type: 'complete', exitCode });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error executing yt-dlp stream command: ${message}`);
      onEvent({ type: 'error', message });
    }
  }

  /**
   * Process a readable stream line by line.
   *
   * @param reader - ReadableStreamDefaultReader to process
   * @param decoder - TextDecoder for converting bytes to strings
   * @param onLine - Callback for each complete line
   */
  private async processStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    onLine: (line: string) => void
  ): Promise<void> {
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            onLine(line);
          }
        }
      }

      // Process any remaining content in buffer
      if (buffer.trim()) {
        onLine(buffer);
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse progress information from yt-dlp stderr output.
   *
   * Attempts to extract percentage and ETA from progress lines like:
   * - "[download] 45.2% of 10.5MiB at 1.2MiB/s ETA 00:05"
   * - "[download] 100% of 10.5MiB in 00:08"
   *
   * @param line - Line from stderr
   * @returns Parsed progress object or null if not a progress line
   */
  private parseProgress(line: string): { percent?: number; eta?: string } | null {
    // Match yt-dlp download progress pattern
    const progressMatch = line.match(/\[download\]\s+([\d.]+)%/);
    const etaMatch = line.match(/ETA\s+([\d:]+)/);

    if (progressMatch) {
      const percent = parseFloat(progressMatch[1]);
      const eta = etaMatch ? etaMatch[1] : undefined;
      return { percent, eta };
    }

    return null;
  }

  /**
   * Parses a command string into an array of arguments.
   *
   * Respects quoted strings (single and double quotes).
   * Handles escaped quotes within quoted strings.
   *
   * Examples:
   * - "--help" → ['--help']
   * - "--version" → ['--version']
   * - '--skip-download --dump-json "https://example.com"' → ['--skip-download', '--dump-json', 'https://example.com']
   * - "--format 'best[ext=mp4]'" → ['--format', 'best[ext=mp4]']
   *
   * @param commandString - Raw command string from user
   * @returns Array of parsed arguments
   */
  private parseCommandString(commandString: string): string[] {
    const args: string[] = [];
    let currentArg = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < commandString.length; i++) {
      const char = commandString[i];
      const nextChar = commandString[i + 1];

      // Handle quotes
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        continue;
      }

      if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
        continue;
      }

      // Handle spaces (argument separators)
      if (char === ' ' && !inQuotes) {
        if (currentArg.length > 0) {
          args.push(currentArg);
          currentArg = '';
        }
        continue;
      }

      // Handle escaped characters
      if (char === '\\' && nextChar) {
        currentArg += nextChar;
        i++; // Skip next char
        continue;
      }

      // Add character to current argument
      currentArg += char;
    }

    // Add last argument if exists
    if (currentArg.length > 0) {
      args.push(currentArg);
    }

    return args;
  }
}
