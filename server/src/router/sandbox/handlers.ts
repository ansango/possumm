import { AppRouteHandler, AppRouteHook } from '@/types';
import { ExecuteYtDlpCommandRoute } from './routes';
import { ExecuteYtDlpCommand } from '@/core/application/sandbox/use-cases/ExecuteYtDlpCommand';

/**
 * Collection of sandbox-related use cases injected into handlers.
 */
interface SandboxUseCases {
  executeYtDlpCommand: ExecuteYtDlpCommand;
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

  return {
    executeYtDlp
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
