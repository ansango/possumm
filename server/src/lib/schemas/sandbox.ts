import { z } from 'zod';

/**
 * Schema for executing yt-dlp commands in sandbox.
 *
 * The command string should NOT include 'yt-dlp', '--js-runtime', 'bun'
 * as these are automatically prepended by the server.
 *
 * Example valid commands:
 * - "--help"
 * - "--version"
 * - '--skip-download --dump-json "https://music.youtube.com/watch?v=abc123"'
 */
export const ExecuteYtDlpCommandSchema = z.object({
  command: z
    .string()
    .min(1, 'Command cannot be empty')
    .refine((cmd) => !cmd.startsWith('yt-dlp'), {
      message: 'Command should not start with "yt-dlp" - it will be added automatically'
    })
    .openapi({
      description:
        'yt-dlp command arguments (without "yt-dlp" prefix). The server will automatically prepend "yt-dlp --js-runtime bun" to your command.',
      example: '--version'
    })
});

/**
 * Schema for yt-dlp command execution response.
 *
 * The stdout field can be:
 * - A parsed JSON object (when yt-dlp returns JSON)
 * - An array of JSON objects (for playlists/multiple entries)
 * - A raw string (for non-JSON output like --help, --version)
 */
export const ExecuteYtDlpCommandResponseSchema = z.object({
  stdout: z.union([z.any(), z.string()]).openapi({
    description:
      'Standard output from yt-dlp command. Automatically parsed as JSON object/array if output is JSON, otherwise returned as string.',
    example: { title: 'Song Name', artist: 'Artist Name', duration: 240 }
  }),
  stderr: z.string().openapi({
    description: 'Standard error output from yt-dlp command',
    example: ''
  }),
  exitCode: z.number().openapi({
    description: 'Process exit code (0 = success, non-zero = error)',
    example: 0
  }),
  isJsonOutput: z.boolean().openapi({
    description: 'Indicates whether stdout was successfully parsed as JSON',
    example: true
  })
});
