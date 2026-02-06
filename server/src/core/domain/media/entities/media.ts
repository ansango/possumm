export type Provider = "youtube" | "bandcamp";

interface Track {
  track: number | null;
  title: string | null;
  duration: number | null;
}

export class MediaItem {
  constructor(
    public readonly id: number | null,
    public readonly title: string | null,
    public readonly artist: string | null,
    public readonly album: string | null,
    public readonly albumArtist: string | null,
    public readonly year: string | null,
    public readonly coverUrl: string | null,
    public readonly duration: number | null,
    public readonly provider: Provider,
    public readonly providerId: string | null,
    public readonly kind: "track" | "album" | null,
    public readonly tracks: Track[] | null,
    public readonly createdAt: Date | null,
    public readonly updatedAt: Date | null,
  ) {}

  static fromYtDlpMetadata(data: any, provider: Provider): MediaItem {
    const tracks = data.entries
      ? data.entries.map((entry: any, index: number) => ({
          track: entry.playlist_index ?? index + 1,
          title: entry.title ?? null,
          duration: entry.duration ?? null,
        }))
      : null;

    return new MediaItem(
      null,
      data.title ?? null,
      (data.artist || data.uploader) ?? null,
      data.album ?? null,
      data.album_artist ?? null,
      data.release_year?.toString() ?? data.upload_date?.substring(0, 4) ?? null,
      data.thumbnail ?? null,
      data.duration ?? null,
      provider,
      data.id ?? null,
      data._type === "playlist" || data.entries ? "album" : "track",
      tracks,
      null,
      null,
    );
  }

  static fromDatabase(row: any): MediaItem {
    return new MediaItem(
      row.id,
      row.title,
      row.artist,
      row.album,
      row.album_artist,
      row.year,
      row.cover_url,
      row.duration,
      row.provider as Provider,
      row.provider_id,
      row.kind as "track" | "album" | null,
      row.tracks ? JSON.parse(row.tracks) : null,
      row.created_at ? new Date(row.created_at) : null,
      row.updated_at ? new Date(row.updated_at) : null,
    );
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      artist: this.artist,
      album: this.album,
      albumArtist: this.albumArtist,
      year: this.year,
      coverUrl: this.coverUrl,
      duration: this.duration,
      provider: this.provider,
      providerId: this.providerId,
      kind: this.kind,
      tracks: this.tracks,
      createdAt: this.createdAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }
}
