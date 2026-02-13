import { AppRouteHandler, AppRouteHook } from '@/types';
import { ExecuteYtDlpCommandRoute, ExecuteYtDlpCommandStreamRoute } from './routes';
import { ExecuteYtDlpCommand } from '@/core/application/sandbox/use-cases/ExecuteYtDlpCommand';
import { ExecuteYtDlpCommandStream } from '@/core/application/sandbox/use-cases/ExecuteYtDlpCommandStream';
import { streamSSE } from 'hono/streaming';

/**
 * Collection of sandbox-related use cases injected into handlers.
 */
interface SandboxUseCases {
  executeYtDlpCommand: ExecuteYtDlpCommand;
  executeYtDlpCommandStream: ExecuteYtDlpCommandStream;
}

/**
 * Factory function to create sandbox route handlers with dependency injection.
 *
 * API layer - Thin controllers that delegate to use cases.
 * Handlers are responsible for:
 * - Extracting and validating request data
 * - Calling appropriate use case
 * - Mapping errors to HTTP status codes
 * - Returning JSON responses
 *
 * @param useCases - Injected use cases for sandbox operations
 * @returns Object containing all handler functions
 */
export function createSandboxHandlers(useCases: SandboxUseCases) {
  /**
   * Handler for executing yt-dlp commands.
   *
   * POST /api/sandbox/yt-dlp
   *
   * Maps errors to HTTP status codes:
   * - 200: Command executed successfully (check exitCode for actual result)
   * - 400: Invalid command format
   * - 500: Internal error during execution
   *
   * @example
   * ```
   * POST /api/sandbox/yt-dlp
   * Content-Type: application/json
   *
   * {
   *   "command": "--version"
   * }
   *
   * Response 200:
   * {
   *   "stdout": "2024.01.01\n",
   *   "stderr": "",
   *   "exitCode": 0
   * }
   *
   * POST /api/sandbox/yt-dlp
   * {
   *   "command": "--skip-download --dump-json \"https://music.youtube.com/watch?v=abc123\""
   * }
   *
   * Response 200:
   * {
   *   "stdout": "{\"title\":\"Song Name\",\"artist\":\"Artist\",...}",
   *   "stderr": "",
   *   "exitCode": 0
   * }
   *
   * Response 400 (invalid command):
   * {
   *   "error": "Command should not start with \"yt-dlp\" - it will be added automatically"
   * }
   * ```
   */
  const executeYtDlp: AppRouteHandler<ExecuteYtDlpCommandRoute> = async (c) => {
    try {
      const body = c.req.valid('json');
      const result = await useCases.executeYtDlpCommand.execute(body.command);
      return c.json(result, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  };

  /**
   * Handler for executing yt-dlp commands with SSE streaming.
   *
   * POST /api/sandbox/yt-dlp/stream
   *
   * Streams real-time execution events via Server-Sent Events:
   * - start: Command execution begins
   * - stdout: Line from stdout
   * - stderr: Line from stderr
   * - progress: Download progress (percent, eta)
   * - complete: Command finished
   * - error: Fatal error occurred
   *
   * Maps errors to HTTP status codes:
   * - 200: SSE stream established
   * - 400: Invalid command format
   * - 500: Internal error during setup
   *
   * @example
   * ```
   * POST /api/sandbox/yt-dlp/stream
   * Content-Type: application/json
   *
   * {
   *   "command": "--skip-download --dump-json \"https://music.youtube.com/watch?v=abc123\""
   * }
   *
   * Response 200 (SSE stream):
   * event: start
   * data: {"type":"start","command":["yt-dlp","--js-runtime","bun","--skip-download","--dump-json","https://..."]}
   *
   * event: stdout
   * data: {"type":"stdout","data":"{\"title\":\"Song Name\",...}"}
   *
   * event: complete
   * data: {"type":"complete","exitCode":0}
   * ```
   */
  const executeYtDlpStream: AppRouteHandler<ExecuteYtDlpCommandStreamRoute> = async (c) => {
    try {
      const body = c.req.valid('json');

      return streamSSE(c, async (stream) => {
        await useCases.executeYtDlpCommandStream.execute(body.command, async (event) => {
          try {
            await stream.writeSSE({
              event: event.type,
              data: JSON.stringify(event)
            });
          } catch (error) {
            console.error('Error writing SSE event:', error);
          }
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  };

  return {
    executeYtDlp,
    executeYtDlpStream
  };
}

/**
 * Validation hook for sandbox requests.
 *
 * Returns 400 Bad Request if validation fails.
 */
export const sandboxValidationHook: AppRouteHook = (result, c) => {
  if (!result.success) {
    return c.json(
      {
        error: 'Invalid sandbox request. Please check your parameters.'
      },
      400
    );
  }
};
