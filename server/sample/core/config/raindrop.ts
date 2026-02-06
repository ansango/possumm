import { GetBookmarks } from "../application/raindrop/use-cases/GetBookmarks";
import { GetAllBookmarks } from "../application/raindrop/use-cases/GetAllBookmarks";
import { GetAllBookmarksGlobal } from "../application/raindrop/use-cases/GetAllBookmarksGlobal";
import { GetCollections } from "../application/raindrop/use-cases/GetCollections";
import { SyncBookmarks } from "../application/raindrop/use-cases/SyncBookmarks";

import { SQLiteBookmarksRepository } from "../infrastructure/bookmarks/SQLiteBookmarksRepository";
import { SQLiteCollectionsRepository } from "../infrastructure/bookmarks/SQLiteCollectionsRepository";
import { RaindropBookmarksRepository } from "../infrastructure/raindrop/RaindropBookmarksRepository";
import { RaindropCollectionsRepository } from "../infrastructure/raindrop/RaindropCollectionsRepository";
import { CachedBookmarksRepository } from "../infrastructure/cache/CachedBookmarksRepository";
import { CachedCollectionsRepository } from "../infrastructure/cache/CachedCollectionsRepository";

/**
 * Bookmarks Repositories
 */
const sqliteBookmarksRepository = new SQLiteBookmarksRepository();
const cachedBookmarksRepository = new CachedBookmarksRepository(
  sqliteBookmarksRepository
);

/**
 * Collections Repositories
 */
const sqliteCollectionsRepository = new SQLiteCollectionsRepository();
const cachedCollectionsRepository = new CachedCollectionsRepository(
  sqliteCollectionsRepository
);

/**
 * Raindrop API Repositories (for sync)
 */
const raindropBookmarksRepository = new RaindropBookmarksRepository();
const raindropCollectionsRepository = new RaindropCollectionsRepository();

/**
 * Bookmarks Use Cases
 */
export const getBookmarksUseCase = new GetBookmarks(cachedBookmarksRepository);
export const getAllBookmarksUseCase = new GetAllBookmarks(
  cachedBookmarksRepository
);
export const getAllBookmarksGlobalUseCase = new GetAllBookmarksGlobal(
  cachedBookmarksRepository
);

/**
 * Collections Use Cases
 */
export const getCollectionsUseCase = new GetCollections(
  cachedCollectionsRepository
);

/**
 * Sync Use Case
 */
export const syncBookmarksUseCase = new SyncBookmarks(
  raindropCollectionsRepository,
  raindropBookmarksRepository,
  sqliteCollectionsRepository,
  sqliteBookmarksRepository
);
