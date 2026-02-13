import { spawn } from 'bun';
import type { PinoLogger } from 'hono-pino';

/**
 * Result from executing a yt-dlp command.
 *
 * Contains both stdout and stderr output, along with the exit code.
 */
interface ExecuteYtDlpCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
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
   * 5. Returns output and exit code
   *
   * The command string is parsed respecting quoted strings.
   * For example: '--skip-download --dump-json "https://example.com"'
   * becomes: ['--skip-download', '--dump-json', 'https://example.com']
   *
   * @param commandString - User command string (e.g., "--help", "--version")
   * @returns Result with stdout, stderr, and exit code
   * @throws Error if command parsing fails
   *
   * @example
   * ```typescript
   * const useCase = new ExecuteYtDlpCommand(logger);
   *
   * // Get version
   * const result1 = await useCase.execute('--version');
   * // Executes: ['yt-dlp', '--js-runtime', 'bun', '--version']
   * // Returns: { stdout: '2024.01.01\n', stderr: '', exitCode: 0 }
   *
   * // Get help
   * const result2 = await useCase.execute('--help');
   * // Executes: ['yt-dlp', '--js-runtime', 'bun', '--help']
   * // Returns: { stdout: 'Usage: yt-dlp [OPTIONS] URL...', stderr: '', exitCode: 0 }
   *
   * // Extract metadata (with quotes)
   * const result3 = await useCase.execute('--skip-download --dump-json "https://music.youtube.com/watch?v=abc123"');
   * // Executes: ['yt-dlp', '--js-runtime', 'bun', '--skip-download', '--dump-json', 'https://music.youtube.com/watch?v=abc123']
   * // Returns: { stdout: '{"title":"Song",...}', stderr: '', exitCode: 0 }
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

      return {
        stdout,
        stderr,
        exitCode
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
