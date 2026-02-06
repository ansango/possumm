import { BookmarkRepository } from "@/core/domain/bookmark/repositories/BookmarkRepository";

export class GetBookmarks {
  constructor(private readonly repository: BookmarkRepository) {}

  async execute(collectionId: number, page: number = 0, perPage: number = 50, url: string = "") {
    const bookmarks = await this.repository.findByCollectionId(
      collectionId,
      page,
      perPage
    );

    return {
      _meta: {
        title: "Bookmarks",
        description: `Bookmarks from collection ${collectionId} (page ${page + 1})`,
        url,
      },
      collectionId,
      page,
      perPage,
      count: bookmarks.length,
      bookmarks: bookmarks.map((bookmark) => bookmark.toJSON()),
      generated_at: new Date().toISOString(),
    };
  }
}
