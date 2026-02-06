import { CacheDatabase } from "./database";

class Cache {
  private db: CacheDatabase;

  constructor() {
    this.db = CacheDatabase.getInstance();
  }

  set<T>(key: string, value: T, ttl: number): void {
    const expiry = Date.now() + ttl;
    const serialized = JSON.stringify(value);
    this.db.insert(key, serialized, expiry);
  }

  get<T>(key: string): T | null {
    const row = this.db.findByKey(key);
    if (!row) {
      return null;
    }

    const now = Date.now();
    if (row.expiry < now) {
      // Expired, delete it
      this.db.deleteByKey(key);
      return null;
    }

    try {
      return JSON.parse(row.value) as T;
    } catch {
      // Invalid JSON, delete it
      this.db.deleteByKey(key);
      return null;
    }
  }

  delete(key: string): void {
    this.db.deleteByKey(key);
  }

  clear(): void {
    this.db.deleteAll();
  }

  cleanup(): number {
    const now = Date.now();
    return this.db.deleteExpired(now);
  }

  stats() {
    const now = Date.now();
    return {
      total: this.db.countAll(),
      expired: this.db.countExpired(now),
      size: this.db.getFileSize(),
      path: this.db.getFilePath(),
    };
  }

  close(): void {
    this.db.close();
  }
}

export const cache = new Cache();
