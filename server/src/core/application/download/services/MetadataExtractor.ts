import { spawn } from "bun";
import { Provider } from "@/core/domain/media/entities/media";
import type { PinoLogger } from "hono-pino";

interface MetadataResult {
  title: string | null;
  artist: string | null;
  album: string | null;
  album_artist: string | null;
  release_year: string | null;
  upload_date: string | null;
  thumbnail: string | null;
  duration: number | null;
  id: string | null;
  uploader: string | null;
  _type?: string;
  entries?: any[];
}

export class MetadataExtractor {
  constructor(private readonly logger: PinoLogger) {}

  async extract(url: string, provider: Provider): Promise<MetadataResult> {
    this.logger.info({ url, provider }, "Extracting metadata from URL");

    try {
      const process = spawn({
        cmd: [
          "yt-dlp",
          "--js-runtime",
          "bun",
          "--skip-download",
          "--dump-json",
          "--flat-playlist",
          url,
        ],
        stdout: "pipe",
        stderr: "pipe",
      });

      const output = await new Response(process.stdout).text();
      const exitCode = await process.exited;

      if (exitCode !== 0) {
        const errorOutput = await new Response(process.stderr).text();
        this.logger.error({ exitCode, error: errorOutput }, "yt-dlp metadata extraction failed");
        throw new Error(`Failed to extract metadata: ${errorOutput}`);
      }

      // Parse JSON lines
      const lines = output.trim().split("\n").filter((line) => line.length > 0);
      
      if (lines.length === 0) {
        throw new Error("No metadata returned from yt-dlp");
      }

      // Parse first line as main metadata
      let metadata: MetadataResult;
      try {
        metadata = JSON.parse(lines[0]);
      } catch (parseError) {
        this.logger.error({ parseError, line: lines[0] }, "Failed to parse metadata JSON");
        throw new Error("Failed to parse metadata JSON");
      }

      // If there are multiple lines, it's likely a playlist
      if (lines.length > 1) {
        metadata.entries = [];
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            metadata.entries.push(entry);
          } catch {
            this.logger.warn({ line }, "Failed to parse playlist entry, skipping");
          }
        }
        metadata._type = "playlist";
      }

      // Log warnings for incomplete metadata
      if (!metadata.title) {
        this.logger.warn("Metadata missing title");
      }
      if (!metadata.artist && !metadata.uploader) {
        this.logger.warn("Metadata missing artist/uploader");
      }

      this.logger.info({ 
        title: metadata.title, 
        artist: metadata.artist || metadata.uploader,
        type: metadata._type 
      }, "Metadata extracted successfully");

      return metadata;
    } catch (error) {
      this.logger.error({ error, url }, "Error extracting metadata");
      throw error;
    }
  }
}
