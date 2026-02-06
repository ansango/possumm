import { DownloadItem, DownloadStatus } from "../entities/download";

export interface DownloadRepository {
  findById(id: number): Promise<DownloadItem | null>;
  findNextPending(): Promise<DownloadItem | null>;
  findActiveByNormalizedUrl(normalizedUrl: string): Promise<DownloadItem | null>;
  findByStatus(status: DownloadStatus, page: number, pageSize: number): Promise<DownloadItem[]>;
  findAll(page: number, pageSize: number): Promise<DownloadItem[]>;
  findOldCompleted(days: number): Promise<DownloadItem[]>;
  findStalledInProgress(timeoutMinutes: number): Promise<DownloadItem[]>;
  countAll(): Promise<number>;
  countByStatus(status: DownloadStatus): Promise<number>;
  create(
    download: Omit<DownloadItem, "id" | "createdAt" | "startedAt" | "finishedAt">,
  ): Promise<DownloadItem>;
  updateStatus(
    id: number,
    status: DownloadStatus,
    progress: number,
    errorMessage: string | null,
    filePath?: string | null,
  ): Promise<void>;
  updateProcessId(id: number, processId: number): Promise<void>;
  delete(id: number): Promise<void>;
  deleteAll(): Promise<void>;
}
