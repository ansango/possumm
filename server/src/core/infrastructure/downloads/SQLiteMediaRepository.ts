import { MediaRepository } from "@/core/domain/media/repositories/media-repository";
import { MediaItem, Provider } from "@/core/domain/media/entities/media";
import { downloadsDb } from "@/lib/db/downloads/database";
import { Database } from "bun:sqlite";

interface EditableMediaFields {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  albumArtist?: string | null;
  year?: string | null;
  coverUrl?: string | null;
  duration?: number | null;
  tracks?: { track: number | null; title: string | null; duration: number | null }[] | null;
}

export class SQLiteMediaRepository implements MediaRepository {
  private db: Database;

  constructor() {
    this.db = downloadsDb;
  }

  async findById(id: number): Promise<MediaItem | null> {
    const stmt = this.db.prepare("SELECT * FROM media WHERE id = ?");
    const row = stmt.get(id) as any;
    return row ? MediaItem.fromDatabase(row) : null;
  }

  async findByProviderAndProviderId(
    provider: Provider,
    providerId: string
  ): Promise<MediaItem | null> {
    const stmt = this.db.prepare(
      "SELECT * FROM media WHERE provider = ? AND provider_id = ?"
    );
    const row = stmt.get(provider, providerId) as any;
    return row ? MediaItem.fromDatabase(row) : null;
  }

  async findAll(page: number, pageSize: number): Promise<MediaItem[]> {
    const offset = page * pageSize;
    const stmt = this.db.prepare(`
      SELECT * FROM media
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(pageSize, offset) as any[];
    return rows.map((row) => MediaItem.fromDatabase(row));
  }

  async countAll(): Promise<number> {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM media");
    const result = stmt.get() as { count: number };
    return result.count;
  }

  async create(media: Omit<MediaItem, "id" | "createdAt" | "updatedAt">): Promise<MediaItem> {
    const stmt = this.db.prepare(`
      INSERT INTO media (
        title, artist, album, album_artist, year, cover_url, duration,
        provider, provider_id, kind, tracks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      media.title,
      media.artist,
      media.album,
      media.albumArtist,
      media.year,
      media.coverUrl,
      media.duration,
      media.provider,
      media.providerId,
      media.kind,
      media.tracks ? JSON.stringify(media.tracks) : null
    );

    const id = Number(result.lastInsertRowid);
    const created = await this.findById(id);
    
    if (!created) {
      throw new Error("Failed to create media");
    }

    return created;
  }

  async updateMetadata(id: number, fields: EditableMediaFields): Promise<void> {
    // Validate that provider and provider_id are not in fields
    if ("provider" in fields || "providerId" in fields) {
      throw new Error("Cannot update provider or providerId fields");
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (fields.title !== undefined) {
      updates.push("title = ?");
      values.push(fields.title);
    }
    if (fields.artist !== undefined) {
      updates.push("artist = ?");
      values.push(fields.artist);
    }
    if (fields.album !== undefined) {
      updates.push("album = ?");
      values.push(fields.album);
    }
    if (fields.albumArtist !== undefined) {
      updates.push("album_artist = ?");
      values.push(fields.albumArtist);
    }
    if (fields.year !== undefined) {
      updates.push("year = ?");
      values.push(fields.year);
    }
    if (fields.coverUrl !== undefined) {
      updates.push("cover_url = ?");
      values.push(fields.coverUrl);
    }
    if (fields.duration !== undefined) {
      updates.push("duration = ?");
      values.push(fields.duration);
    }
    if (fields.tracks !== undefined) {
      updates.push("tracks = ?");
      values.push(fields.tracks ? JSON.stringify(fields.tracks) : null);
    }

    if (updates.length === 0) {
      return;
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE media
      SET ${updates.join(", ")}
      WHERE id = ?
    `);

    stmt.run(...values);
  }

  async delete(id: number): Promise<void> {
    const stmt = this.db.prepare("DELETE FROM media WHERE id = ?");
    stmt.run(id);
  }

  async deleteAll(): Promise<void> {
    const stmt = this.db.prepare("DELETE FROM media");
    stmt.run();
  }
}
