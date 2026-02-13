import { MediaRepository } from '@/core/domain/media/repositories/media-repository';
import type { PinoLogger } from 'hono-pino';

/**
 * Input structure for metadata updates.
 *
 * All fields are optional - only provided fields will be updated.
 * Cannot update provider, providerId, coverUrl, duration, kind, or tracks.
 */
interface UpdateMetadataInput {
	title?: string;
	artist?: string;
	album?: string;
	albumArtist?: string;
	year?: string;
}

/**
 * Use case for updating media metadata.
 *
 * Application layer - Allows manual correction of media information.
 * Supports partial updates - only provided fields are changed.
 *
 * Restricted fields (provider, providerId, coverUrl, duration, kind, tracks)
 * cannot be updated via this use case to preserve data integrity.
 *
 * Used by API handlers for user-initiated metadata corrections.
 */
export class UpdateMediaMetadata {
	/**
	 * Creates a new UpdateMediaMetadata use case.
	 *
	 * @param mediaRepo - Media repository for updates
	 * @param logger - Logger for structured logging
	 */
	constructor(
		private readonly mediaRepo: MediaRepository,
		private readonly logger: PinoLogger
	) {}

	/**
	 * Updates media metadata fields.
	 *
	 * Flow:
	 * 1. Loads media from repository
	 * 2. Filters out undefined fields
	 * 3. Validates at least one field provided
	 * 4. Updates metadata via repository
	 * 5. Logs updated fields
	 *
	 * Only explicitly provided fields are updated. Passing undefined
	 * leaves field unchanged. Passing empty string/null clears field.
	 *
	 * @param mediaId - Media ID to update
	 * @param updates - Fields to update (partial)
	 * @throws Error if media not found (HTTP 404)
	 *
	 * @example
	 * ```typescript
	 * const updateMetadata = new UpdateMediaMetadata(mediaRepo, logger);
	 *
	 * // Update title only
	 * await updateMetadata.execute(100, {
	 *   title: 'Corrected Song Title'
	 * });
	 * // Other fields unchanged
	 *
	 * // Update multiple fields
	 * await updateMetadata.execute(100, {
	 *   artist: 'Correct Artist',
	 *   album: 'Correct Album',
	 *   year: '2024'
	 * });
	 *
	 * // Clear a field
	 * await updateMetadata.execute(100, {
	 *   albumArtist: '' // Clears albumArtist
	 * });
	 *
	 * // No-op if no fields provided
	 * await updateMetadata.execute(100, {});
	 * // Logs warning, no update performed
	 * ```
	 */
	async execute(mediaId: number, updates: UpdateMetadataInput): Promise<void> {
		const media = await this.mediaRepo.findById(mediaId);
		if (!media) {
			throw new Error(`Media ${mediaId} not found`);
		}

		const validFields: Record<string, any> = {};

		if (updates.title !== undefined) validFields.title = updates.title;
		if (updates.artist !== undefined) validFields.artist = updates.artist;
		if (updates.album !== undefined) validFields.album = updates.album;
		if (updates.albumArtist !== undefined) validFields.albumArtist = updates.albumArtist;
		if (updates.year !== undefined) validFields.year = updates.year;

		if (Object.keys(validFields).length === 0) {
			this.logger.warn({ mediaId }, 'No valid fields to update');
			return;
		}

		await this.mediaRepo.updateMetadata(mediaId, validFields);
		this.logger.info({ mediaId, fields: Object.keys(validFields) }, 'Metadata updated');
	}
}
