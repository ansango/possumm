import { spawn, Subprocess } from 'bun';
import { Provider } from '@/core/domain/media/entities/media';
import type { PinoLogger } from 'hono-pino';

/**
 * Result from a successful download execution.
 */
interface DownloadResult {
	/** Temporary directory path where files were downloaded */
	filePath: string;
	/** Process ID of the yt-dlp process that executed the download */
	processId: number;
}

/**
 * Service for executing media downloads using yt-dlp.
 *
 * Application layer - Service managing yt-dlp process lifecycle.
 * Spawns yt-dlp processes with provider-specific arguments, parses
 * progress from stderr, and provides cancellation capability.
 *
 * Maintains a map of active processes for cancellation support.
 * Progress is parsed from yt-dlp's [download] XX.X% stderr output.
 */
export class DownloadExecutor {
	private activeProcesses: Map<number, Subprocess> = new Map();

	/**
	 * Creates a new DownloadExecutor instance.
	 *
	 * @param logger - Logger for structured logging
	 * @param tempDir - Temporary directory for downloads
	 */
	constructor(
		private readonly logger: PinoLogger,
		private readonly tempDir: string
	) {}

	/**
	 * Builds yt-dlp arguments for the specified provider.
	 *
	 * Common arguments:
	 * - Audio extraction: -x --audio-format mp3 --audio-quality 0
	 * - Metadata: --embed-thumbnail --add-metadata
	 * - Thumbnails: --write-thumbnail --convert-thumbnails jpg with square crop
	 * - Cookies: --cookies-from-browser firefox
	 *
	 * Provider-specific differences:
	 * - Bandcamp: Uses uploader/album/title for paths, minimal metadata cleanup
	 * - YouTube Music: Extensive metadata parsing and normalization (removes "- Topic",
	 *   handles "Various Artists", extracts track numbers and release years)
	 *
	 * @param provider - Platform provider (bandcamp or youtube)
	 * @param url - URL to download
	 * @param outputPath - Directory to save files
	 * @returns Array of command-line arguments for yt-dlp
	 *
	 * @example
	 * ```typescript
	 * const executor = new DownloadExecutor(logger, '/tmp');
	 *
	 * // Bandcamp arguments
	 * const bandcampArgs = executor['getYtDlpArgs'](
	 *   'bandcamp',
	 *   'https://artist.bandcamp.com/album/album-name',
	 *   '/tmp/downloads'
	 * );
	 * // Returns: [...common, '-o', 'thumbnail:%(uploader|title)s/...', ...]
	 *
	 * // YouTube Music arguments
	 * const youtubeArgs = executor['getYtDlpArgs'](
	 *   'youtube',
	 *   'https://music.youtube.com/watch?v=abc123',
	 *   '/tmp/downloads'
	 * );
	 * // Returns: [...common, '--replace-in-metadata', 'album_artist', ...]
	 * ```
	 */
	private getYtDlpArgs(provider: Provider, url: string, outputPath: string): string[] {
		const common = [
			'yt-dlp',
			'--js-runtime',
			'bun',
			'--no-warnings',
			'--cookies-from-browser',
			'firefox',
			'-x',
			'--audio-format',
			'mp3',
			'--audio-quality',
			'0',
			'--embed-thumbnail',
			'--add-metadata',
			'--write-thumbnail',
			'--convert-thumbnails',
			'jpg',
			'--replace-in-metadata',
			'title',
			'^.* - ',
			'',
			'--ppa',
			'ThumbnailsConvertor:-c:v mjpeg -vf crop="ih:ih"',
			'-P',
			outputPath
		];

		if (provider === 'bandcamp') {
			return [
				...common,
				'-o',
				'thumbnail:%(uploader|title)s/%(album,title)s/cover.%(ext)s',
				'-o',
				'%(uploader|title)s/%(album,title)s/%(playlist_index|01)02d %(title)s.%(ext)s',
				url
			];
		}

		// YouTube Music
		return [
			...common,
			'--replace-in-metadata',
			'album_artist',
			'Various Artists',
			'Varios Artistas',
			'--replace-in-metadata',
			'uploader',
			' - Topic$',
			'',
			'--replace-in-metadata',
			'artist',
			' - Topic$',
			'',
			'--replace-in-metadata',
			'album_artist',
			' - Topic$',
			'',
			'--parse-metadata',
			'%(uploader|album_artist|Varios Artistas)s:%(album_artist)s',
			'--parse-metadata',
			'%(playlist_index|track_number)s:%(track_number)s',
			'--parse-metadata',
			'%(release_year,upload_date>%Y)s:%(meta_date)s',
			'-o',
			'thumbnail:%(uploader|album_artist|Varios Artistas)s/%(album|Unknown)s/cover.%(ext)s',
			'-o',
			'%(uploader|album_artist|Varios Artistas)s/%(album|Unknown)s/%(playlist_index|1)02d %(title)s.%(ext)s',
			url
		];
	}

