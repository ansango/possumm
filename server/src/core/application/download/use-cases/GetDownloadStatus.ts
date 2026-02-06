import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import { MediaRepository } from "@/core/domain/media/repositories/media-repository";
import type { PinoLogger } from "hono-pino";

interface DownloadStatusResult {
  download: {
    id: number;
    url: string;
    status: string;
    progress: number;
    errorMessage: string | null;
    filePath: string | null;
    processId: number | null;
    createdAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
  };
  media: {
    id: number;
    title: string | null;
    artist: string | null;
    album: string | null;
    duration: number | null;
    coverUrl: string | null;
  } | null;
}

export class GetDownloadStatus {
  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly mediaRepo: MediaRepository,
    private readonly logger: PinoLogger
  ) {}

  async execute(downloadId: number): Promise<DownloadStatusResult> {
    const download = await this.downloadRepo.findById(downloadId);
    if (!download) {
      throw new Error(`Download ${downloadId} not found`);
    }

    let media = null;
    if (download.mediaId) {
      const mediaItem = await this.mediaRepo.findById(download.mediaId);
      if (mediaItem) {
        media = {
          id: mediaItem.id!,
          title: mediaItem.title,
          artist: mediaItem.artist,
          album: mediaItem.album,
          duration: mediaItem.duration,
          coverUrl: mediaItem.coverUrl,
        };
      }
    }

    return {
      download: {
        id: download.id!,
        url: download.url,
        status: download.status,
        progress: download.progress,
        errorMessage: download.errorMessage,
        filePath: download.filePath,
        processId: download.processId,
        createdAt: download.createdAt,
        startedAt: download.startedAt,
        finishedAt: download.finishedAt,
      },
      media,
    };
  }
}
