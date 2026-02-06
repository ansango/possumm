type Provider = "youtube" | "bandcamp";

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
    public readonly tracks:
      | {
          track: number | null;
          title: string | null;
          duration: number | null;
        }[]
      | null,
  ) {}
}
