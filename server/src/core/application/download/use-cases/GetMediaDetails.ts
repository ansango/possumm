import { MediaRepository } from "@/core/domain/media/repositories/media-repository";
import type { PinoLogger } from "hono-pino";

interface MediaDetailsResult {
  id: number;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  year: string | null;
  coverUrl: string | null;
  duration: number | null;
  provider: string;
  providerId: string | null;
  kind: "track" | "album" | null;
  tracks: Array<{
    track: number | null;
    title: string | null;
    duration: number | null;
  }> | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export class GetMediaDetails {
  constructor(
    private readonly mediaRepo: MediaRepository,
    private readonly logger: PinoLogger
  ) {}

  async execute(mediaId: number): Promise<MediaDetailsResult> {
    const media = await this.mediaRepo.findById(mediaId);
    if (!media) {
      throw new Error(`Media ${mediaId} not found`);
    }

    return {
      id: media.id!,
      title: media.title,
      artist: media.artist,
      album: media.album,
      albumArtist: media.albumArtist,
      year: media.year,
      coverUrl: media.coverUrl,
      duration: media.duration,
      provider: media.provider,
      providerId: media.providerId,
      kind: media.kind,
      tracks: media.tracks,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
    };
  }
}
