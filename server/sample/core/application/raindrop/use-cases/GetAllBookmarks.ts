import { BookmarkRepository } from "@/core/domain/bookmark/repositories/BookmarkRepository";

export class GetAllBookmarks {
  constructor(private readonly repository: BookmarkRepository) {}

  async execute(collectionId: number, url: string = "") {
    const bookmarks = await this.repository.findAllByCollectionId(collectionId);

    return {
      _meta: {
        title: "All Bookmarks",
        description: `All bookmarks from collection ${collectionId}`,
        url,
      },
      collectionId,
      total: bookmarks.length,
      bookmarks: bookmarks.map((bookmark) => bookmark.toJSON()),
      generated_at: new Date().toISOString(),
    };
  }
}
