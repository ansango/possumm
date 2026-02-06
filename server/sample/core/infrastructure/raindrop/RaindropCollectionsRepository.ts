import { CollectionRepository } from "@/core/domain/bookmark/repositories/CollectionRepository";
import { Collection } from "@/core/domain/bookmark/entities/Collection";
import { getRootCollections, RAINDROP_SITE_NAME } from "@/lib/raindrop";

export class RaindropCollectionsRepository implements CollectionRepository {
  async findAll(): Promise<Collection[]> {
    const response = await getRootCollections();
    
    if (!response || !response.items) {
      return [];
    }

    // Filter collections by site name and map to domain entities
    const filteredCollections = response.items
      .filter((item) => item.title.includes(RAINDROP_SITE_NAME))
      .map((item) => {
        // Remove site name prefix from title (e.g., "ansango.frontend" -> "frontend")
        const cleanedTitle = item.title.replace(RAINDROP_SITE_NAME.concat("."), "");
        
        return Collection.fromRaindropAPI({
          ...item,
          title: cleanedTitle,
        });
      })
      .sort((a, b) => a.title.localeCompare(b.title));

    return filteredCollections;
  }

  async replaceAll(collections: Collection[]): Promise<void> {
    // This operation is not supported by Raindrop API
    throw new Error("RaindropCollectionsRepository does not support write operations");
  }
}
