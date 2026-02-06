import { BookmarkRepository } from "@/core/domain/bookmark/repositories/BookmarkRepository";
import { CollectionRepository } from "@/core/domain/bookmark/repositories/CollectionRepository";
import { log } from "@/lib/logger";

export class SyncBookmarks {
  constructor(
    private readonly raindropCollectionsRepo: CollectionRepository,
    private readonly raindropBookmarksRepo: BookmarkRepository,
    private readonly sqliteCollectionsRepo: CollectionRepository,
    private readonly sqliteBookmarksRepo: BookmarkRepository
  ) {}

  async execute() {
    try {
      log.info("🔄 Starting bookmarks sync from Raindrop...");

      // Fetch collections from Raindrop API (already filtered by RAINDROP_SITE_NAME)
      const collections = await this.raindropCollectionsRepo.findAll();

      if (collections.length === 0) {
        throw new Error(
          `No collections found matching RAINDROP_SITE_NAME filter. Please verify your RAINDROP_SITE_NAME environment variable.`
        );
      }

      log.info(`📁 Found ${collections.length} collections to sync`);

      let totalBookmarks = 0;

      // Sync bookmarks for each collection
      for (const collection of collections) {
        log.info(`🔄 Syncing collection: ${collection.title} (ID: ${collection._id})`);

        // Fetch all bookmarks for this collection from Raindrop API
        const bookmarks = await this.raindropBookmarksRepo.findAllByCollectionId(
          collection._id
        );

        log.info(`  📑 Fetched ${bookmarks.length} bookmarks`);

        // Replace bookmarks in SQLite for this collection
        await this.sqliteBookmarksRepo.replaceByCollection(
          collection._id,
          bookmarks
        );

        totalBookmarks += bookmarks.length;
      }

      // Replace all collections in SQLite (with updated last_synced_at)
      await this.sqliteCollectionsRepo.replaceAll(collections);

      log.info(
        `✅ Bookmarks sync completed: ${collections.length} collections, ${totalBookmarks} total bookmarks`
      );

      return {
        success: true,
        collections_synced: collections.length,
        total_bookmarks: totalBookmarks,
        synced_at: new Date().toISOString(),
      };
    } catch (error) {
      log.error(`❌ Bookmarks sync failed: ${error}`);
      throw error;
    }
  }
}
