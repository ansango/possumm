import { MediaItem } from '../entities/media';
import type { Provider } from '../entities/media';

/**
 * Editable metadata fields for media updates.
 *
 * These fields can be updated by users after media creation.
 * Protected fields (provider, providerId) are NOT included and
 * will cause an error if attempted to be updated.
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
 * Repository contract for Media entity persistence.
 *
 * Domain layer - Defines the interface without implementation details.
 * Implementations live in the infrastructure layer (SQLite, cached decorator).
 *
 * This repository provides methods for:
 * - CRUD operations on media
 * - Finding media by provider and provider ID (deduplication)
 * - Updating editable metadata fields (excludes provider/providerId)
 * - Managing media lifecycle
 *
 * @see {@link MediaItem} for the entity structure
 */
export interface MediaRepository {
	/**
	 * Finds a media item by its unique ID.
	 *
	 * @param id - Media ID
	 * @returns The media if found, null otherwise
	 * @throws Error with HTTP 404 if media doesn't exist (in use case layer)
	 */
	findById(id: number): Promise<MediaItem | null>;

	/**
	 * Finds media by provider and provider ID to prevent duplicates.
	 *
	 * Used during metadata extraction to check if media already exists
	 * before creating a new record. This prevents duplicate media entries
	 * for the same content across multiple downloads.
	 *
	 * @param provider - Platform provider (bandcamp or youtube)
	 * @param providerId - Provider's ID for this media
	 * @returns Existing media if found, null otherwise
	 *
	 * @example
	 * ```typescript
	 * // Check for existing YouTube Music track
	 * const existing = await mediaRepo.findByProviderAndProviderId(
	 *   'youtube',
	 *   'abc123'
	 * );
	 * if (existing) {
	 *   // Link download to existing media
	 * } else {
	 *   // Create new media
	 * }
	 * ```
	 */
	findByProviderAndProviderId(provider: Provider, providerId: string): Promise<MediaItem | null>;

	/**
	 * Finds all media with pagination.
	 *
	 * @param page - Page number (0-indexed)
	 * @param pageSize - Number of items per page
	 * @returns Array of media, ordered by created_at DESC
	 */
	findAll(page: number, pageSize: number): Promise<MediaItem[]>;

	/**
	 * Counts total number of media items.
	 *
	 * @returns Total count of all media
	 */
	countAll(): Promise<number>;

	/**
	 * Creates a new media record.
	 *
	 * The Media entity allows null fields except id, provider, and timestamps.
	 * This supports incomplete metadata from various sources.
	 *
	 * @param media - Media data to create (without id, createdAt, updatedAt)
	 * @returns The created media with generated ID and timestamps
	 * @throws Error if creation fails
	 */
	create(media: Omit<MediaItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MediaItem>;

	/**
	 * Updates editable metadata fields for a media item.
	 *
	 * Only the fields specified in EditableMediaFields can be updated.
	 * Protected fields (provider, providerId) cannot be changed.
	 * Automatically updates the updatedAt timestamp.
	 *
	 * @param id - Media ID to update
	 * @param fields - Object with fields to update (partial update)
	 * @throws Error with HTTP 400 if trying to update protected fields
	 * @throws Error with HTTP 404 if media not found (in use case layer)
	 *
	 * @example
	 * ```typescript
	 * // Update title and artist
	 * await mediaRepo.updateMetadata(42, {
	 *   title: 'Corrected Title',
	 *   artist: 'Corrected Artist'
	 * });
	 *
	 * // This will throw an error (protected field)
	 * await mediaRepo.updateMetadata(42, {
	 *   provider: 'youtube' // ERROR: Cannot update provider
	 * });
	 * ```
	 */
	updateMetadata(id: number, fields: EditableMediaFields): Promise<void>;

	/**
	 * Deletes a media record.
	 *
	 * Note: This does not cascade to downloads. Downloads with this mediaId
	 * will have their mediaId set to null (due to ON DELETE SET NULL constraint).
	 *
	 * @param id - Media ID to delete
	 */
	delete(id: number): Promise<void>;

	/**
	 * Deletes all media records.
	 *
	 * WARNING: Use with caution. Primarily for testing/development.
	 */
	deleteAll(): Promise<void>;
}
