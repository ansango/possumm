import { DownloadItem } from "../entities/download";

export interface DownloadRepository {
  findById(id: number): Promise<DownloadItem | null>;
  findAll(page: number, pageSize: number): Promise<DownloadItem[]>;
  countAll(): Promise<number>;
  create(
    download: Omit<DownloadItem, "id" | "createdAt" | "finishedAt">,
  ): Promise<DownloadItem>;
  updateStatus(
    id: number,
    status: "pending" | "in_progress" | "completed" | "failed",
    progress: number,
    errorMessage: string | null,
  ): Promise<void>;
  delete(id: number): Promise<void>;
  deleteAll(): Promise<void>;

}
