import { spawn } from 'bun';
import type { PinoLogger } from 'hono-pino';

/**
 * Result from executing a yt-dlp command.
 *
 * Contains both stdout (as object if JSON, or string), stderr output, and exit code.
 */
interface ExecuteYtDlpCommandResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stdout: any;
  stderr: string;
  exitCode: number;
  isJsonOutput: boolean;
}

/**
 * Use case for executing yt-dlp commands in sandbox mode.
 *
 * Application layer - Use Case for testing yt-dlp commands safely.
 *
 * Security considerations:
 * - Always prepends 'yt-dlp', '--js-runtime', 'bun' to commands
 * - Parses user input string into array of arguments
 * - Captures both stdout and stderr
 * - Returns exit code for error detection
 *
 * Example commands:
 * - "--help" → ['yt-dlp', '--js-runtime', 'bun', '--help']
 * - "--version" → ['yt-dlp', '--js-runtime', 'bun', '--version']
 * - '--skip-download --dump-json "https://example.com"' → ['yt-dlp', '--js-runtime', 'bun', '--skip-download', '--dump-json', 'https://example.com']
 */
export class ExecuteYtDlpCommand {
  /**
   * Creates a new ExecuteYtDlpCommand instance.
   *
   * @param logger - Logger for structured logging
   */
  constructor(private readonly logger: PinoLogger) {}

  /**
   * Executes a yt-dlp command with user-provided arguments.
   *
   * Flow:
   * 1. Parses command string into array of arguments
   * 2. Prepends required yt-dlp runtime arguments
   * 3. Spawns yt-dlp process with Bun
   * 4. Captures stdout and stderr
   * 5. Attempts to parse stdout as JSON (single object or array of objects)
   * 6. Returns parsed output (or raw string if not JSON), stderr, exit code, and JSON flag
   *
   * The command string is parsed respecting quoted strings.
   * For example: '--skip-download --dump-json "https://example.com"'
   * becomes: ['--skip-download', '--dump-json', 'https://example.com']
   *
   * JSON Parsing:
   * - Single JSON object: parsed as object
   * - Multiple JSON lines (playlists): parsed as array of objects
   * - Non-JSON output: returned as string
   *
   * @param commandString - User command string (e.g., "--help", "--version")
   * @returns Result with parsed stdout (object/array/string), stderr, exit code, and isJsonOutput flag
   * @throws Error if command parsing fails
   *
   * @example
   * ```typescript
   * const useCase = new ExecuteYtDlpCommand(logger);
   *
   * // Get version (string output)
   * const result1 = await useCase.execute('--version');
   * // Returns: { stdout: '2024.01.01\n', stderr: '', exitCode: 0, isJsonOutput: false }
   *
   * // Get help (string output)
   * const result2 = await useCase.execute('--help');
   * // Returns: { stdout: 'Usage: yt-dlp [OPTIONS] URL...', stderr: '', exitCode: 0, isJsonOutput: false }
   *
   * // Extract metadata (JSON output)
   * const result3 = await useCase.execute('--skip-download --dump-json "https://music.youtube.com/watch?v=abc123"');
   * // Returns: {
   * //   stdout: { title: 'Song', artist: 'Artist', ... },
   * //   stderr: '',
   * //   exitCode: 0,
   * //   isJsonOutput: true
   * // }
   *
   * // Extract playlist metadata (multiple JSON lines)
   * const result4 = await useCase.execute('--flat-playlist --dump-json "https://music.youtube.com/playlist?list=abc"');
   * // Returns: {
   * //   stdout: [
   * //     { title: 'Track 1', id: 'xyz1', ... },
   * //     { title: 'Track 2', id: 'xyz2', ... }
   * //   ],
   * //   stderr: '',
   * //   exitCode: 0,
   * //   isJsonOutput: true
   * // }
   * ```
   */
  async execute(commandString: string): Promise<ExecuteYtDlpCommandResult> {
    this.logger.info(`Executing yt-dlp sandbox command: ${commandString}`);

    try {
      // Parse command string into array
      const userArgs = this.parseCommandString(commandString);
      this.logger.info(`Parsed user args: ${JSON.stringify(userArgs)}`);

      // Build full command: always start with yt-dlp, --js-runtime, bun
      const cmd = ['yt-dlp', '--js-runtime', 'bun', ...userArgs];
      this.logger.info(`Full command: ${cmd.join(' ')}`);

      // Spawn process
      const process = spawn({
        cmd,
        stdout: 'pipe',
        stderr: 'pipe'
      });

      this.logger.info(`Process spawned with PID: ${process.pid}`);

      // Capture streams
      const [stdout, stderr] = await Promise.all([
        new Response(process.stdout).text(),
        new Response(process.stderr).text()
      ]);

      const exitCode = await process.exited;

      this.logger.info(
        `Process finished: exitCode=${exitCode}, stdout length=${stdout.length}, stderr length=${stderr.length}`
      );

      // Try to parse stdout as JSON
      let parsedStdout: unknown = stdout;
      let isJsonOutput = false;

      try {
        // Attempt to parse as JSON
        parsedStdout = JSON.parse(stdout.trim());
        isJsonOutput = true;
        this.logger.info('Successfully parsed stdout as JSON');
      } catch {
        // If not valid JSON, check if it's multiple JSON lines (like yt-dlp playlist output)
        const lines = stdout
          .trim()
          .split('\n')
          .filter((line) => line.length > 0);

        if (lines.length > 1) {
          try {
            // Try to parse each line as JSON
            const parsedLines = lines.map((line) => JSON.parse(line));
            parsedStdout = parsedLines;
            isJsonOutput = true;
            this.logger.info(
              `Successfully parsed stdout as array of ${parsedLines.length} JSON objects`
            );
          } catch {
            // If parsing fails, keep as string
            this.logger.info('Stdout is not JSON, keeping as string');
          }
        } else {
          // Single line that's not JSON, keep as string
          this.logger.info('Stdout is not JSON, keeping as string');
        }
      }

      return {
        stdout: parsedStdout,
        stderr,
        exitCode,
        isJsonOutput
      };
    } catch (error) {
      this.logger.error(`Error executing yt-dlp sandbox command: ${error}`);
      throw error;
    }
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
