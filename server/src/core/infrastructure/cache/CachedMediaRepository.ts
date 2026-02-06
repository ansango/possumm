import { MediaRepository } from "@/core/domain/media/repositories/media-repository";
import { MediaItem, Provider } from "@/core/domain/media/entities/media";
import { withCache } from "@/lib/db/cache/utils";

interface EditableMediaFields {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  albumArtist?: string | null;
  year?: string | null;
  coverUrl?: string | null;
  duration?: number | null;
  tracks?: { track: number | null; title: string | null; duration: number | null }[] | null;
}

export class CachedMediaRepository implements MediaRepository {
  constructor(private readonly repository: MediaRepository) {}

  async findById(id: number): Promise<MediaItem | null> {
    return withCache(
      `media:${id}`,
      () => this.repository.findById(id),
      5 * 60 * 1000 // 5 minutes
    );
  }

  async findByProviderAndProviderId(
    provider: Provider,
    providerId: string
  ): Promise<MediaItem | null> {
    return withCache(
      `media:provider:${provider}:${providerId}`,
      () => this.repository.findByProviderAndProviderId(provider, providerId),
      5 * 60 * 1000
    );
  }

  async findAll(page: number, pageSize: number): Promise<MediaItem[]> {
    return withCache(
      `media:list:${page}:${pageSize}`,
      () => this.repository.findAll(page, pageSize),
      5 * 60 * 1000
    );
  }

  async countAll(): Promise<number> {
    return withCache(
      "media:count",
      () => this.repository.countAll(),
      5 * 60 * 1000
    );
  }

  async create(media: Omit<MediaItem, "id" | "createdAt" | "updatedAt">): Promise<MediaItem> {
    // No caching for write operations
    return this.repository.create(media);
  }

  async updateMetadata(id: number, fields: EditableMediaFields): Promise<void> {
    // No caching for write operations
    return this.repository.updateMetadata(id, fields);
  }

  async delete(id: number): Promise<void> {
    // No caching for write operations
    return this.repository.delete(id);
  }

  async deleteAll(): Promise<void> {
    // No caching for write operations
    return this.repository.deleteAll();
  }
}
