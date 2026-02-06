

export class DownloadItem {
  constructor(
    public readonly id: number,
    public readonly mediaId: number,
    public readonly status: "pending" | "in_progress" | "completed" | "failed",
    public readonly progress: number, // 0 to 100
    public readonly errorMessage: string | null,
    public readonly createdAt: Date,
    public readonly finishedAt: Date | null,
  ) {}
  
}
