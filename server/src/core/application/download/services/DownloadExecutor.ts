import { spawn, Subprocess } from "bun";
import { Provider } from "@/core/domain/media/entities/media";
import type { PinoLogger } from "hono-pino";

interface DownloadResult {
  filePath: string;
  processId: number;
}

export class DownloadExecutor {
  private activeProcesses: Map<number, Subprocess> = new Map();

  constructor(
    private readonly logger: PinoLogger,
    private readonly tempDir: string
  ) {}

  private getYtDlpArgs(provider: Provider, url: string, outputPath: string): string[] {
    const common = [
      "yt-dlp",
      "--js-runtime",
      "bun",
      "--no-warnings",
      "--cookies-from-browser",
      "firefox",
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      "--embed-thumbnail",
      "--add-metadata",
      "--write-thumbnail",
      "--convert-thumbnails",
      "jpg",
      "--replace-in-metadata",
      "title",
      "^.* - ",
      "",
      "--ppa",
      'ThumbnailsConvertor:-c:v mjpeg -vf crop="ih:ih"',
      "-P",
      outputPath,
    ];

    if (provider === "bandcamp") {
      return [
        ...common,
        "-o",
        "thumbnail:%(uploader|title)s/%(album,title)s/cover.%(ext)s",
        "-o",
        "%(uploader|title)s/%(album,title)s/%(playlist_index|01)02d %(title)s.%(ext)s",
        url,
      ];
    }

    // YouTube Music
    return [
      ...common,
      "--replace-in-metadata", "album_artist", "Various Artists", "Varios Artistas",
      "--replace-in-metadata", "uploader", " - Topic$", "",
      "--replace-in-metadata", "artist", " - Topic$", "",
      "--replace-in-metadata", "album_artist", " - Topic$", "",
      "--parse-metadata", "%(album_artist|Varios Artistas)s:%(album_artist)s",
      "--parse-metadata", "%(playlist_index|track_number)s:%(track_number)s",
      "--parse-metadata", "%(release_year,upload_date>%Y)s:%(meta_date)s",
      "-o", "thumbnail:%(album_artist|Varios Artistas)s/%(album|Unknown)s/cover.%(ext)s",
      "-o", "%(album_artist|Varios Artistas)s/%(album|Unknown)s/%(playlist_index|1)02d %(title)s.%(ext)s",
      url,
    ];
  }

  async execute(
    url: string,
    provider: Provider,
    onProgress: (progress: number) => void
  ): Promise<DownloadResult> {
    const outputPath = this.tempDir;
    const args = this.getYtDlpArgs(provider, url, outputPath);

    this.logger.info({ provider, outputPath }, "Starting download");

    const process = spawn({
      cmd: args,
      stdout: "pipe",
      stderr: "pipe",
    });

    const processId = process.pid;
    this.activeProcesses.set(processId, process);

    this.logger.info({ processId }, "Download process started");

    // Parse stderr for progress
    const progressRegex = /\[download\]\s+(\d+\.?\d*)%/;
    
    // Read stderr in chunks
    const reader = process.stderr.getReader();
    const decoder = new TextDecoder();
    
    const readStderr = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");
          
          for (const line of lines) {
            const match = progressRegex.exec(line);
            if (match) {
              const progress = Math.min(99, Math.floor(parseFloat(match[1])));
              onProgress(progress);
            }
          }
        }
      } catch (error) {
        this.logger.warn({ error }, "Error reading stderr");
      }
    };

    // Start reading stderr asynchronously
    readStderr();

    const exitCode = await process.exited;
    this.activeProcesses.delete(processId);

    if (exitCode !== 0) {
      const errorOutput = await new Response(process.stderr).text();
      this.logger.error({ exitCode, error: errorOutput }, "Download failed");
      throw new Error(`Download failed with exit code ${exitCode}: ${errorOutput}`);
    }

    // Report 100% on success
    onProgress(100);

    this.logger.info({ processId }, "Download completed successfully");

    // Return the output directory path
    return {
      filePath: outputPath,
      processId,
    };
  }

  cancel(processId: number): void {
    const process = this.activeProcesses.get(processId);
    
    if (!process) {
      this.logger.warn({ processId }, "Process not found for cancellation");
      return;
    }

    try {
      process.kill();
      this.activeProcesses.delete(processId);
      this.logger.info({ processId }, "Process cancelled successfully");
    } catch (error) {
      this.logger.error({ error, processId }, "Error cancelling process");
      throw error;
    }
  }
}
