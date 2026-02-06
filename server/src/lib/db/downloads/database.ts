import { Database } from "bun:sqlite";
import pino from "pino";
import { mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import {
  createTableMedia,
  createTableDownloads,
  createIndexMediaProviderId,
  createIndexDownloadsStatus,
  createIndexDownloadsCreatedAt,
  createIndexDownloadsStartedAt,
  createIndexDownloadsNormalizedUrl,
  createIndexDownloadsProcessId,
  createIndexDownloadsNormalizedUrlStatus,
  createIndexDownloadsStatusStartedAt,
} from "./queries";

const log = pino({ level: "info" });
const DB_PATH = "./data/.downloads.db";

export class DownloadsDatabase {
  private static instance: DownloadsDatabase;
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
    this.db.run(createTableMedia);
    this.db.run(createTableDownloads);

    // Create indexes for better query performance
    this.db.run(createIndexMediaProviderId);
    this.db.run(createIndexDownloadsStatus);
    this.db.run(createIndexDownloadsCreatedAt);
    this.db.run(createIndexDownloadsStartedAt);
    this.db.run(createIndexDownloadsNormalizedUrl);
    this.db.run(createIndexDownloadsProcessId);
    this.db.run(createIndexDownloadsNormalizedUrlStatus);
    this.db.run(createIndexDownloadsStatusStartedAt);

    log.info("💿 Downloads database initialized");
  }

  public static getInstance(): DownloadsDatabase {
    if (!DownloadsDatabase.instance) {
      DownloadsDatabase.instance = new DownloadsDatabase();
    }
    return DownloadsDatabase.instance;
  }

  public getDatabase(): Database {
    return this.db;
  }

  public close(): void {
    this.db.close();
    log.info("💿 Downloads database closed");
  }
}

// Export singleton instance
export const downloadsDb = DownloadsDatabase.getInstance().getDatabase();
export const closeDownloadsDb = () => DownloadsDatabase.getInstance().close();
