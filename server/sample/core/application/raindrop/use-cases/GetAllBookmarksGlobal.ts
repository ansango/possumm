import { BookmarkRepository } from "@/core/domain/bookmark/repositories/BookmarkRepository";

/**
 * Get all bookmarks across all collections without pagination
 */
export class GetAllBookmarksGlobal {
  constructor(private readonly bookmarksRepo: BookmarkRepository) {}

  async execute(url: string = "/api/bookmarks") {
    const [bookmarks, total] = await Promise.all([
      this.bookmarksRepo.findAll(0, 999999), // Get all bookmarks
      this.bookmarksRepo.countAll(),
    ]);

    return {
      _meta: {
        title: "All Bookmarks",
        description: "All bookmarks across all collections",
        url,
      },
      total,
      bookmarks: bookmarks.map((b) => b.toJSON()),
      generated_at: new Date().toISOString(),
    };
  }
}
