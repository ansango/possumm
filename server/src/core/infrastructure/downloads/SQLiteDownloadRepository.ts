import { DownloadRepository } from "@/core/domain/download/repositories/download-repository";
import { DownloadItem, DownloadStatus } from "@/core/domain/download/entities/download";
import { downloadsDb } from "@/lib/db/downloads/database";
import { Database } from "bun:sqlite";

export class SQLiteDownloadRepository implements DownloadRepository {
  private db: Database;

  constructor() {
    this.db = downloadsDb;
  }

  async findById(id: number): Promise<DownloadItem | null> {
    const stmt = this.db.prepare("SELECT * FROM downloads WHERE id = ?");
    const row = stmt.get(id) as any;
    return row ? DownloadItem.fromDatabase(row) : null;
  }

  async findNextPending(): Promise<DownloadItem | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM downloads
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
    `);
    const row = stmt.get() as any;
    return row ? DownloadItem.fromDatabase(row) : null;
  }

  async findActiveByNormalizedUrl(normalizedUrl: string): Promise<DownloadItem | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM downloads
      WHERE normalized_url = ? AND status IN ('pending', 'in_progress')
      LIMIT 1
    `);
    const row = stmt.get(normalizedUrl) as any;
    return row ? DownloadItem.fromDatabase(row) : null;
  }

  async findByStatus(
    status: DownloadStatus,
    page: number,
    pageSize: number
  ): Promise<DownloadItem[]> {
    const offset = page * pageSize;
    const stmt = this.db.prepare(`
      SELECT * FROM downloads
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(status, pageSize, offset) as any[];
    return rows.map((row) => DownloadItem.fromDatabase(row));
  }

  async findAll(page: number, pageSize: number): Promise<DownloadItem[]> {
    const offset = page * pageSize;
    const stmt = this.db.prepare(`
      SELECT * FROM downloads
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(pageSize, offset) as any[];
    return rows.map((row) => DownloadItem.fromDatabase(row));
  }

  async findOldCompleted(days: number): Promise<DownloadItem[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM downloads
      WHERE (status = 'completed' OR status = 'failed')
      AND finished_at < datetime('now', '-' || ? || ' days')
    `);
    const rows = stmt.all(days) as any[];
    return rows.map((row) => DownloadItem.fromDatabase(row));
  }

  async findStalledInProgress(timeoutMinutes: number): Promise<DownloadItem[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM downloads
      WHERE status = 'in_progress'
      AND started_at < datetime('now', '-' || ? || ' minutes')
    `);
    const rows = stmt.all(timeoutMinutes) as any[];
    return rows.map((row) => DownloadItem.fromDatabase(row));
  }

  async countAll(): Promise<number> {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM downloads");
    const result = stmt.get() as { count: number };
    return result.count;
  }

  async countByStatus(status: DownloadStatus): Promise<number> {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM downloads WHERE status = ?");
    const result = stmt.get(status) as { count: number };
    return result.count;
  }

  async create(
    download: Omit<DownloadItem, "id" | "createdAt" | "startedAt" | "finishedAt">
  ): Promise<DownloadItem> {
    const stmt = this.db.prepare(`
      INSERT INTO downloads (
        url, normalized_url, media_id, status, progress, error_message, file_path, process_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      download.url,
      download.normalizedUrl,
      download.mediaId,
      download.status,
      download.progress,
      download.errorMessage,
      download.filePath,
      download.processId
    );

    const id = Number(result.lastInsertRowid);
    const created = await this.findById(id);

    if (!created) {
      throw new Error("Failed to create download");
    }

    return created;
  }

  async updateStatus(
    id: number,
    status: DownloadStatus,
    progress: number,
    errorMessage: string | null,
    filePath?: string | null
  ): Promise<void> {
    const updates: string[] = ["status = ?", "progress = ?", "error_message = ?"];
    const values: any[] = [status, progress, errorMessage];

    if (filePath !== undefined) {
      updates.push("file_path = ?");
      values.push(filePath);
    }

    if (status === "completed" || status === "failed" || status === "cancelled") {
      updates.push("finished_at = datetime('now')");
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE downloads
      SET ${updates.join(", ")}
      WHERE id = ?
    `);

    stmt.run(...values);
  }

  async updateProcessId(id: number, processId: number): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE downloads
      SET process_id = ?, started_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(processId, id);
  }

  async delete(id: number): Promise<void> {
    const stmt = this.db.prepare("DELETE FROM downloads WHERE id = ?");
    stmt.run(id);
  }

  async deleteAll(): Promise<void> {
    const stmt = this.db.prepare("DELETE FROM downloads");
    stmt.run();
  }
}
