import { MediaRepository } from "@/core/domain/media/repositories/media-repository";
import { MediaItem, Provider } from "@/core/domain/media/entities/media";
import { withCache } from "@/lib/db/cache/utils";

/**
 * Editable fields for media metadata updates.
 */
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

/**
 * Caching decorator for MediaRepository.
 * 
 * Infrastructure layer - Adds caching layer using Decorator pattern.
 * Wraps any MediaRepository implementation with automatic caching.
 * 
 * Caching strategy:
 * - Read operations: Cached with 5-minute TTL
 * - Write operations: No caching (pass-through)
 * 
 * Cache keys follow pattern:
 * - `media:{id}` - Individual media item
 * - `media:provider:{provider}:{providerId}` - Media by provider lookup
 * - `media:list:{page}:{pageSize}` - Paginated lists
 * - `media:count` - Total count
 * 
 * Longer TTL (5 minutes) than downloads because media metadata is relatively
 * stable. Changes are rare (manual corrections), so longer caching is acceptable.
 * 
 * Cache invalidation is implicit via TTL - no manual invalidation on writes.
 * This means cached data may be stale for up to 5 minutes.
 * 
 * @example
 * ```typescript
 * const sqliteRepo = new SQLiteMediaRepository();
 * const cachedRepo = new CachedMediaRepository(sqliteRepo);
 * 
 * // First call: cache miss, hits database
 * const media1 = await cachedRepo.findById(100);
 * 
 * // Second call within 5min: cache hit, no database query
 * const media2 = await cachedRepo.findById(100);
 * 
 * // Write operations always hit database
 * await cachedRepo.updateMetadata(100, { title: 'Corrected Title' });
 * // Cached entry remains until TTL expires (up to 5min stale)
 * ```
 * 
 * @see withCache - For caching implementation details
 * @see SQLiteMediaRepository - For underlying implementation
 */
export class CachedMediaRepository implements MediaRepository {
  /**
   * Creates a new CachedMediaRepository decorator.
   * 
   * @param repository - Underlying repository to wrap with caching
   */
  constructor(private readonly repository: MediaRepository) {}

  /**
   * Finds media by ID with caching.
   * 
   * Cache key: `media:{id}`
   * TTL: 5 minutes
   * 
   * @param id - Media ID
   * @returns Cached or fresh media
   */
  async findById(id: number): Promise<MediaItem | null> {
    return withCache(
      `media:${id}`,
      () => this.repository.findById(id),
      5 * 60 * 1000 // 5 minutes
    );
  }

  /**
   * Finds media by provider and ID with caching.
   * 
   * Cache key: `media:provider:{provider}:{providerId}`
   * TTL: 5 minutes
   * 
   * Critical for duplicate detection during metadata extraction.
   * 
   * @param provider - Platform provider
   * @param providerId - Provider-specific ID
   * @returns Cached or fresh media
   */
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
