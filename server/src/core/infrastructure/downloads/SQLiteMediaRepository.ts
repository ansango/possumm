import { MediaRepository } from "@/core/domain/media/repositories/media-repository";
import { MediaItem, Provider } from "@/core/domain/media/entities/media";
import { downloadsDb } from "@/lib/db/downloads/database";
import { Database } from "bun:sqlite";

/**
 * Editable fields for media metadata updates.
 * 
 * Excludes provider and providerId which are immutable after creation.
 */
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

/**
 * SQLite implementation of MediaRepository.
 * 
 * Infrastructure layer - Concrete repository using SQLite for persistence.
 * Uses Bun's native SQLite driver with prepared statements.
 * 
 * Database schema features:
 * - Unique index on (provider, provider_id) for duplicate prevention
 * - Timestamps (created_at, updated_at) for change tracking
 * - JSON column for tracks array (serialized on write, parsed on read)
 * - Foreign keys from downloads table with ON DELETE SET NULL
 * 
 * Provider and providerId are immutable - cannot be changed after creation.
 * This ensures consistent mapping to external media sources.
 * 
 * @see MediaRepository - For interface documentation
 * @see downloadsDb - For database connection configuration
 */
export class SQLiteMediaRepository implements MediaRepository {
  private db: Database;

  /**
   * Creates a new SQLiteMediaRepository instance.
   * 
   * Initializes with shared database connection from downloadsDb.
   */
  constructor() {
    this.db = downloadsDb;
  }

  /**
   * Finds media by ID.
   * 
   * SQL: `SELECT * FROM media WHERE id = ?`
   * 
   * @param id - Media ID
   * @returns Media if found, null otherwise
   * 
   * @example
   * ```typescript
   * const repo = new SQLiteMediaRepository();
   * const media = await repo.findById(100);
   * // Returns: MediaItem { id: 100, title: 'Song', provider: 'youtube', ... }
   * ```
   */
  async findById(id: number): Promise<MediaItem | null> {
    const stmt = this.db.prepare("SELECT * FROM media WHERE id = ?");
    const row = stmt.get(id) as any;
    return row ? MediaItem.fromDatabase(row) : null;
  }

  /**
   * Finds media by provider and provider ID (duplicate prevention).
   * 
   * SQL: `SELECT * FROM media WHERE provider = ? AND provider_id = ?`
   * 
   * Uses unique index on (provider, provider_id) for fast lookup.
   * Called before creating media to avoid duplicates.
   * 
   * @param provider - Platform provider (bandcamp or youtube)
   * @param providerId - Provider-specific ID
   * @returns Media if found, null otherwise
   * 
   * @example
   * ```typescript
   * const existing = await repo.findByProviderAndProviderId('youtube', 'abc123');
   * // Returns: MediaItem if this YouTube video is already in database
   * // null if not found
   * ```
   */
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

  /**
   * Finds all media with pagination.
   * 
   * SQL:\n   * ```sql\n   * SELECT * FROM media\n   * ORDER BY created_at DESC\n   * LIMIT ? OFFSET ?\n   * ```\n   * \n   * Results ordered newest first. Pagination is 0-based.\n   * \n   * @param page - Page number (0-based)\n   * @param pageSize - Items per page\n   * @returns Array of media items\n   * \n   * @example\n   * ```typescript\n   * const media = await repo.findAll(0, 20);\n   * // Returns: First 20 media items ordered by created_at DESC\n   * ```\n   */
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

