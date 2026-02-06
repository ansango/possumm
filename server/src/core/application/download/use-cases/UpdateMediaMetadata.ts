import { MediaRepository } from "@/core/domain/media/repositories/media-repository";
import type { PinoLogger } from "hono-pino";

interface UpdateMetadataInput {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: string;
}

export class UpdateMediaMetadata {
  constructor(
    private readonly mediaRepo: MediaRepository,
    private readonly logger: PinoLogger
  ) {}

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
      this.logger.warn({ mediaId }, "No valid fields to update");
      return;
    }

    await this.mediaRepo.updateMetadata(mediaId, validFields);
    this.logger.info({ mediaId, fields: Object.keys(validFields) }, "Metadata updated");
  }
}
