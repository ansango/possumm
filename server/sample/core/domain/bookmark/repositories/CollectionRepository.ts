import { Collection } from "../entities/Collection";

export interface CollectionRepository {
  /**
   * Find all collections
   * @returns Array of all collections
   */
  findAll(): Promise<Collection[]>;

  /**
   * Replace all collections
   * Deletes all existing collections and inserts new ones
   * @param collections - Array of collections to insert
   */
  replaceAll(collections: Collection[]): Promise<void>;
}
