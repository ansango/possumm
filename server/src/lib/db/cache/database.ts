import { Database } from "bun:sqlite";
import { existsSync, statSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

import {
  createTable,
  countAll,
  createExpiryIndex,
  deleteAll,
  deleteByKey,
  deleteExpired,
  findAllValid,
  findByKey,
  findExpiryByKey,
  insertCache,
  countExpired,
} from "./queries";
import { log } from "@/lib/logger";


const DB_PATH = "./data/.cache.db";

export interface CacheEntry {
  key: string;
  value: string;
  expiry: number;
}

export interface CacheRow {
  value: string;
  expiry: number;
}

export class CacheDatabase {
  private static instance: CacheDatabase;
  private db: Database;

  private constructor() {
    const resolvedPath = resolve(DB_PATH);

    // Ensure directory exists
    const dir = dirname(resolvedPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath, { create: true });

    // Enable WAL mode for better concurrency
    this.db.run("PRAGMA journal_mode = WAL;");
    this.db.run("PRAGMA synchronous = NORMAL");

    // Initialize schema
    this.initializeSchema();
    
    log.info("💾 Cache database initialized");
  }

  private initializeSchema(): void {
    // Create table if not exists
    this.db.run(createTable);

    // Create index on expiry for efficient cleanup
    this.db.run(createExpiryIndex);
  }

  public static getInstance(): CacheDatabase {
    if (!CacheDatabase.instance) {
      CacheDatabase.instance = new CacheDatabase();
    }
    return CacheDatabase.instance;
  }

  public getDatabase(): Database {
    return this.db;
  }

  insert(key: string, value: string, expiry: number): void {
    const stmt = this.db.prepare(insertCache);
    stmt.run(key, value, expiry);
  }

  findByKey(key: string): CacheRow | null {
    const stmt = this.db.prepare(findByKey);
    return stmt.get(key) as CacheRow | null;
  }

  findAllValid(currentTime: number): CacheRow[] {
    const stmt = this.db.prepare(findAllValid);
    return stmt.all(currentTime) as CacheRow[];
  }

  findExpiryByKey(key: string): number | null {
    const stmt = this.db.prepare(findExpiryByKey);
    const row = stmt.get(key) as { expiry: number } | null;
    return row ? row.expiry : null;
  }

  deleteByKey(key: string): void {
    const stmt = this.db.prepare(deleteByKey);
    stmt.run(key);
  }

  deleteAll(): void {
    this.db.run(deleteAll);
  }

  deleteExpired(currentTime: number): number {
    const stmt = this.db.prepare(deleteExpired);
    const result = stmt.run(currentTime);
    return result.changes;
  }

  countAll(): number {
    const stmt = this.db.prepare(countAll);
    const row = stmt.get() as { count: number };
    return row.count;
  }

  countExpired(currentTime: number): number {
    const stmt = this.db.prepare(countExpired);
    const row = stmt.get(currentTime) as { count: number };
    return row.count;
  }

  getFilePath(): string {
    return this.db.filename;
  }

  getFileSize(): string {
    try {
      const dbPath = this.db.filename;
      if (existsSync(dbPath)) {
        const stats = statSync(dbPath);
        const bytes = stats.size;
        if (bytes < 1024) {
          return `${bytes} B`;
        } else if (bytes < 1024 * 1024) {
          return `${(bytes / 1024).toFixed(2)} KB`;
        } else {
          return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        }
      }
    } catch (error) {
      // Ignore errors
    }
    return "0 B";
  }

  close(): void {
    this.db.close();
    log.info("💾 Cache database closed");
  }
}

// Export singleton instance and backwards compatibility helpers
export const cacheDb = CacheDatabase.getInstance().getDatabase();
export const closeCacheDb = () => CacheDatabase.getInstance().close();
