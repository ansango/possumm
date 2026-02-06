import { withCache } from "@/lib/db/cache/utils";
import { CollectionRepository } from "@/core/domain/bookmark/repositories/CollectionRepository";
import { Collection } from "@/core/domain/bookmark/entities/Collection";

export class CachedCollectionsRepository implements CollectionRepository {
  constructor(private readonly repository: CollectionRepository) {}

  async findAll(): Promise<Collection[]> {
    const cacheKey = "collections:all";

    const result = await withCache(
      cacheKey,
      async () => {
        return this.repository.findAll();
      },
      10 * 60 * 1000 // 10 minutes
    );

    // Rehydrate as Collection instances if coming from cache
    if (Array.isArray(result) && result.length > 0) {
      if (result[0] instanceof Collection) return result;
      return result.map((item: any) => Collection.fromPlainObject(item));
    }

    return result;
  }

  async replaceAll(collections: Collection[]): Promise<void> {
    // No caching for write operations, delegate directly
    return this.repository.replaceAll(collections);
  }
}