	/**
	 * Executes a download using yt-dlp.
	 *
	 * Flow:
	 * 1. Builds provider-specific yt-dlp arguments
	 * 2. Spawns yt-dlp process with stdout/stderr pipes
	 * 3. Tracks process in activeProcesses map for cancellation support
	 * 4. Parses stderr asynchronously for [download] XX.X% progress
	 * 5. Calls onProgress callback with percentage (capped at 99 during download)
	 * 6. Waits for process exit
	 * 7. Reports 100% progress on success
	 * 8. Returns output directory path and process ID
	 *
	 * Progress parsing uses regex /\[download\]\s+(\d+\.?\d*)%/ on stderr.
	 * Progress is capped at 99% during download, only reports 100% on successful exit.
	 *
	 * @param url - URL to download
	 * @param provider - Platform provider (bandcamp or youtube)
	 * @param onProgress - Callback invoked with progress percentage (0-100)
	 * @returns Download result with file path and process ID
	 * @throws Error if yt-dlp exits with non-zero code
	 *
	 * @example
	 * ```typescript
	 * const executor = new DownloadExecutor(logger, '/tmp/downloads');
	 *
	 * // Execute YouTube Music download with progress tracking
	 * const result = await executor.execute(
	 *   'https://music.youtube.com/watch?v=abc123',
	 *   'youtube',
	 *   (progress) => {
	 *     console.log(`Progress: ${progress}%`);
	 *     // Called multiple times: 0%, 25%, 50%, 75%, 99%, 100%
	 *   }
	 * );
	 * // Returns: { filePath: '/tmp/downloads', processId: 12345 }
	 *
	 * // Execute Bandcamp album download
	 * const result = await executor.execute(
	 *   'https://artist.bandcamp.com/album/album-name',
	 *   'bandcamp',
	 *   (progress) => {
	 *     // Progress callback for each track in album
	 *     // May go: 10%, 20%, ..., 90%, 99%, 100%
	 *   }
	 * );
	 *
	 * // Error case
	 * try {
	 *   await executor.execute('invalid-url', 'youtube', () => {});
	 * } catch (error) {
	 *   // Error: Download failed with exit code 1: ERROR: ...
	 * }
	 * ```
	 */
	async execute(
		url: string,
		provider: Provider,
		onProgress: (progress: number) => void
	): Promise<DownloadResult> {
		const outputPath = this.tempDir;
		const args = this.getYtDlpArgs(provider, url, outputPath);

		this.logger.info({ provider, outputPath }, 'Starting download');

		const process = spawn({
			cmd: args,
			stdout: 'pipe',
			stderr: 'pipe'
		});

		const processId = process.pid;
		this.activeProcesses.set(processId, process);

		this.logger.info({ processId }, 'Download process started');

		// Parse stderr for progress and capture full output
		const progressRegex = /\[download\]\s+(\d+\.?\d*)%/;

		// Read stderr in chunks
		const reader = process.stderr.getReader();
		const decoder = new TextDecoder();
		let stderrOutput = ''; // Capture full stderr for error reporting

		const readStderr = async () => {
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const text = decoder.decode(value, { stream: true });
					stderrOutput += text; // Accumulate stderr output
					const lines = text.split('\n');

					for (const line of lines) {
						const match = progressRegex.exec(line);
						if (match) {
							const progress = Math.min(99, Math.floor(parseFloat(match[1])));
							onProgress(progress);
						}
					}
				}
			} catch (error) {
				this.logger.warn({ error }, 'Error reading stderr');
			}
		};

		// Wait for stderr reading to complete
		await readStderr();

		const exitCode = await process.exited;
		this.activeProcesses.delete(processId);

		if (exitCode !== 0) {
			this.logger.error({ exitCode, error: stderrOutput }, 'Download failed');
			throw new Error(
				`Download failed with exit code ${exitCode}: ${stderrOutput || 'Unknown error'}`
			);
		}

		// Report 100% on success
		onProgress(100);

		this.logger.info({ processId }, 'Download completed successfully');

		// Return the output directory path
		return {
			filePath: outputPath,
			processId
		};
	}

	/**
	 * Cancels an active download process.
	 *
	 * Looks up the process by ID in activeProcesses map, sends kill signal,
	 * and removes from tracking. Logs warning if process not found (already
	 * completed or invalid ID).
	 *
	 * @param processId - Process ID to cancel
	 * @throws Error if process.kill() fails
	 *
	 * @example
	 * ```typescript
	 * const executor = new DownloadExecutor(logger, '/tmp/downloads');
	 *
	 * // Start download
	 * const promise = executor.execute(
	 *   'https://music.youtube.com/watch?v=abc123',
	 *   'youtube',
	 *   (progress) => console.log(progress)
	 * );
	 *
	 * // Cancel after 2 seconds
	 * setTimeout(() => {
	 *   executor.cancel(12345); // Uses process ID from result
	 *   // Logs: "Process cancelled successfully"
	 * }, 2000);
	 *
	 * // Try to cancel non-existent process
	 * executor.cancel(99999);
	 * // Logs: "Process not found for cancellation"
	 * ```
	 */
	cancel(processId: number): void {
		const process = this.activeProcesses.get(processId);

		if (!process) {
			this.logger.warn({ processId }, 'Process not found for cancellation');
			return;
		}

		try {
			process.kill();
			this.activeProcesses.delete(processId);
			this.logger.info({ processId }, 'Process cancelled successfully');
		} catch (error) {
			this.logger.error({ error, processId }, 'Error cancelling process');
			throw error;
		}
	}
}
