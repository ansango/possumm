import { Database } from "bun:sqlite";
import { log } from "@/lib/logger";
import { mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import {
  createTableBookmarks,
  createTableCollections,
  createIndexBookmarksCollectionId,
  createIndexBookmarksCreated,
  createIndexBookmarksImportant,
  createIndexCollectionsSort,
} from "@/lib/db/bookmarks/queries";

const DB_PATH = "./data/.bookmarks.db";

export class BookmarksDatabase {
  private static instance: BookmarksDatabase;
  private db: Database;

  private constructor() {
    const resolvedPath = resolve(DB_PATH);

    // Ensure directory exists
    const dir = dirname(resolvedPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    this.initialize();
  }

  private initialize(): void {
    // Enable WAL mode for better concurrent access
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA synchronous = NORMAL");

    // Create tables
    this.db.run(createTableBookmarks);
    this.db.run(createTableCollections);

    // Create indexes for better query performance
    this.db.run(createIndexBookmarksCollectionId);
    this.db.run(createIndexBookmarksCreated);
    this.db.run(createIndexBookmarksImportant);
    this.db.run(createIndexCollectionsSort);

    log.info("🔖 Bookmarks database initialized");
  }

  public static getInstance(): BookmarksDatabase {
    if (!BookmarksDatabase.instance) {
      BookmarksDatabase.instance = new BookmarksDatabase();
    }
    return BookmarksDatabase.instance;
  }

  public getDatabase(): Database {
    return this.db;
  }

  public close(): void {
    this.db.close();
    log.info("🔖 Bookmarks database closed");
  }
}

// Export singleton instance
export const bookmarksDb = BookmarksDatabase.getInstance().getDatabase();
export const closeBookmarksDb = () => BookmarksDatabase.getInstance().close();
