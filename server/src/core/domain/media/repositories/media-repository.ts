import { MediaItem } from "../entities/media";
import type { Provider } from "../entities/media";

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

export interface MediaRepository {
  findById(id: number): Promise<MediaItem | null>;
  findByProviderAndProviderId(provider: Provider, providerId: string): Promise<MediaItem | null>;
  findAll(page: number, pageSize: number): Promise<MediaItem[]>;
  countAll(): Promise<number>;
  create(media: Omit<MediaItem, "id" | "createdAt" | "updatedAt">): Promise<MediaItem>;
  updateMetadata(id: number, fields: EditableMediaFields): Promise<void>;
  delete(id: number): Promise<void>;
  deleteAll(): Promise<void>;
}