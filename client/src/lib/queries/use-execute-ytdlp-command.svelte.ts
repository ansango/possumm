import { createMutation } from '@tanstack/svelte-query';
import { API_CONFIG } from '$lib/config/api';

interface ExecuteYtDlpCommandParams {
  command: string;
}

interface ExecuteYtDlpCommandResponse {
  stdout: unknown;
  stderr: string;
  exitCode: number;
  isJsonOutput: boolean;
}

/**
 * Hook to execute yt-dlp commands in sandbox mode
 * @returns Mutation object for executing yt-dlp commands
 */
export function useExecuteYtDlpCommand() {
  return createMutation(() => ({
    mutationFn: async (params: ExecuteYtDlpCommandParams) => {
      const response = await fetch(`${API_CONFIG.BASE_URL}/sandbox/yt-dlp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command: params.command })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to execute command: ${response.statusText}`);
      }

      return response.json() as Promise<ExecuteYtDlpCommandResponse>;
    }
  }));
}
