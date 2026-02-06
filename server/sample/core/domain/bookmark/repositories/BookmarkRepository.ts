import { Bookmark } from "../entities/Bookmark";

export interface BookmarkRepository {
  /**
   * Find bookmarks by collection ID with pagination
   * @param collectionId - The collection ID to filter by
   * @param page - Zero-based page index
   * @param perPage - Number of items per page
   * @returns Array of bookmarks ordered by created DESC
   */
  findByCollectionId(
    collectionId: number,
    page: number,
    perPage: number
  ): Promise<Bookmark[]>;

  /**
   * Find all bookmarks by collection ID without pagination
   * @param collectionId - The collection ID to filter by
   * @returns Array of all bookmarks ordered by created DESC
   */
  findAllByCollectionId(collectionId: number): Promise<Bookmark[]>;

  /**
   * Replace all bookmarks for a specific collection
   * Deletes existing bookmarks for the collection and inserts new ones
   * @param collectionId - The collection ID
   * @param bookmarks - Array of bookmarks to insert
   */
  replaceByCollection(
    collectionId: number,
    bookmarks: Bookmark[]
  ): Promise<void>;

  /**
   * Find all bookmarks across all collections with pagination
   * @param page - Zero-based page index
   * @param perPage - Number of items per page
   * @returns Array of all bookmarks ordered by created DESC
   */
  findAll(page: number, perPage: number): Promise<Bookmark[]>;

  /**
   * Count total number of bookmarks across all collections
   * @returns Total count of bookmarks
   */
  countAll(): Promise<number>;
}
