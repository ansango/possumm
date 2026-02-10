export const createTableMedia = `
  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    artist TEXT,
    album TEXT,
    album_artist TEXT,
    year TEXT,
    cover_url TEXT,
    duration INTEGER,
    provider TEXT NOT NULL,
    provider_id TEXT,
    kind TEXT,
    tracks TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, provider_id) ON CONFLICT IGNORE
  )
`;

export const createTableDownloads = `
  CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    media_id INTEGER,
    status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0,
    error_message TEXT,
    file_path TEXT,
    process_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    finished_at TEXT,
    FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE SET NULL
  )
`;

export const createIndexMediaProviderId = `
  CREATE INDEX IF NOT EXISTS idx_media_provider_id 
  ON media(provider_id)
`;

export const createIndexDownloadsStatus = `
  CREATE INDEX IF NOT EXISTS idx_downloads_status 
  ON downloads(status)
`;

export const createIndexDownloadsCreatedAt = `
  CREATE INDEX IF NOT EXISTS idx_downloads_created_at 
  ON downloads(created_at)
`;

export const createIndexDownloadsStartedAt = `
  CREATE INDEX IF NOT EXISTS idx_downloads_started_at 
  ON downloads(started_at)
`;

export const createIndexDownloadsNormalizedUrl = `
  CREATE INDEX IF NOT EXISTS idx_downloads_normalized_url 
  ON downloads(normalized_url)
`;

export const createIndexDownloadsProcessId = `
  CREATE INDEX IF NOT EXISTS idx_downloads_process_id 
  ON downloads(process_id)
`;

export const createIndexDownloadsNormalizedUrlStatus = `
  CREATE INDEX IF NOT EXISTS idx_downloads_normalized_url_status 
  ON downloads(normalized_url, status)
`;

export const createIndexDownloadsStatusStartedAt = `
  CREATE INDEX IF NOT EXISTS idx_downloads_status_started_at 
  ON downloads(status, started_at)
`;

export const createTableJobLogs = `
  CREATE TABLE IF NOT EXISTS job_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    download_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (download_id) REFERENCES downloads(id) ON DELETE CASCADE
  )
`;

export const createIndexJobLogsDownloadId = `
  CREATE INDEX IF NOT EXISTS idx_job_logs_download_id 
  ON job_logs(download_id)
`;

export const createIndexJobLogsTimestamp = `
  CREATE INDEX IF NOT EXISTS idx_job_logs_timestamp 
  ON job_logs(timestamp)
`;
