import { MediaItem } from "../entities/media";

export interface MediaRepository {
  findById(id: number): Promise<MediaItem | null>;
  findAll(page: number, pageSize: number): Promise<MediaItem[]>;
  countAll(): Promise<number>;
  create(media: Omit<MediaItem, "id">): Promise<MediaItem>;
  delete(id: number): Promise<void>;
  deleteAll(): Promise<void>;
}