import { createRoute } from '@hono/zod-openapi';
import {
  ErrorSchema,
  ExecuteYtDlpCommandSchema,
  ExecuteYtDlpCommandResponseSchema
} from '@/lib/schemas';
import { z } from 'zod';

/**
 * Route for executing yt-dlp commands in sandbox mode (REST).
 *
 * POST /api/sandbox/yt-dlp
 *
 * Allows testing arbitrary yt-dlp commands safely.
 * The server automatically prepends 'yt-dlp', '--js-runtime', 'bun' to all commands.
 */
export const executeYtDlpCommandRoute = createRoute({
  method: 'post',
  path: '/yt-dlp',
  tags: ['Sandbox'],
  summary: 'Execute yt-dlp command',
  description:
    'Execute a yt-dlp command for testing purposes. The server automatically prepends "yt-dlp --js-runtime bun" to your command. This endpoint is for development and testing only.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ExecuteYtDlpCommandSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ExecuteYtDlpCommandResponseSchema
        }
      },
      description:
        'Command executed successfully. Returns stdout, stderr, and exit code. Exit code 0 indicates success, non-zero indicates an error occurred.'
    },
    400: {
      description:
        'Invalid command: command cannot be empty or start with "yt-dlp" (automatically prepended by server).',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    },
    500: {
      description: 'Internal server error: failed to execute command or parse output.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    }
  }
});

export type ExecuteYtDlpCommandRoute = typeof executeYtDlpCommandRoute;

/**
 * Route for executing yt-dlp commands in sandbox mode with SSE streaming.
 *
 * POST /api/sandbox/yt-dlp/stream
 *
 * Streams command execution progress via Server-Sent Events (SSE).
 * Allows real-time monitoring of yt-dlp command output.
 */
export const executeYtDlpCommandStreamRoute = createRoute({
  method: 'post',
  path: '/yt-dlp/stream',
  tags: ['Sandbox'],
  summary: 'Execute yt-dlp command with SSE streaming',
  description:
    'Execute a yt-dlp command with real-time streaming output via Server-Sent Events. The server automatically prepends "yt-dlp --js-runtime bun" to your command. Events include: start, stdout, stderr, progress, complete, error. This endpoint is for development and testing only.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ExecuteYtDlpCommandSchema
        }
      }
    }
  },
  responses: {
    200: {
      description:
        'SSE stream with real-time command execution. Event types: start (command begins), stdout (output line), stderr (error/info line), progress (download progress with percent/eta), complete (finished with exit code), error (fatal error).',
      content: {
        'text/event-stream': {
          schema: z.object({
            event: z.enum(['start', 'stdout', 'stderr', 'progress', 'complete', 'error']),
            data: z.string()
          })
        }
      }
    },
    400: {
      description:
        'Invalid command: command cannot be empty or start with "yt-dlp" (automatically prepended by server).',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    },
    500: {
      description: 'Internal server error: failed to execute command.',
      content: {
        'application/json': {
          schema: ErrorSchema
        }
      }
    }
  }
});

export type ExecuteYtDlpCommandStreamRoute = typeof executeYtDlpCommandStreamRoute;
