export class UrlNormalizer {
  normalize(url: string): string {
    try {
      const trimmed = url.trim();
      const parsed = new URL(trimmed);
      
      // Normalize protocol and domain to lowercase
      const protocol = parsed.protocol.toLowerCase();
      const hostname = parsed.hostname.toLowerCase();
      
      // Preserve path and query params as-is (yt-dlp needs them)
      const pathname = parsed.pathname;
      const search = parsed.search;
      const hash = parsed.hash;
      
      return `${protocol}//${hostname}${pathname}${search}${hash}`;
    } catch {
      // If URL parsing fails, just return trimmed lowercase
      return url.trim().toLowerCase();
    }
  }
}
