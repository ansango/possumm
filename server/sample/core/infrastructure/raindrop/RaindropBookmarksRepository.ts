import { BookmarkRepository } from "@/core/domain/bookmark/repositories/BookmarkRepository";
import { Bookmark } from "@/core/domain/bookmark/entities/Bookmark";
import { getAllBookmarkItems } from "@/lib/raindrop";

export class RaindropBookmarksRepository implements BookmarkRepository {
  async findByCollectionId(
    collectionId: number,
    page: number,
    perPage: number
  ): Promise<Bookmark[]> {
    // Fetch all bookmarks and paginate in memory
    const allBookmarks = await this.findAllByCollectionId(collectionId);
    const offset = page * perPage;
    return allBookmarks.slice(offset, offset + perPage);
  }

  async findAllByCollectionId(collectionId: number): Promise<Bookmark[]> {
    const items = await getAllBookmarkItems(collectionId);
    return items.map((item) => Bookmark.fromRaindropAPI(item));
  }

  async replaceByCollection(
    collectionId: number,
    bookmarks: Bookmark[]
  ): Promise<void> {
    // This operation is not supported by Raindrop API
    throw new Error("RaindropBookmarksRepository does not support write operations");
  }

  async findAll(page: number, perPage: number): Promise<Bookmark[]> {
    // This operation is not supported by Raindrop API directly
    // It would require fetching all collections first, then all bookmarks
    throw new Error("RaindropBookmarksRepository does not support findAll operation");
  }

  async countAll(): Promise<number> {
    // This operation is not supported by Raindrop API directly
    throw new Error("RaindropBookmarksRepository does not support countAll operation");
  }
}