  /**
   * Counts all media items.
   * 
   * SQL: `SELECT COUNT(*) as count FROM media`
   * 
   * @returns Total number of media items
   * 
   * @example
   * ```typescript
   * const total = await repo.countAll();
   * // Returns: 200
   * ```
   */
  async countAll(): Promise<number> {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM media");
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Creates a new media item.
   * 
   * SQL:
   * ```sql
   * INSERT INTO media (
   *   title, artist, album, album_artist, year, cover_url, duration,
   *   provider, provider_id, kind, tracks
   * ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   * ```
   * 
   * Tracks array is JSON-serialized before storage.
   * Timestamps (created_at, updated_at) set by database defaults.
   * 
   * @param media - Media data to create (without id, createdAt, updatedAt)
   * @returns Created media with generated ID
   * @throws Error if creation fails or record cannot be retrieved
   * 
   * @example
   * ```typescript
   * // Create YouTube track
   * const track = await repo.create({
   *   title: 'Song Title',
   *   artist: 'Artist Name',
   *   album: 'Album Name',
   *   albumArtist: null,
   *   year: '2024',
   *   coverUrl: 'https://...',
   *   duration: 240,
   *   provider: 'youtube',
   *   providerId: 'abc123',
   *   kind: 'track',
   *   tracks: null
   * });
   * // Returns: MediaItem { id: 100, createdAt: 2024-01-15T10:30:00Z, ... }
   * 
   * // Create Bandcamp album with tracks
   * const album = await repo.create({
   *   title: 'Album Title',
   *   artist: null,
   *   album: null,
   *   albumArtist: null,
   *   year: '2024',
   *   coverUrl: 'https://...',
   *   duration: null,
   *   provider: 'bandcamp',
   *   providerId: 'xyz789',
   *   kind: 'album',
   *   tracks: [
   *     { track: 1, title: 'Track 1', duration: 180 },
   *     { track: 2, title: 'Track 2', duration: 200 }
   *   ]
   * });
   * // Tracks serialized to JSON in database
   * ```
   */
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

  /**
   * Updates editable media metadata fields.
   * 
   * SQL (dynamic based on fields):
   * ```sql
   * UPDATE media
   * SET title = ?, artist = ?, ..., updated_at = datetime('now')
   * WHERE id = ?
   * ```
   * 
   * Protected fields (provider, providerId) cannot be updated.
   * Only provided fields are updated (partial updates supported).
   * Automatically sets updated_at to current timestamp.
   * Tracks array is JSON-serialized if provided.
   * 
   * @param id - Media ID
   * @param fields - Fields to update (partial)
   * @throws Error if attempting to update provider or providerId
   * 
   * @example
   * ```typescript
   * // Update title only
   * await repo.updateMetadata(100, {
   *   title: 'New Song Title'
   * });
   * 
   * // Update multiple fields
   * await repo.updateMetadata(100, {
   *   artist: 'Corrected Artist',
   *   album: 'Corrected Album',
   *   year: '2024'
   * });
   * // Sets updated_at = current timestamp
   * 
   * // Update tracks for album
   * await repo.updateMetadata(101, {
   *   tracks: [
   *     { track: 1, title: 'Updated Track 1', duration: 185 },
   *     { track: 2, title: 'Updated Track 2', duration: 195 }
   *   ]
   * });
   * // Tracks re-serialized to JSON
   * 
   * // Error: attempting to update protected field
   * try {
   *   await repo.updateMetadata(100, { provider: 'bandcamp' } as any);
   * } catch (error) {
   *   // Error: Cannot update provider or providerId fields
   * }
   * ```
   */
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

  /**
   * Deletes a media item by ID.
   * 
   * SQL: `DELETE FROM media WHERE id = ?`
   * 
   * Foreign key constraints will set mediaId to NULL in downloads table.
   * 
   * @param id - Media ID to delete
   * 
   * @example
   * ```typescript
   * await repo.delete(100);
   * // Removes media record, downloads.media_id set to NULL
   * ```
   */
  async delete(id: number): Promise<void> {
    const stmt = this.db.prepare("DELETE FROM media WHERE id = ?");
    stmt.run(id);
  }

  /**
   * Deletes all media items.
   * 
   * SQL: `DELETE FROM media`
   * 
   * Dangerous operation - removes all media records.
   * Use with caution (typically only for testing).
   * 
   * @example
   * ```typescript
   * await repo.deleteAll();
   * // Removes all media records, downloads.media_id set to NULL
   * ```
   */
  async deleteAll(): Promise<void> {
    const stmt = this.db.prepare("DELETE FROM media");
    stmt.run();
  }
}
