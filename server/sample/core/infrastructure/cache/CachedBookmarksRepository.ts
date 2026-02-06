
import { BookmarkRepository } from "@/core/domain/bookmark/repositories/BookmarkRepository";
import { Bookmark } from "@/core/domain/bookmark/entities/Bookmark";
import { withCache } from "@/lib/db/cache/utils";

export class CachedBookmarksRepository implements BookmarkRepository {
  constructor(private readonly repository: BookmarkRepository) {}

  async findByCollectionId(
    collectionId: number,
    page: number,
    perPage: number
  ): Promise<Bookmark[]> {
    const cacheKey = `bookmarks:collection:${collectionId}:page:${page}:perpage:${perPage}`;

    const result = await withCache(
      cacheKey,
      async () => {
        return this.repository.findByCollectionId(collectionId, page, perPage);
      },
      10 * 60 * 1000 // 10 minutes
    );

    // Rehydrate as Bookmark instances if coming from cache
    if (Array.isArray(result) && result.length > 0) {
      if (result[0] instanceof Bookmark) return result;
      return result.map((item: any) => Bookmark.fromPlainObject(item));
    }

    return result;
  }

  async findAllByCollectionId(collectionId: number): Promise<Bookmark[]> {
    const cacheKey = `bookmarks:collection:${collectionId}:all`;

    const result = await withCache(
      cacheKey,
      async () => {
        return this.repository.findAllByCollectionId(collectionId);
      },
      10 * 60 * 1000 // 10 minutes
    );

    // Rehydrate as Bookmark instances if coming from cache
    if (Array.isArray(result) && result.length > 0) {
      if (result[0] instanceof Bookmark) return result;
      return result.map((item: any) => Bookmark.fromPlainObject(item));
    }

    return result;
  }

  async replaceByCollection(
    collectionId: number,
    bookmarks: Bookmark[]
  ): Promise<void> {
    // No caching for write operations, delegate directly
    return this.repository.replaceByCollection(collectionId, bookmarks);
  }

  async findAll(page: number, perPage: number): Promise<Bookmark[]> {
    const cacheKey = "bookmarks:all";

    const result = await withCache(
      cacheKey,
      async () => {
        return this.repository.findAll(page, perPage);
      },
      10 * 60 * 1000 // 10 minutes
    );

    // Rehydrate as Bookmark instances if coming from cache
    if (Array.isArray(result) && result.length > 0) {
      if (result[0] instanceof Bookmark) return result;
      return result.map((item: any) => Bookmark.fromPlainObject(item));
    }

    return result;
  }

  async countAll(): Promise<number> {
    const cacheKey = "bookmarks:count:all";

    return withCache(
      cacheKey,
      async () => {
        return this.repository.countAll();
      },
      10 * 60 * 1000 // 10 minutes
    );
  }
}
