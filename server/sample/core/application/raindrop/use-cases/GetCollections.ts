import { CollectionRepository } from "@/core/domain/bookmark/repositories/CollectionRepository";

export class GetCollections {
  constructor(private readonly repository: CollectionRepository) {}

  async execute(url: string = "/api/bookmarks/collections") {
    const collections = await this.repository.findAll();

    return {
      _meta: {
        title: "Raindrop Collections",
        description: "All synced collections from Raindrop.io",
        url,
      },
      total: collections.length,
      collections: collections.map((collection) => collection.toJSON()),
      generated_at: new Date().toISOString(),
    };
  }
}
