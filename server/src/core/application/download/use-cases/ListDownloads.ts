import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import { DownloadStatus } from "@/core/domain/download/entities/download";
import type { PinoLogger } from "hono-pino";

interface ListDownloadsResult {
  downloads: Array<{
    id: number;
    url: string;
    status: string;
    progress: number;
    errorMessage: string | null;
    filePath: string | null;
    createdAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

export class ListDownloads {
  constructor(
    private readonly downloadRepo: DownloadRepository,
    private readonly logger: PinoLogger
  ) {}

  async execute(
    status?: DownloadStatus,
    page: number = 0,
    pageSize: number = 20
  ): Promise<ListDownloadsResult> {
    const downloads = status
      ? await this.downloadRepo.findByStatus(status, page, pageSize)
      : await this.downloadRepo.findAll(page, pageSize);

    const total = status
      ? await this.downloadRepo.countByStatus(status)
      : await this.downloadRepo.countAll();

    return {
      downloads: downloads.map((d) => ({
        id: d.id!,
        url: d.url,
        status: d.status,
        progress: d.progress,
        errorMessage: d.errorMessage,
        filePath: d.filePath,
        createdAt: d.createdAt,
        startedAt: d.startedAt,
        finishedAt: d.finishedAt,
      })),
      total,
      page,
      pageSize,
    };
  }
}
