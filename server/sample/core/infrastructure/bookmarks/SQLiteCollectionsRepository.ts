import { CollectionRepository } from "@/core/domain/bookmark/repositories/CollectionRepository";
import { Collection } from "@/core/domain/bookmark/entities/Collection";
import { bookmarksDb } from "@/lib/db/bookmarks/database";
import { Database } from "bun:sqlite";

export class SQLiteCollectionsRepository implements CollectionRepository {
  private db: Database;

  constructor() {
    this.db = bookmarksDb;
  }

  async findAll(): Promise<Collection[]> {
    const query = this.db.prepare(`
      SELECT * FROM collections
      ORDER BY sort ASC
    `);

    const rows = query.all() as any[];

    return rows.map((row) => Collection.fromDatabase(row));
  }

  async replaceAll(collections: Collection[]): Promise<void> {
    // Delete all existing collections
    this.db.run("DELETE FROM collections");

    if (collections.length === 0) {
      return;
    }

    // Insert new collections with current timestamp as last_synced_at
    const insertStmt = this.db.prepare(`
      INSERT INTO collections (
        _id, title, description, public, count, sort,
        last_action, created, last_update, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    for (const collection of collections) {
      insertStmt.run(
        collection._id,
        collection.title,
        collection.description,
        collection.isPublic ? 1 : 0,
        collection.count,
        collection.sort,
        collection.lastAction,
        collection.created,
        collection.lastUpdate,
        now
      );
    }
  }
}
