export type DownloadStatus =
  | 'pending'
  | 'downloading'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'stalled';

export interface Download {
  id: number;
  url: string;
  status: DownloadStatus;
  progress: number;
  errorMessage: string | null;
  filePath: string | null;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface DownloadsResponse {
  downloads: Download[];
  total: number;
  page: number;
  pageSize: number;
}
