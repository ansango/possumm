import {
  DownloadLogRepository,
  CreateDownloadLogData
} from '@/core/domain/download/repositories/download-log-repository';
import { DownloadLog } from '@/core/domain/download/entities/download-log';
import { downloadsDb } from '@/lib/db/downloads/database';
import { Database } from 'bun:sqlite';

/**
 * SQLite implementation of DownloadLogRepository.
 *
 * Infrastructure layer - Concrete repository using SQLite for log persistence.
 */
export class SQLiteDownloadLogRepository implements DownloadLogRepository {
  private db: Database;

  constructor() {
    this.db = downloadsDb;
  }

  async create(log: CreateDownloadLogData): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO job_logs (download_id, event_type, message, metadata)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      log.downloadId,
      log.eventType,
      log.message,
      log.metadata ? JSON.stringify(log.metadata) : null
    );
  }

  async findByDownloadId(
    downloadId: number,
    page: number,
    pageSize: number
  ): Promise<DownloadLog[]> {
    const offset = page * pageSize;
    const stmt = this.db.prepare(`
      SELECT * FROM job_logs
      WHERE download_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(downloadId, pageSize, offset);
    return rows.map((row) => DownloadLog.fromDatabase(row));
  }

  async countByDownloadId(downloadId: number): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM job_logs
      WHERE download_id = ?
    `);

    const result = stmt.get(downloadId) as { count: number };
    return result.count;
  }

  async deleteOldLogs(days: number): Promise<number> {
    const stmt = this.db.prepare(`
      DELETE FROM job_logs
      WHERE timestamp < datetime('now', '-' || ? || ' days')
    `);

    const result = stmt.run(days);
    return result.changes;
  }
}
