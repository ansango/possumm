import { Provider } from "@/core/domain/media/entities/media";

interface ValidationResult {
  valid: boolean;
  provider: Provider | null;
}

export class PlatformDetector {
  private bandcampRegex = /bandcamp\.com\/(track|album)\//i;
  private ytmusicRegex = /music\.youtube\.com\/(watch|playlist)/i;

  validate(url: string): ValidationResult {
    if (this.bandcampRegex.test(url)) {
      return { valid: true, provider: "bandcamp" };
    }

    if (this.ytmusicRegex.test(url)) {
      return { valid: true, provider: "youtube" };
    }

    return { valid: false, provider: null };
  }

  validateOrThrow(url: string): Provider {
    const result = this.validate(url);
    
    if (!result.valid || !result.provider) {
      throw new Error(
        "Invalid URL. Only Bandcamp (track/album) and YouTube Music (watch/playlist) URLs are supported."
      );
    }

    return result.provider;
  }
}
