import { BookmarkRepository } from "@/core/domain/bookmark/repositories/BookmarkRepository";
import { Bookmark } from "@/core/domain/bookmark/entities/Bookmark";
import { bookmarksDb } from "@/lib/db/bookmarks/database";
import { Database } from "bun:sqlite";

export class SQLiteBookmarksRepository implements BookmarkRepository {
  private db: Database;

  constructor() {
    this.db = bookmarksDb;
  }

  async findByCollectionId(
    collectionId: number,
    page: number,
    perPage: number
  ): Promise<Bookmark[]> {
    const offset = page * perPage;

    const query = this.db.prepare(`
      SELECT * FROM bookmarks
      WHERE collection_id = ?
      ORDER BY created DESC
      LIMIT ? OFFSET ?
    `);

    const rows = query.all(collectionId, perPage, offset) as any[];

    return rows.map((row) => Bookmark.fromDatabase(row));
  }

  async findAllByCollectionId(collectionId: number): Promise<Bookmark[]> {
    const query = this.db.prepare(`
      SELECT * FROM bookmarks
      WHERE collection_id = ?
      ORDER BY created DESC
    `);

    const rows = query.all(collectionId) as any[];

    return rows.map((row) => Bookmark.fromDatabase(row));
  }

  async replaceByCollection(
    collectionId: number,
    bookmarks: Bookmark[]
  ): Promise<void> {
    // Delete existing bookmarks for this collection
    const deleteStmt = this.db.prepare(
      "DELETE FROM bookmarks WHERE collection_id = ?"
    );
    deleteStmt.run(collectionId);

    if (bookmarks.length === 0) {
      return;
    }

    // Insert new bookmarks using INSERT OR REPLACE to handle any remaining conflicts
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO bookmarks (
        _id, link, title, excerpt, note, type, cover, tags,
        important, removed, created, collection_id, domain, last_update
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const bookmark of bookmarks) {
      insertStmt.run(
        bookmark._id,
        bookmark.link,
        bookmark.title,
        bookmark.excerpt,
        bookmark.note,
        bookmark.type,
        bookmark.cover,
        bookmark.getTagsAsString(),
        bookmark.important ? 1 : 0,
        bookmark.removed ? 1 : 0,
        bookmark.created,
        bookmark.collectionId,
        bookmark.domain,
        bookmark.lastUpdate
      );
    }
  }

  async findAll(page: number, perPage: number): Promise<Bookmark[]> {
    const offset = page * perPage;

    const query = this.db.prepare(`
      SELECT * FROM bookmarks
      ORDER BY created DESC
      LIMIT ? OFFSET ?
    `);

    const rows = query.all(perPage, offset) as any[];

    return rows.map((row) => Bookmark.fromDatabase(row));
  }

  async countAll(): Promise<number> {
    const query = this.db.prepare(`
      SELECT COUNT(*) as count FROM bookmarks
    `);

    const result = query.get() as { count: number };
    return result.count;
  }
}
