export type DownloadStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

export class DownloadItem {
  constructor(
    public readonly id: number,
    public readonly url: string,
    public readonly normalizedUrl: string,
    public readonly mediaId: number | null,
    public readonly status: DownloadStatus,
    public readonly progress: number,
    public readonly errorMessage: string | null,
    public readonly filePath: string | null,
    public readonly processId: number | null,
    public readonly createdAt: Date,
    public readonly startedAt: Date | null,
    public readonly finishedAt: Date | null,
  ) {}

  static fromDatabase(row: any): DownloadItem {
    return new DownloadItem(
      row.id,
      row.url,
      row.normalized_url,
      row.media_id,
      row.status as DownloadStatus,
      row.progress ?? 0,
      row.error_message,
      row.file_path,
      row.process_id,
      new Date(row.created_at),
      row.started_at ? new Date(row.started_at) : null,
      row.finished_at ? new Date(row.finished_at) : null,
    );
  }

  toJSON() {
    return {
      id: this.id,
      url: this.url,
      mediaId: this.mediaId,
      status: this.status,
      progress: this.progress,
      errorMessage: this.errorMessage,
      filePath: this.filePath,
      processId: this.processId,
      createdAt: this.createdAt.toISOString(),
      startedAt: this.startedAt?.toISOString() ?? null,
      finishedAt: this.finishedAt?.toISOString() ?? null,
    };
  }
}
